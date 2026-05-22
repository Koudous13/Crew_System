import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.core.models import JobStatus
from crew_system.agents import MockAgentRunner
from crew_system.filesystem import WorkspaceEngine
from crew_system.jobs import JobStore, LocalWorker


class JobStoreWorkerTest(unittest.TestCase):
    def test_job_store_persists_progress_checkpoint_and_cancel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")
            store = JobStore(engine)

            stored = store.create(
                project_slug="coach_saas",
                request_message="Genere 10 posts Facebook.",
                active_project_hint="coach_saas",
            )
            loaded = store.load("coach_saas", stored.job_id)
            cancelled = store.cancel("coach_saas", stored.job_id)

            project_root = Path(temp_dir, "projects/coach_saas")
            progress_events = read_jsonl(project_root / f"logs/jobs/{stored.job_id}/progress_events.jsonl")

            self.assertEqual(loaded.status, JobStatus.QUEUED)
            self.assertEqual(cancelled.status, JobStatus.CANCELLED)
            self.assertFalse(cancelled.can_resume)
            self.assertGreaterEqual(len(progress_events), 2)

    def test_local_worker_runs_stored_job_with_stable_job_id(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            project = engine.create_project("Coach SaaS")
            seed_strategy_context(Path(project.root_path))
            worker = LocalWorker(
                repo_root=ROOT,
                workspace_root=temp_dir,
                runner=MockAgentRunner(),
            )

            stored = worker.enqueue(
                project_slug="coach_saas",
                message="Genere 10 publications facebook pour le projet coach_saas.",
            )
            result = worker.run(project_slug="coach_saas", job_id=stored.job_id)
            loaded = worker.store.load("coach_saas", stored.job_id)
            checkpoint = worker.store.load_checkpoint("coach_saas", stored.job_id)

            project_root = Path(temp_dir, "projects/coach_saas")
            progress_events = read_jsonl(project_root / f"logs/jobs/{stored.job_id}/progress_events.jsonl")
            self.assertEqual(result.stored_job.job_id, stored.job_id)
            self.assertEqual(result.local_result.job.job_id, stored.job_id)
            self.assertIn(loaded.status, {JobStatus.COMPLETED, JobStatus.NEEDS_REVISION})
            self.assertTrue(loaded.artifacts_created)
            self.assertIsNotNone(checkpoint)
            self.assertTrue(
                any(
                    str(event["current_phase"]).startswith("agent:copywriter:chunk:")
                    for event in progress_events
                )
            )
            self.assertTrue((project_root / f"logs/jobs/{stored.job_id}/job_state.json").exists())
            self.assertTrue((project_root / f"outputs/batches/{stored.job_id}/content_batch.md").exists())
            self.assertTrue((project_root / f"outputs/batches/{stored.job_id}/facebook_posts_ready.md").exists())


def seed_strategy_context(project_root: Path) -> None:
    (project_root / "brief/normalized_brief.json").write_text(
        '{"project": "Coach SaaS", "audience": "coachs premium"}',
        encoding="utf-8",
    )
    files = {
        "strategy/strategic_diagnosis.md": "# Diagnostic\n\ncoach premium facebook growth leads",
        "strategy/audience_intelligence.md": "# Audience\n\ncoach premium",
        "strategy/positioning.md": "# Positioning\n\nautorite coach premium",
        "strategy/influence_architecture.md": "# Influence\n\ntension preuve conversation",
        "strategy/growth_system.md": "# Growth\n\nboucle conversation leads",
        "calendar/annual_editorial_calendar.md": "# Calendar\n\nweek 1 growth",
        "platforms/facebook_strategy.md": "# Facebook\n\nconversation posts",
    }
    for relative_path, content in files.items():
        path = project_root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


if __name__ == "__main__":
    unittest.main()
