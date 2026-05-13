import contextlib
import io
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.cli.main import main


class CliDoctorTest(unittest.TestCase):
    def test_doctor_reports_foundation_ok(self) -> None:
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            exit_code = main(["doctor", "--repo-root", str(ROOT), "--json"])

        payload = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["version"], "0.1.0")
        self.assertIn("checks", payload)


if __name__ == "__main__":
    unittest.main()
