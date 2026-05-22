import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.agents import AgentInputBuilder, gemini_agent_runner_from_env
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
    DEFAULT_GEMINI_BASE_URL,
    DEFAULT_GEMINI_MODEL,
    ENV_GEMINI_API_KEY,
    ENV_GEMINI_BASE_URL,
    ENV_GEMINI_RESPONSE_SCHEMA,
    GeminiAPIError,
    GeminiConfigurationError,
    GeminiJsonClient,
    GeminiSettings,
)
from crew_system.registry import load_registry


class GeminiClientTest(unittest.TestCase):
    def test_settings_load_from_env_and_require_api_key(self) -> None:
        with self.assertRaisesRegex(GeminiConfigurationError, ENV_GEMINI_API_KEY):
            GeminiSettings.from_env({})

        settings = GeminiSettings.from_env(
            {
                ENV_GEMINI_API_KEY: "gemini-test-key",
                "GEMINI_MODEL": "gemini-3.5-flash",
                "GEMINI_TIMEOUT_SECONDS": "12",
                "GEMINI_MAX_OUTPUT_TOKENS": "1234",
                "GEMINI_TEMPERATURE": "0.2",
                ENV_GEMINI_RESPONSE_SCHEMA: "true",
            }
        )

        self.assertEqual(settings.base_url, DEFAULT_GEMINI_BASE_URL)
        self.assertEqual(settings.model, "gemini-3.5-flash")
        self.assertEqual(settings.timeout_seconds, 12)
        self.assertEqual(settings.max_output_tokens, 1234)
        self.assertEqual(settings.temperature, 0.2)
        self.assertTrue(settings.response_schema_enabled)
        self.assertIsNone(GeminiSettings.from_env({ENV_GEMINI_API_KEY: "key"}).max_output_tokens)
        self.assertFalse(GeminiSettings.from_env({ENV_GEMINI_API_KEY: "key"}).response_schema_enabled)

    def test_client_posts_generate_content_json_request(self) -> None:
        server = RecordingServer(response_payload=gemini_response(valid_growth_payload()))
        with server.running() as base_url:
            client = GeminiJsonClient(
                GeminiSettings(
                    api_key="gemini-test-key",
                    base_url=base_url,
                    model=DEFAULT_GEMINI_MODEL,
                    timeout_seconds=5,
                )
            )

            payload = client.generate_json(
                system_prompt="Tu es growth_hacker.",
                input_payload={"request_id": "req_1", "prompt": "not duplicated"},
                output_schema=growth_schema(),
            )

        self.assertEqual(payload["growth_system"]["source"], "gemini_mock")
        self.assertEqual(server.last_path, f"/models/{DEFAULT_GEMINI_MODEL}:generateContent")
        self.assertEqual(server.last_headers["x-goog-api-key"], "gemini-test-key")
        self.assertEqual(server.last_payload["generationConfig"]["responseMimeType"], "application/json")
        self.assertNotIn("responseJsonSchema", server.last_payload["generationConfig"])
        self.assertNotIn("maxOutputTokens", server.last_payload["generationConfig"])
        self.assertIn("systemInstruction", server.last_payload)
        self.assertNotIn("not duplicated", server.last_payload["contents"][0]["parts"][0]["text"])

    def test_client_can_send_provider_response_schema_when_enabled(self) -> None:
        server = RecordingServer(response_payload=gemini_response(valid_growth_payload()))
        with server.running() as base_url:
            client = GeminiJsonClient(
                GeminiSettings(
                    api_key="gemini-test-key",
                    base_url=base_url,
                    timeout_seconds=5,
                    response_schema_enabled=True,
                )
            )

            client.generate_json(
                system_prompt="Tu es growth_hacker.",
                input_payload={"request_id": "req_1"},
                output_schema=growth_schema(),
            )

        self.assertEqual(server.last_payload["generationConfig"]["responseJsonSchema"]["title"], "GrowthSystem")

    def test_client_sends_max_output_tokens_only_when_explicitly_configured(self) -> None:
        server = RecordingServer(response_payload=gemini_response(valid_growth_payload()))
        with server.running() as base_url:
            client = GeminiJsonClient(
                GeminiSettings(
                    api_key="gemini-test-key",
                    base_url=base_url,
                    timeout_seconds=5,
                    max_output_tokens=1234,
                )
            )

            client.generate_json(
                system_prompt="Tu es growth_hacker.",
                input_payload={"request_id": "req_1"},
                output_schema=growth_schema(),
            )

        self.assertEqual(server.last_payload["generationConfig"]["maxOutputTokens"], 1234)

    def test_gemini_runner_factory_integrates_with_llm_runner(self) -> None:
        server = RecordingServer(response_payload=gemini_response(valid_growth_payload()))
        with server.running() as base_url:
            runner = gemini_agent_runner_from_env(
                {
                    ENV_GEMINI_API_KEY: "gemini-test-key",
                    ENV_GEMINI_BASE_URL: base_url,
                    "GEMINI_TIMEOUT_SECONDS": "5",
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
        self.assertEqual(result.output.payload["growth_system"]["source"], "gemini_mock")

    def test_client_rejects_invalid_gemini_json_content(self) -> None:
        server = RecordingServer(
            response_payload=[
                gemini_text_response("not json"),
                gemini_text_response("still not json"),
            ]
        )
        with server.running() as base_url:
            client = GeminiJsonClient(
                GeminiSettings(api_key="gemini-test-key", base_url=base_url, timeout_seconds=5)
            )
            with self.assertRaisesRegex(GeminiAPIError, "not valid JSON"):
                client.generate_json(
                    system_prompt="Tu es growth_hacker.",
                    input_payload={"request_id": "req_1"},
                    output_schema=growth_schema(),
                )

    def test_client_repairs_non_json_content_with_second_provider_call(self) -> None:
        server = RecordingServer(
            response_payload=[
                gemini_text_response("Voici la reponse: strategie growth avec boucle commentaire."),
                gemini_response(valid_growth_payload()),
            ]
        )
        with server.running() as base_url:
            client = GeminiJsonClient(
                GeminiSettings(api_key="gemini-test-key", base_url=base_url, timeout_seconds=5)
            )
            payload = client.generate_json(
                system_prompt="Tu es growth_hacker.",
                input_payload={"request_id": "req_1"},
                output_schema=growth_schema(),
            )

        self.assertEqual(server.request_count, 2)
        self.assertEqual(payload["growth_system"]["source"], "gemini_mock")

    def test_client_coerces_json_array_into_single_required_object_root(self) -> None:
        server = RecordingServer(
            response_payload=gemini_text_response('[{"platform":"facebook","body":"Post 1"}]')
        )
        with server.running() as base_url:
            client = GeminiJsonClient(
                GeminiSettings(api_key="gemini-test-key", base_url=base_url, timeout_seconds=5)
            )
            payload = client.generate_json(
                system_prompt="Tu es copywriter.",
                input_payload={"request_id": "req_1"},
                output_schema=content_units_schema(),
            )

        self.assertEqual(payload["content_units"]["unit_001"]["platform"], "facebook")


class RecordingServer:
    def __init__(self, response_payload: dict | list[dict]) -> None:
        self.response_payload = response_payload
        self.request_count = 0
        self.last_path = ""
        self.last_headers: dict[str, str] = {}
        self.last_payload: dict = {}
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None

    def running(self):
        return RunningRecordingServer(self)

    def next_response_payload(self) -> dict:
        payloads = self.response_payload
        if isinstance(payloads, list):
            index = min(self.request_count, len(payloads) - 1)
            payload = payloads[index]
        else:
            payload = payloads
        self.request_count += 1
        return payload


class RunningRecordingServer:
    def __init__(self, owner: RecordingServer) -> None:
        self.owner = owner

    def __enter__(self) -> str:
        owner = self.owner

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = self.rfile.read(int(self.headers["Content-Length"]))
                owner.last_path = self.path
                owner.last_headers = {key.lower(): value for key, value in self.headers.items()}
                owner.last_payload = json.loads(body.decode("utf-8"))
                response_payload = owner.next_response_payload()
                payload = json.dumps(response_payload).encode("utf-8")
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

def gemini_response(payload: dict) -> dict:
    return {
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {"parts": [{"text": json.dumps(payload)}]},
            }
        ]
    }


def gemini_text_response(text: str) -> dict:
    return {
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {"parts": [{"text": text}]},
            }
        ]
    }


def growth_schema() -> dict:
    return load_registry(ROOT).get_schema("growth_hacker")


def content_units_schema() -> dict:
    return load_registry(ROOT).get_schema("copywriter")


def valid_growth_payload() -> dict:
    return {
        "growth_system": {
            "source": "gemini_mock",
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
