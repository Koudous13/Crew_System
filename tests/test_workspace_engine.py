import json
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.core.models import Artifact, ArtifactStatus, ArtifactType
from crew_system.filesystem import (
    FileSystemError,
    SafeFileWriter,
    WorkspaceEngine,
    WriteMode,
    slugify_project_name,
)


class SafeFileWriterTest(unittest.TestCase):
    def test_create_skip_and_versioned_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            writer = SafeFileWriter(temp_dir)

            created = writer.write_text(
                "strategy/positioning.md",
                "version one",
                job_id="job_1",
                mode=WriteMode.CREATE,
            )
            skipped = writer.write_text(
                "strategy/positioning.md",
                "ignored",
                job_id="job_1",
                mode=WriteMode.SKIP_IF_EXISTS,
            )
            overwritten = writer.write_text(
                "strategy/positioning.md",
                "version two",
                job_id="job_2",
                mode=WriteMode.OVERWRITE_WITH_VERSION,
            )

            self.assertTrue(created.written)
            self.assertTrue(skipped.skipped)
            self.assertTrue(overwritten.written)
            self.assertEqual(Path(temp_dir, "strategy/positioning.md").read_text(), "version two")
            self.assertEqual(
                Path(temp_dir, overwritten.version_relative_path).read_text(),
                "version one",
            )

    def test_append_accumulates_and_hashes_full_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            writer = SafeFileWriter(temp_dir)

            writer.write_text("logs/jobs.jsonl", "first\n", job_id="job_1", mode=WriteMode.APPEND)
            result = writer.write_text(
                "logs/jobs.jsonl",
                "second\n",
                job_id="job_2",
                mode=WriteMode.APPEND,
            )

            full_content = "first\nsecond\n"
            self.assertEqual(Path(temp_dir, "logs/jobs.jsonl").read_text(), full_content)
            self.assertEqual(result.bytes_written, len("second\n"))
            self.assertEqual(result.content_hash, hashlib.sha256(full_content.encode()).hexdigest())

    def test_temp_paths_are_unique_for_shared_job_and_target(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            writer = SafeFileWriter(temp_dir)

            first = writer._tmp_path("project_manifest", "manifest.json")
            second = writer._tmp_path("project_manifest", "manifest.json")

            self.assertNotEqual(first, second)
            self.assertEqual(first.parent, second.parent)

    def test_rejects_absolute_and_parent_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            writer = SafeFileWriter(temp_dir)

            with self.assertRaises(FileSystemError):
                writer.write_text("../escape.md", "bad", job_id="job_1")

            with self.assertRaises(FileSystemError):
                writer.write_text(Path(temp_dir).parent / "escape.md", "bad", job_id="job_1")


class WorkspaceEngineTest(unittest.TestCase):
    def test_initialize_workspace_creates_manifest_and_roots(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)

            manifest = engine.initialize_workspace()

            self.assertTrue(Path(temp_dir, "workspace_manifest.json").exists())
            self.assertEqual(manifest.projects_root, "projects")
            for dirname in [
                "projects",
                "global_registry",
                "templates",
                "exports",
                "archives",
                "tmp",
                "logs",
            ]:
                self.assertTrue(Path(temp_dir, dirname).is_dir())

    def test_create_project_creates_canonical_structure_and_manifests(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)

            project_ref = engine.create_project(
                "Coach SaaS",
                description="Strategie de croissance pour coachs.",
                owner="koudous",
            )

            project_root = Path(project_ref.root_path)
            self.assertEqual(project_ref.project_slug, "coach_saas")
            self.assertTrue((project_root / "manifest.json").exists())
            self.assertTrue((project_root / "README.md").exists())
            self.assertTrue((project_root / "brief/normalized_brief.json").exists())
            self.assertTrue((project_root / "strategy").is_dir())
            self.assertTrue((project_root / "outputs/batches").is_dir())
            self.assertTrue((project_root / "logs/jobs.jsonl").exists())
            self.assertTrue((project_root / "logs/decisions.md").exists())
            normalized_brief = json.loads((project_root / "brief/normalized_brief.json").read_text(encoding="utf-8"))

            project_manifest = engine.load_project_manifest("coach_saas")
            workspace_manifest = engine.load_workspace_manifest()

            self.assertEqual(project_manifest.project_name, "Coach SaaS")
            self.assertEqual(project_manifest.current_state["strategy_ready"], False)
            self.assertEqual(normalized_brief["project_slug"], "coach_saas")
            self.assertEqual(normalized_brief["description"], "Strategie de croissance pour coachs.")
            self.assertEqual(normalized_brief["active_platforms"], ["facebook", "linkedin"])
            self.assertIn("coach_saas", workspace_manifest.active_projects)

    def test_project_slug_collision_is_resolved(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")

            self.assertEqual(engine.suggest_project_slug("Coach SaaS"), "coach_saas_2")

    def test_vague_project_slug_is_rejected(self) -> None:
        with self.assertRaises(FileSystemError):
            slugify_project_name("   ")

        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            with self.assertRaises(FileSystemError):
                engine.create_project("Test")

            with self.assertRaises(FileSystemError):
                engine.create_project("Coach SaaS", project_slug="Bad Slug")

    def test_logs_and_artifacts_are_recorded(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")
            engine.create_job_folder("coach_saas", "job_1")

            engine.append_job_log(
                "coach_saas",
                {
                    "job_id": "job_1",
                    "request_id": "req_1",
                    "intent_type": "generate_content_batch",
                    "status": "completed",
                    "artifacts_created": ["art_1"],
                    "quality_score": 9,
                },
            )
            engine.append_agent_run_log(
                "coach_saas",
                {
                    "agent_run_id": "run_1",
                    "job_id": "job_1",
                    "agent_id": "growth_hacker",
                    "status": "completed",
                    "quality_score": 9,
                    "confidence_score": 8,
                    "output_artifacts": ["art_1"],
                },
            )
            artifact = Artifact(
                artifact_id="art_1",
                job_id="job_1",
                project_slug="coach_saas",
                artifact_type=ArtifactType.MARKDOWN,
                path="outputs/batches/week_04_facebook_70/content_batch.md",
                created_at="2026-05-13T10:00:00Z",
                status=ArtifactStatus.READY_FOR_HUMAN_REVIEW,
                created_by_agents=["growth_hacker"],
            )
            engine.register_artifact(artifact, content_hash="abc123")

            project_root = Path(temp_dir, "projects/coach_saas")
            jobs = read_jsonl(project_root / "logs/jobs.jsonl")
            agent_runs = read_jsonl(project_root / "logs/agent_runs.jsonl")
            artifacts = read_jsonl(project_root / "logs/artifacts.jsonl")
            manifest = engine.load_project_manifest("coach_saas")

            self.assertEqual(jobs[0]["job_id"], "job_1")
            self.assertEqual(agent_runs[0]["agent_id"], "growth_hacker")
            self.assertEqual(artifacts[0]["artifact_id"], "art_1")
            self.assertEqual(artifacts[0]["hash"], "abc123")
            self.assertEqual(artifacts[0]["version"], "v001")
            self.assertEqual(manifest.current_state["last_job_id"], "job_1")

    def test_archive_artifact_moves_file_and_records_decision(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")
            writer = SafeFileWriter(Path(temp_dir, "projects/coach_saas"))
            writer.write_text(
                "outputs/batches/week_04/content_batch.md",
                "old batch",
                job_id="job_1",
                mode=WriteMode.CREATE,
            )

            record = engine.archive_artifact(
                "coach_saas",
                artifact_id="art_1",
                original_relative_path="outputs/batches/week_04/content_batch.md",
                reason="superseded by revision",
                archived_by_job_id="job_2",
            )

            project_root = Path(temp_dir, "projects/coach_saas")
            self.assertFalse((project_root / "outputs/batches/week_04/content_batch.md").exists())
            self.assertTrue((project_root / record.archive_path).exists())
            self.assertIn("archive_artifact", (project_root / "logs/decisions.md").read_text())


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


if __name__ == "__main__":
    unittest.main()
