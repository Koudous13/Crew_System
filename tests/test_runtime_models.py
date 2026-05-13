import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.core.models import (
    AgentDefinition,
    AgentDefinitionStatus,
    AgentRun,
    AgentRunStatus,
    Artifact,
    ArtifactStatus,
    ArtifactType,
    ChatRequest,
    ContextFile,
    ContextSnapshot,
    FinalChatResponse,
    GateDecision,
    GateResult,
    Intent,
    IntentType,
    Job,
    JobStatus,
    JobType,
    ModelValidationError,
    NormalizedRequest,
    Platform,
    ProjectRef,
    ProjectStatus,
    QualityReport,
    QualityScope,
    RuntimeContext,
    TaskGraph,
    TaskNode,
    TaskStatus,
    TaskType,
)


class RuntimeModelsTest(unittest.TestCase):
    def test_core_models_can_be_created(self) -> None:
        intent = Intent(
            intent_type=IntentType.GENERATE_CONTENT_BATCH,
            confidence_score=9,
            project_required=True,
            project_hint="coach_saas",
            platforms=[Platform.FACEBOOK, Platform.LINKEDIN],
        )
        project = sample_project()

        request = NormalizedRequest(
            request_id="req_1",
            normalized_message="Generer 70 posts Facebook pour la semaine 4.",
            intent=intent,
            project_ref=project,
        )

        snapshot = ContextSnapshot(
            job_id="job_1",
            project_slug="coach_saas",
            created_at="2026-05-13T10:00:00Z",
            files_loaded=[
                ContextFile(path="strategy/growth_system.md", summary="Growth loops")
            ],
        )

        job = Job(
            job_id="job_1",
            job_type=JobType.CONTENT_BATCH,
            project_slug="coach_saas",
            intent_type=IntentType.GENERATE_CONTENT_BATCH,
            created_at="2026-05-13T10:00:00Z",
            updated_at="2026-05-13T10:00:00Z",
            task_graph_id="graph_1",
            status=JobStatus.QUEUED,
            expected_artifacts=["content_batch.md", "content_batch.json"],
        )

        agent_definition = AgentDefinition(
            agent_id="growth_hacker",
            name="Growth Hacker",
            version="0.1.0",
            status=AgentDefinitionStatus.DRAFT,
            prompt_path="registry/prompts/growth_hacker.system.txt",
            schema_path="registry/schemas/GrowthSystem.schema.json",
            eval_path="registry/evals/growth_hacker.eval.yaml",
            capabilities=["growth_loop_design"],
            required_inputs=["normalized_brief"],
            output_schema_name="GrowthSystem",
        )

        agent_run = AgentRun(
            agent_run_id="run_1",
            job_id="job_1",
            agent_id="growth_hacker",
            status=AgentRunStatus.COMPLETED,
            quality_score=9,
            confidence_score=8,
        )

        artifact = Artifact(
            artifact_id="art_1",
            job_id="job_1",
            project_slug="coach_saas",
            artifact_type=ArtifactType.MARKDOWN,
            path="outputs/batches/week_04_facebook_70/content_batch.md",
            created_at="2026-05-13T10:05:00Z",
            status=ArtifactStatus.READY_FOR_HUMAN_REVIEW,
            created_by_agents=["growth_hacker"],
        )

        quality = QualityReport(
            quality_report_id="qr_1",
            job_id="job_1",
            applies_to=QualityScope.ARTIFACT,
            target_id="art_1",
            decision=GateDecision.ACCEPT,
            overall_score=9,
            confidence_score=8,
            gate_results=[
                GateResult(
                    gate_name="intensity_preservation_gate",
                    passed=True,
                    decision=GateDecision.ACCEPT,
                    score=9,
                )
            ],
        )

        response = FinalChatResponse(
            job_id="job_1",
            project_slug="coach_saas",
            status=JobStatus.COMPLETED,
            message="Batch cree et pret pour revue humaine.",
            created_at="2026-05-13T10:06:00Z",
            artifacts_created=["art_1"],
        )

        self.assertEqual(request.project_ref.project_slug, "coach_saas")
        self.assertEqual(snapshot.files_loaded[0].path, "strategy/growth_system.md")
        self.assertEqual(job.status, JobStatus.QUEUED)
        self.assertEqual(agent_definition.agent_id, "growth_hacker")
        self.assertEqual(agent_run.quality_score, 9)
        self.assertEqual(artifact.status, ArtifactStatus.READY_FOR_HUMAN_REVIEW)
        self.assertEqual(quality.decision, GateDecision.ACCEPT)
        self.assertEqual(response.artifacts_created, ["art_1"])

    def test_chat_request_round_trips_json(self) -> None:
        request = ChatRequest(
            request_id="req_1",
            conversation_id="conv_1",
            user_message="Cree la strategie annuelle.",
            received_at="2026-05-13T10:00:00Z",
            runtime_context=RuntimeContext(
                current_branch="codex/runtime-models",
                workspace_root="workspace",
            ),
            referenced_files=["docs/SYSTEM_IMPLEMENTATION_PLAN.md"],
        )

        restored = ChatRequest.from_json(request.to_json())

        self.assertEqual(restored.request_id, request.request_id)
        self.assertEqual(restored.runtime_context.current_branch, "codex/runtime-models")
        self.assertEqual(restored.user_preferences.language, "fr")

    def test_from_dict_coerces_enums_and_nested_models(self) -> None:
        payload = {
            "intent_type": "generate_content_batch",
            "confidence_score": 9,
            "project_required": True,
            "platforms": ["facebook"],
            "requested_volume": {
                "total_items": 70,
                "per_platform": {"facebook": 70},
            },
        }

        intent = Intent.from_dict(payload)

        self.assertEqual(intent.intent_type, IntentType.GENERATE_CONTENT_BATCH)
        self.assertEqual(intent.platforms, [Platform.FACEBOOK])
        self.assertEqual(intent.requested_volume.total_items, 70)

    def test_missing_required_field_has_readable_error(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "Missing required field 'request_id'"):
            ChatRequest.from_dict({})

    def test_from_dict_rejects_unknown_fields(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "Unknown field"):
            Intent.from_dict(
                {
                    "intent_type": "generate_content_batch",
                    "confidence_score": 9,
                    "project_required": True,
                    "silent_extra": True,
                }
            )

    def test_direct_construction_rejects_bad_nested_models(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "runtime_context"):
            ChatRequest(
                request_id="req_1",
                conversation_id="conv_1",
                user_message="Hello",
                received_at="2026-05-13T10:00:00Z",
                runtime_context={"workspace_root": "workspace"},
            )

        with self.assertRaisesRegex(ModelValidationError, "TaskGraph.nodes"):
            TaskGraph(
                task_graph_id="graph_1",
                job_id="job_1",
                nodes=[
                    {
                        "task_id": "task_a",
                        "job_id": "job_1",
                        "task_type": "agent_run",
                    }
                ],
            )

    def test_normalized_request_requires_project_when_intent_requires_it(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "project_ref is required"):
            NormalizedRequest(
                request_id="req_1",
                normalized_message="Produire un batch.",
                intent=Intent(
                    intent_type=IntentType.GENERATE_CONTENT_BATCH,
                    confidence_score=9,
                    project_required=True,
                ),
            )

    def test_project_slug_rejects_vague_or_invalid_names(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "too vague"):
            ProjectRef(
                project_slug="test",
                project_name="Test",
                root_path="workspace/projects/test",
                project_manifest_path="workspace/projects/test/manifest.json",
            )

        with self.assertRaisesRegex(ModelValidationError, "snake_case ASCII"):
            ProjectRef(
                project_slug="Coach SaaS",
                project_name="Coach SaaS",
                root_path="workspace/projects/coach_saas",
                project_manifest_path="workspace/projects/coach_saas/manifest.json",
            )

    def test_task_graph_rejects_missing_dependency_and_cycles(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "does not exist"):
            TaskGraph(
                task_graph_id="graph_1",
                job_id="job_1",
                nodes=[
                    TaskNode(
                        task_id="task_a",
                        job_id="job_1",
                        task_type=TaskType.AGENT_RUN,
                        agent_id="strategist",
                        depends_on=["task_missing"],
                    )
                ],
            )

        with self.assertRaisesRegex(ModelValidationError, "dependency cycle"):
            TaskGraph(
                task_graph_id="graph_1",
                job_id="job_1",
                nodes=[
                    TaskNode(
                        task_id="task_a",
                        job_id="job_1",
                        task_type=TaskType.AGENT_RUN,
                        agent_id="strategist",
                        depends_on=["task_b"],
                    ),
                    TaskNode(
                        task_id="task_b",
                        job_id="job_1",
                        task_type=TaskType.AGENT_RUN,
                        agent_id="growth_hacker",
                        depends_on=["task_a"],
                    ),
                ],
            )

    def test_approved_artifact_requires_human_identity(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "human_approved_by"):
            Artifact(
                artifact_id="art_1",
                job_id="job_1",
                project_slug="coach_saas",
                artifact_type=ArtifactType.JSON,
                path="strategy/growth_system.json",
                created_at="2026-05-13T10:00:00Z",
                status=ArtifactStatus.APPROVED_BY_HUMAN,
            )

    def test_quality_report_cannot_accept_failed_required_gate(self) -> None:
        with self.assertRaisesRegex(ModelValidationError, "cannot accept failed gates"):
            QualityReport(
                quality_report_id="qr_1",
                job_id="job_1",
                applies_to=QualityScope.ARTIFACT,
                target_id="art_1",
                decision=GateDecision.ACCEPT,
                overall_score=8,
                confidence_score=8,
                gate_results=[
                    GateResult(
                        gate_name="risk_gate",
                        passed=False,
                        decision=GateDecision.REJECT,
                        reasons=["unsupported_claim"],
                    )
                ],
            )

    def test_json_schema_is_exportable(self) -> None:
        schema = Job.json_schema()

        self.assertEqual(schema["title"], "Job")
        self.assertEqual(schema["type"], "object")
        self.assertIn("job_id", schema["required"])
        self.assertEqual(schema["properties"]["status"]["type"], "string")
        json.dumps(schema)


def sample_project() -> ProjectRef:
    return ProjectRef(
        project_slug="coach_saas",
        project_name="Coach SaaS",
        root_path="workspace/projects/coach_saas",
        project_manifest_path="workspace/projects/coach_saas/manifest.json",
        status=ProjectStatus.ACTIVE,
    )


if __name__ == "__main__":
    unittest.main()
