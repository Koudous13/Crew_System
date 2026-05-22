import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.agents import (
    AgentInputBuilder,
    LLMAgentRunner,
    MockAgentRunner,
    validate_output_against_schema,
)
from crew_system.core.models import (
    AgentRunStatus,
    ContextFile,
    ContextSnapshot,
    Intent,
    IntentType,
    NormalizedRequest,
    ProjectRef,
    TaskNode,
    TaskType,
)
from crew_system.filesystem import WorkspaceEngine
from crew_system.registry import load_registry
from crew_system.runtime import AgentTaskExecutor


class AgentRunnerTest(unittest.TestCase):
    def test_input_builder_loads_prompt_and_schema_from_registry(self) -> None:
        registry = load_registry(ROOT)
        agent_input = AgentInputBuilder(registry).build(
            task_node=growth_task(),
            request=sample_request(),
            context=sample_context(),
        )

        self.assertEqual(agent_input.agent_id, "growth_hacker")
        self.assertIn("Tu es growth_hacker", agent_input.prompt)
        self.assertEqual(agent_input.output_schema_name, "GrowthSystem")
        self.assertEqual(agent_input.output_schema["title"], "GrowthSystem")
        self.assertEqual(agent_input.normalized_request["intent"]["intent_type"], "generate_content_batch")

    def test_mock_runner_produces_schema_valid_output_and_agent_run(self) -> None:
        registry = load_registry(ROOT)
        agent_input = AgentInputBuilder(registry).build(
            task_node=growth_task(),
            request=sample_request(),
            context=sample_context(),
        )

        result = MockAgentRunner().run(agent_input)

        self.assertEqual(result.agent_run.status, AgentRunStatus.COMPLETED)
        self.assertTrue(result.schema_validation.valid)
        self.assertIn("growth_system", result.output.payload)
        self.assertEqual(result.output.quality_score, 8)
        self.assertEqual(result.agent_run.agent_version, "0.1.0")
        self.assertEqual(result.agent_run.task_id, "agent_growth_hacker")

    def test_llm_runner_accepts_injected_client_without_runtime_coupling(self) -> None:
        registry = load_registry(ROOT)
        agent_input = AgentInputBuilder(registry).build(
            task_node=growth_task(),
            request=sample_request(),
            context=sample_context(),
        )

        result = LLMAgentRunner(client=FakeLLMClient()).run(agent_input)

        self.assertEqual(result.agent_run.status, AgentRunStatus.COMPLETED)
        self.assertTrue(result.schema_validation.valid)
        self.assertEqual(result.output.payload["growth_system"]["source"], "fake_llm_client")

    def test_schema_validator_rejects_missing_required_output(self) -> None:
        registry = load_registry(ROOT)
        schema = registry.get_schema("growth_hacker")

        result = validate_output_against_schema({}, schema)

        self.assertFalse(result.valid)
        self.assertIn("$.growth_system is required", result.errors)
        self.assertIn("$.self_evaluation is required", result.errors)

    def test_schema_validator_requires_self_evaluation_when_declared(self) -> None:
        registry = load_registry(ROOT)
        schema = registry.get_schema("risk_reviewer")

        result = validate_output_against_schema({"risk_review": {"decision": "ok"}}, schema)

        self.assertFalse(result.valid)
        self.assertIn("$.self_evaluation is required", result.errors)

    def test_llm_runner_fails_cleanly_on_invalid_provider_payload(self) -> None:
        registry = load_registry(ROOT)
        agent_input = AgentInputBuilder(registry).build(
            task_node=growth_task(),
            request=sample_request(),
            context=sample_context(),
        )

        result = LLMAgentRunner(client=BadScoreLLMClient()).run(agent_input)

        self.assertEqual(result.agent_run.status, AgentRunStatus.FAILED)
        self.assertIn("$.self_evaluation.quality_score must be integer", result.error)

    def test_llm_runner_repairs_schema_invalid_json_payload_once(self) -> None:
        registry = load_registry(ROOT)
        agent_input = AgentInputBuilder(registry).build(
            task_node=growth_task(),
            request=sample_request(),
            context=sample_context(),
        )
        client = SchemaRepairLLMClient()

        result = LLMAgentRunner(client=client).run(agent_input)

        self.assertEqual(result.agent_run.status, AgentRunStatus.COMPLETED)
        self.assertTrue(result.schema_validation.valid)
        self.assertEqual(client.calls, 2)
        self.assertIn("schema_validation_errors", client.second_input)
        self.assertEqual(result.output.payload["growth_system"]["source"], "schema_repair_client")

    def test_llm_runner_normalizes_repaired_root_mismatch(self) -> None:
        registry = load_registry(ROOT)
        agent_input = AgentInputBuilder(registry).build(
            task_node=growth_task(),
            request=sample_request(),
            context=sample_context(),
        )
        client = RootMismatchAfterRepairLLMClient()

        result = LLMAgentRunner(client=client).run(agent_input)

        self.assertEqual(result.agent_run.status, AgentRunStatus.COMPLETED)
        self.assertTrue(result.schema_validation.valid)
        self.assertEqual(client.calls, 2)
        self.assertIn("growth_system", result.output.payload)
        self.assertEqual(result.output.payload["growth_system"]["growth_loop"]["source"], "root_mismatch")

    def test_llm_runner_normalizes_copywriter_posts_list_root(self) -> None:
        registry = load_registry(ROOT)
        agent_input = AgentInputBuilder(registry).build(
            task_node=copywriter_task(),
            request=sample_request(),
            context=sample_context(),
        )
        client = CopywriterPostsListAfterRepairLLMClient()

        result = LLMAgentRunner(client=client).run(agent_input)

        self.assertEqual(result.agent_run.status, AgentRunStatus.COMPLETED)
        self.assertTrue(result.schema_validation.valid)
        self.assertEqual(result.output.payload["content_units"]["unit_001"]["platform"], "facebook")

    def test_executor_logs_failed_runner_errors(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")
            registry = load_registry(ROOT)
            executor = AgentTaskExecutor(
                workspace=engine,
                registry=registry,
                runner=LLMAgentRunner(),
            )

            result = executor.execute(
                project_slug="coach_saas",
                task_node=growth_task(),
                request=sample_request(),
                context=sample_context(),
            )

            project_root = Path(temp_dir, "projects/coach_saas")
            agent_runs = read_jsonl(project_root / "logs/agent_runs.jsonl")
            errors = read_jsonl(project_root / "logs/errors.jsonl")

            self.assertEqual(result.agent_run.status, AgentRunStatus.FAILED)
            self.assertIn("requires an LLMClient", result.error)
            self.assertEqual(agent_runs[0]["agent_id"], "growth_hacker")
            self.assertFalse(agent_runs[0]["schema_validation"]["valid"])
            self.assertEqual(errors[0]["agent_id"], "growth_hacker")


class FakeLLMClient:
    def generate_json(self, *, system_prompt, input_payload, output_schema):
        return {
            "growth_system": {
                "source": "fake_llm_client",
                "prompt_seen": "growth_hacker" in system_prompt,
                "request_id": input_payload["normalized_request"]["request_id"],
            },
            "self_evaluation": {
                "quality_score": 7,
                "confidence_score": 7,
                "weakest_point": "fake client",
                "next_improvement": "use a real provider",
            },
        }


class BadScoreLLMClient:
    def generate_json(self, *, system_prompt, input_payload, output_schema):
        return {
            "growth_system": {"source": "bad_score_client"},
            "self_evaluation": {
                "quality_score": "strong",
                "confidence_score": 7,
            },
        }


class SchemaRepairLLMClient:
    def __init__(self) -> None:
        self.calls = 0
        self.second_input = {}

    def generate_json(self, *, system_prompt, input_payload, output_schema):
        self.calls += 1
        if self.calls == 1:
            return {
                "wrong_key": {"source": "schema_repair_client"},
                "self_evaluation": {
                    "quality_score": 8,
                    "confidence_score": 8,
                },
            }
        self.second_input = input_payload
        return {
            "growth_system": {"source": "schema_repair_client"},
            "self_evaluation": {
                "quality_score": 8,
                "confidence_score": 8,
            },
        }


class RootMismatchAfterRepairLLMClient:
    def __init__(self) -> None:
        self.calls = 0

    def generate_json(self, *, system_prompt, input_payload, output_schema):
        self.calls += 1
        if self.calls == 1:
            return {
                "wrong_key": {"source": "root_mismatch"},
                "self_evaluation": {
                    "quality_score": 8,
                    "confidence_score": 8,
                },
            }
        return {
            "growth_loop": {"source": "root_mismatch"},
            "self_evaluation": {
                "quality_score": 8,
                "confidence_score": 8,
            },
        }


class CopywriterPostsListAfterRepairLLMClient:
    def __init__(self) -> None:
        self.calls = 0

    def generate_json(self, *, system_prompt, input_payload, output_schema):
        self.calls += 1
        if self.calls == 1:
            return {"draft_posts": [{"platform": "facebook"}]}
        return {
            "posts": [{"platform": "facebook", "body": "Post 1"}],
            "self_evaluation": {
                "quality_score": 8,
                "confidence_score": 8,
            },
        }


def growth_task() -> TaskNode:
    return TaskNode(
        task_id="agent_growth_hacker",
        job_id="job_1",
        task_type=TaskType.AGENT_RUN,
        agent_id="growth_hacker",
        input_artifacts=["strategy/influence_architecture.md"],
    )


def copywriter_task() -> TaskNode:
    return TaskNode(
        task_id="agent_copywriter",
        job_id="job_1",
        task_type=TaskType.AGENT_RUN,
        agent_id="copywriter",
        input_artifacts=["strategy/growth_system.md"],
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
        files_loaded=[
            ContextFile(
                path="strategy/growth_system.md",
                summary="Boucles commentaires et leads.",
            )
        ],
        useful_points=["strategy/growth_system.md: Boucles commentaires et leads."],
    )


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


if __name__ == "__main__":
    unittest.main()
