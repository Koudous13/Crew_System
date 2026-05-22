import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.cli.main import main
from crew_system.cli.main import runner_for_provider
from crew_system.agents import LLMAgentRunner, MockAgentRunner
from crew_system.filesystem import WorkspaceEngine
from crew_system.llm import LLMConfigurationError


class CliRuntimeTest(unittest.TestCase):
    def test_runner_provider_selection_uses_gemini_for_auto_without_implicit_fallback(self) -> None:
        with self.assertRaisesRegex(LLMConfigurationError, "GEMINI_API_KEY"):
            runner_for_provider("auto", env={})

        explicit_mock_runner, explicit_mock_provider = runner_for_provider("mock", env={})
        explicit_deepseek_runner, explicit_deepseek_provider = runner_for_provider(
            "deepseek",
            env={"DEEPSEEK_API_KEY": "local-secret-value"},
        )
        gemini_runner, gemini_provider = runner_for_provider(
            "auto",
            env={
                "GEMINI_API_KEY": "local-secret-value",
                "DEEPSEEK_API_KEY": "other-secret-value",
            },
        )

        self.assertIsInstance(explicit_mock_runner, MockAgentRunner)
        self.assertEqual(explicit_mock_provider, "mock")
        self.assertIsInstance(explicit_deepseek_runner, LLMAgentRunner)
        self.assertEqual(explicit_deepseek_provider, "deepseek")
        self.assertIsInstance(gemini_runner, LLMAgentRunner)
        self.assertEqual(gemini_provider, "gemini")

    def test_init_workspace_create_project_and_registry_validate(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            init_payload = run_cli_json(
                [
                    "init-workspace",
                    "--repo-root",
                    str(ROOT),
                    "--workspace-root",
                    temp_dir,
                    "--json",
                ]
            )
            project_payload = run_cli_json(
                [
                    "create-project",
                    "Coach SaaS",
                    "--repo-root",
                    str(ROOT),
                    "--workspace-root",
                    temp_dir,
                    "--json",
                ]
            )
            registry_payload = run_cli_json(
                ["registry", "validate", "--repo-root", str(ROOT), "--json"]
            )

            self.assertTrue(init_payload["ok"])
            self.assertEqual(project_payload["project"]["project_slug"], "coach_saas")
            self.assertTrue(registry_payload["ok"])

    def test_run_content_batch_mock_writes_files_and_job_status(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            project = engine.create_project("Coach SaaS")
            seed_strategy_context(Path(project.root_path))

            run_payload = run_cli_json(
                [
                    "run",
                    "content-batch",
                    "--project",
                    "coach_saas",
                    "--platform",
                    "facebook",
                    "--count",
                    "10",
                    "--mock",
                    "--repo-root",
                    str(ROOT),
                    "--workspace-root",
                    temp_dir,
                    "--json",
                ]
            )
            job_id = run_payload["job"]["job_id"]
            status_payload = run_cli_json(
                [
                    "job",
                    "status",
                    job_id,
                    "--project",
                    "coach_saas",
                    "--repo-root",
                    str(ROOT),
                    "--workspace-root",
                    temp_dir,
                    "--json",
                ]
            )

            project_root = Path(temp_dir, "projects/coach_saas")
            self.assertTrue(run_payload["ok"])
            self.assertEqual(run_payload["provider"], "mock")
            self.assertEqual(status_payload["job"]["job_id"], job_id)
            self.assertTrue((project_root / f"outputs/batches/{job_id}/content_batch.md").exists())
            self.assertTrue((project_root / f"outputs/batches/{job_id}/content_batch.json").exists())
            self.assertTrue((project_root / f"outputs/batches/{job_id}/facebook_posts_ready.md").exists())
            self.assertTrue(run_payload["artifacts"])

    def test_content_batch_message_override_keeps_cli_volume_and_platform(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            project = engine.create_project("Coach SaaS")
            seed_strategy_context(Path(project.root_path))

            run_payload = run_cli_json(
                [
                    "run",
                    "content-batch",
                    "--project",
                    "coach_saas",
                    "--platform",
                    "facebook",
                    "--count",
                    "3",
                    "--message",
                    "Produis un batch persuasif propre pour vendre un SaaS aux coachs premium.",
                    "--mock",
                    "--repo-root",
                    str(ROOT),
                    "--workspace-root",
                    temp_dir,
                    "--json",
                ]
            )

            self.assertTrue(run_payload["ok"])
            self.assertEqual(run_payload["provider"], "mock")
            self.assertNotIn("missing_information:volume", run_payload["errors"])


def run_cli_json(args: list[str]) -> dict:
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        exit_code = main(args)
    payload = json.loads(output.getvalue())
    if exit_code != 0:
        raise AssertionError(payload)
    return payload


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


if __name__ == "__main__":
    unittest.main()
