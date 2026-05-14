import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.agents import AgentOutput
from crew_system.core.models import (
    ArtifactStatus,
    ArtifactType,
    GateDecision,
    GateResult,
    IntentType,
    Job,
    JobStatus,
    JobType,
    QualityReport,
    QualityScope,
)
from crew_system.filesystem import WorkspaceEngine, WriteMode
from crew_system.runtime import DeliverableWriter, WritePlan, WriteTarget, build_write_plan


class DeliverableWriterTest(unittest.TestCase):
    def test_writes_content_batch_markdown_json_quality_and_registers_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")
            job = sample_job()
            plan = build_write_plan(job)

            result = DeliverableWriter(engine).write(
                plan=plan,
                quality_report=sample_quality_report(),
                agent_outputs={"copywriter": sample_agent_output()},
                agents_used=["copywriter"],
            )

            project_root = Path(temp_dir, "projects/coach_saas")
            markdown_path = project_root / "outputs/batches/job_1/content_batch.md"
            json_path = project_root / "outputs/batches/job_1/content_batch.json"
            ready_path = project_root / "outputs/batches/job_1/facebook_posts_ready.md"
            quality_path = project_root / "reviews/quality_reviews/job_1_quality_report.json"
            artifact_log = read_jsonl(project_root / "logs/artifacts.jsonl")

            self.assertTrue(markdown_path.exists())
            self.assertTrue(json_path.exists())
            self.assertTrue(ready_path.exists())
            self.assertTrue(quality_path.exists())
            self.assertIn("job_id: job_1", markdown_path.read_text(encoding="utf-8"))
            self.assertIn("copywriter", markdown_path.read_text(encoding="utf-8"))
            ready_text = ready_path.read_text(encoding="utf-8")
            self.assertIn("# Publications Facebook pretes a relire", ready_text)
            self.assertIn("## Publication 1", ready_text)
            self.assertIn("Hook fort", ready_text)
            self.assertIn("Texte complet de la publication", ready_text)
            self.assertNotIn("Agent Outputs", ready_text)
            payload = json.loads(json_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["job_id"], "job_1")
            self.assertEqual(payload["status"], "ready_for_human_review")
            self.assertEqual(payload["agents_used"], ["copywriter"])
            self.assertEqual(len(result.artifacts), len(plan.files))
            self.assertEqual(len(artifact_log), len(plan.files))
            self.assertTrue(all(artifact.status is ArtifactStatus.READY_FOR_HUMAN_REVIEW for artifact in result.artifacts))

    def test_versioned_overwrite_keeps_previous_revision(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")
            plan = WritePlan(
                job_id="job_1",
                project_slug="coach_saas",
                files=[
                    WriteTarget(
                        relative_path="outputs/batches/job_1/content_batch.md",
                        artifact_type=ArtifactType.MARKDOWN,
                        write_mode=WriteMode.OVERWRITE_WITH_VERSION,
                        source_task_id="write_artifacts",
                    )
                ],
            )
            writer = DeliverableWriter(engine)

            writer.write(
                plan=plan,
                quality_report=sample_quality_report(),
                agent_outputs={"growth_hacker": sample_agent_output("first loop")},
                agents_used=["growth_hacker"],
            )
            writer.write(
                plan=plan,
                quality_report=sample_quality_report(),
                agent_outputs={"growth_hacker": sample_agent_output("second loop")},
                agents_used=["growth_hacker"],
            )

            project_root = Path(temp_dir, "projects/coach_saas")
            version_path = project_root / "outputs/batches/job_1/versions/content_batch_v001.md"
            current = project_root / "outputs/batches/job_1/content_batch.md"
            self.assertTrue(version_path.exists())
            self.assertIn("first loop", version_path.read_text(encoding="utf-8"))
            self.assertIn("second loop", current.read_text(encoding="utf-8"))


def sample_job() -> Job:
    return Job(
        job_id="job_1",
        job_type=JobType.CONTENT_BATCH,
        project_slug="coach_saas",
        intent_type=IntentType.GENERATE_CONTENT_BATCH,
        created_at="2026-05-14T10:00:00Z",
        updated_at="2026-05-14T10:00:00Z",
        task_graph_id="graph_1",
        status=JobStatus.QUEUED,
        expected_artifacts=[
            "outputs/batches/job_1/content_batch.md",
            "outputs/batches/job_1/content_batch.json",
            "outputs/batches/job_1/facebook_posts_ready.md",
        ],
    )


def sample_quality_report() -> QualityReport:
    return QualityReport(
        quality_report_id="qr_1",
        job_id="job_1",
        applies_to=QualityScope.ARTIFACT,
        target_id="content_batch",
        decision=GateDecision.ACCEPT,
        overall_score=8,
        confidence_score=8,
        gate_results=[
            GateResult(
                gate_name="final_readiness_gate",
                passed=True,
                decision=GateDecision.ACCEPT,
                score=8,
            )
        ],
    )


def sample_agent_output(summary: str = "comment-to-lead loop") -> AgentOutput:
    return AgentOutput(
        agent_id="copywriter",
        schema_name="ContentUnits",
        payload={
            "content_units": {
                "unit_1": {
                    "platform": "facebook",
                    "content_type": "text",
                    "hook": "Hook fort",
                    "body": "Texte complet de la publication.",
                    "cta": "Commentez CLARTE.",
                    "visual_requirement": "Visuel simple avec le hook.",
                    "risk_flag": "low",
                    "risk_note": summary,
                }
            }
        },
        quality_score=8,
        confidence_score=8,
        weakest_point="mock",
        next_improvement="real run",
    )


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


if __name__ == "__main__":
    unittest.main()
