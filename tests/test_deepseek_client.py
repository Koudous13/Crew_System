import json
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.agents import AgentInputBuilder, deepseek_agent_runner_from_env
from crew_system.core.models import (
    AgentRunStatus,
    ContextSnapshot,
    Intent,
    IntentType,
    NormalizedRequest,
    ProjectRef,
    TaskNode,
    TaskType,
)
from crew_system.llm import (
    DEFAULT_DEEPSEEK_BASE_URL,
    DEFAULT_DEEPSEEK_MODEL,
    ENV_DEEPSEEK_API_KEY,
    ENV_DEEPSEEK_BASE_URL,
    DeepSeekAPIError,
    DeepSeekConfigurationError,
    DeepSeekJsonClient,
    DeepSeekSettings,
    ENV_DEEPSEEK_THINKING,
    parse_dotenv,
)
from crew_system.registry import load_registry


class DeepSeekClientTest(unittest.TestCase):
    def test_settings_load_from_env_and_require_api_key(self) -> None:
        with self.assertRaisesRegex(DeepSeekConfigurationError, ENV_DEEPSEEK_API_KEY):
            DeepSeekSettings.from_env({})

        settings = DeepSeekSettings.from_env(
            {
                ENV_DEEPSEEK_API_KEY: "sk-test",
                "DEEPSEEK_MODEL": "deepseek-v4-flash",
                "DEEPSEEK_TIMEOUT_SECONDS": "12",
                "DEEPSEEK_MAX_TOKENS": "1234",
                "DEEPSEEK_TEMPERATURE": "0.2",
                ENV_DEEPSEEK_THINKING: "true",
            }
        )

        self.assertEqual(settings.base_url, DEFAULT_DEEPSEEK_BASE_URL)
        self.assertEqual(settings.model, "deepseek-v4-flash")
        self.assertEqual(settings.timeout_seconds, 12)
        self.assertEqual(settings.max_tokens, 1234)
        self.assertEqual(settings.temperature, 0.2)
        self.assertTrue(settings.thinking_enabled)
        self.assertIsNone(DeepSeekSettings.from_env({ENV_DEEPSEEK_API_KEY: "sk-test"}).max_tokens)

    def test_dotenv_parser_supports_local_secret_file_without_printing_key(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir, ".env")
            path.write_text(
                "\n".join(
                    [
                        "# local secrets",
                        f"{ENV_DEEPSEEK_API_KEY}='local-secret-value'",
                        "DEEPSEEK_MODEL=deepseek-v4-flash",
                    ]
                ),
                encoding="utf-8",
            )

            values = parse_dotenv(path)

        self.assertEqual(values[ENV_DEEPSEEK_API_KEY], "local-secret-value")
        self.assertEqual(values["DEEPSEEK_MODEL"], "deepseek-v4-flash")

    def test_client_posts_deepseek_json_mode_request(self) -> None:
        server = RecordingServer(
            response_payload={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {
                            "content": json.dumps(valid_growth_payload()),
                        },
                    }
                ]
            }
        )
        with server.running() as base_url:
            client = DeepSeekJsonClient(
                DeepSeekSettings(
                    api_key="sk-test",
                    base_url=base_url,
                    model=DEFAULT_DEEPSEEK_MODEL,
                    timeout_seconds=5,
                )
            )

            payload = client.generate_json(
                system_prompt="Tu es growth_hacker.",
                input_payload={"request_id": "req_1", "prompt": "not duplicated"},
                output_schema=growth_schema(),
            )

        self.assertEqual(payload["growth_system"]["source"], "deepseek_mock")
        self.assertEqual(server.last_path, "/chat/completions")
        self.assertEqual(server.last_headers["Authorization"], "Bearer sk-test")
        self.assertEqual(server.last_payload["model"], DEFAULT_DEEPSEEK_MODEL)
        self.assertEqual(server.last_payload["response_format"], {"type": "json_object"})
        self.assertEqual(server.last_payload["thinking"], {"type": "disabled"})
        self.assertNotIn("max_tokens", server.last_payload)
        self.assertIn("json", server.last_payload["messages"][0]["content"].lower())
        self.assertNotIn("not duplicated", server.last_payload["messages"][1]["content"])

    def test_client_sends_max_tokens_only_when_explicitly_configured(self) -> None:
        server = RecordingServer(
            response_payload={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": json.dumps(valid_growth_payload())},
                    }
                ]
            }
        )
        with server.running() as base_url:
            client = DeepSeekJsonClient(
                DeepSeekSettings(
                    api_key="sk-test",
                    base_url=base_url,
                    timeout_seconds=5,
                    max_tokens=1234,
                )
            )

            client.generate_json(
                system_prompt="Tu es growth_hacker.",
                input_payload={"request_id": "req_1"},
                output_schema=growth_schema(),
            )

        self.assertEqual(server.last_payload["max_tokens"], 1234)

    def test_deepseek_runner_factory_integrates_with_llm_runner(self) -> None:
        server = RecordingServer(
            response_payload={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": json.dumps(valid_growth_payload())},
                    }
                ]
            }
        )
        with server.running() as base_url:
            runner = deepseek_agent_runner_from_env(
                {
                    ENV_DEEPSEEK_API_KEY: "sk-test",
                    ENV_DEEPSEEK_BASE_URL: base_url,
                    "DEEPSEEK_TIMEOUT_SECONDS": "5",
                }
            )
            agent_input = AgentInputBuilder(load_registry(ROOT)).build(
                task_node=growth_task(),
                request=sample_request(),
                context=sample_context(),
            )

            result = runner.run(agent_input)

        self.assertEqual(result.agent_run.status, AgentRunStatus.COMPLETED)
        self.assertTrue(result.schema_validation.valid)
        self.assertEqual(result.output.payload["growth_system"]["source"], "deepseek_mock")

    def test_client_rejects_invalid_deepseek_json_content(self) -> None:
        server = RecordingServer(
            response_payload={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": "not json"},
                    }
                ]
            }
        )
        with server.running() as base_url:
            client = DeepSeekJsonClient(
                DeepSeekSettings(api_key="sk-test", base_url=base_url, timeout_seconds=5)
            )
            with self.assertRaisesRegex(DeepSeekAPIError, "not valid JSON"):
                client.generate_json(
                    system_prompt="Tu es growth_hacker.",
                    input_payload={"request_id": "req_1"},
                    output_schema=growth_schema(),
                )


