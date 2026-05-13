import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import crew_system
from crew_system.config import CrewSystemSettings


class PackageSmokeTest(unittest.TestCase):
    def test_package_imports(self) -> None:
        self.assertEqual(crew_system.__version__, "0.1.0")

    def test_settings_discover_repo(self) -> None:
        settings = CrewSystemSettings.discover(start=ROOT)
        self.assertEqual(settings.repo_root, ROOT)
        self.assertEqual(settings.registry_root, ROOT / "registry")
        self.assertEqual(settings.docs_root, ROOT / "docs")


if __name__ == "__main__":
    unittest.main()
