import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.config import (
    ENV_REPO_ROOT,
    ENV_WORKSPACE_ROOT,
    CrewSystemSettings,
)


class SettingsTest(unittest.TestCase):
    def test_discovers_repo_and_relative_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / ".git").mkdir()
            (root / "docs").mkdir()
            (root / "registry").mkdir()

            settings = CrewSystemSettings.discover(
                start=root / "docs",
                env={ENV_WORKSPACE_ROOT: "runtime_workspace"},
            )

            self.assertEqual(settings.repo_root, root.resolve())
            self.assertEqual(settings.workspace_root, (root / "runtime_workspace").resolve())

    def test_explicit_repo_root_env_wins(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / ".git").mkdir()
            (root / "docs").mkdir()
            (root / "registry").mkdir()

            settings = CrewSystemSettings.discover(
                start=Path.cwd(),
                env={ENV_REPO_ROOT: str(root)},
            )

            self.assertEqual(settings.repo_root, root.resolve())


if __name__ == "__main__":
    unittest.main()