class RecordingServer:
    def __init__(self, response_payload: dict) -> None:
        self.response_payload = response_payload
        self.last_path = ""
        self.last_headers: dict[str, str] = {}
        self.last_payload: dict = {}
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None

    def running(self):
        return RunningRecordingServer(self)


class RunningRecordingServer:
    def __init__(self, owner: RecordingServer) -> None:
        self.owner = owner

    def __enter__(self) -> str:
        owner = self.owner

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = self.rfile.read(int(self.headers["Content-Length"]))
                owner.last_path = self.path
                owner.last_headers = {key: value for key, value in self.headers.items()}
                owner.last_payload = json.loads(body.decode("utf-8"))
                payload = json.dumps(owner.response_payload).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, format, *args):  # noqa: A002
                return

        owner._server = HTTPServer(("127.0.0.1", 0), Handler)
        owner._thread = threading.Thread(target=owner._server.serve_forever, daemon=True)
        owner._thread.start()
        host, port = owner._server.server_address
        return f"http://{host}:{port}"

    def __exit__(self, exc_type, exc, tb) -> None:
        if self.owner._server is not None:
            self.owner._server.shutdown()
            self.owner._server.server_close()
        if self.owner._thread is not None:
            self.owner._thread.join(timeout=5)


def growth_schema() -> dict:
    return load_registry(ROOT).get_schema("growth_hacker")


def valid_growth_payload() -> dict:
    return {
        "growth_system": {
            "source": "deepseek_mock",
            "loop": "comment-to-lead",
        },
        "self_evaluation": {
            "quality_score": 8,
            "confidence_score": 8,
            "weakest_point": "mock",
            "next_improvement": "real provider call",
        },
    }


def growth_task() -> TaskNode:
    return TaskNode(
        task_id="agent_growth_hacker",
        job_id="job_1",
        task_type=TaskType.AGENT_RUN,
        agent_id="growth_hacker",
    )


def sample_request() -> NormalizedRequest:
    return NormalizedRequest(
        request_id="req_1",
        normalized_message="Genere 70 posts Facebook avec growth hack.",
        intent=Intent(
            intent_type=IntentType.GENERATE_CONTENT_BATCH,
            confidence_score=9,
            project_required=True,
        ),
        project_ref=ProjectRef(
            project_slug="coach_saas",
            project_name="Coach SaaS",
            root_path="workspace/projects/coach_saas",
            project_manifest_path="workspace/projects/coach_saas/manifest.json",
        ),
    )


def sample_context() -> ContextSnapshot:
    return ContextSnapshot(
        job_id="job_1",
        project_slug="coach_saas",
        created_at="2026-05-13T10:00:00Z",
    )


if __name__ == "__main__":
    unittest.main()
