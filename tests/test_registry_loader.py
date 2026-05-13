import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.core.models import AgentDefinitionStatus, IntentType
from crew_system.registry import RegistryError, load_registry, validate_registry
from crew_system.registry.simple_yaml import loads_yaml
from crew_system.registry.validator import RegistryValidator


class SimpleYamlTest(unittest.TestCase):
    def test_parses_nested_mapping_lists_and_scalars(self) -> None:
        parsed = loads_yaml(
            """
root:
  name: "Growth Hacker"
  active: true
  score: 8
  empty_list: []
  items:
    - "alpha"
    - "beta"
  cases:
    -
      case_id: "case_1"
      expected:
        - "schema_discipline"
"""
        )

        self.assertEqual(parsed["root"]["name"], "Growth Hacker")
        self.assertEqual(parsed["root"]["active"], True)
        self.assertEqual(parsed["root"]["score"], 8)
        self.assertEqual(parsed["root"]["empty_list"], [])
        self.assertEqual(parsed["root"]["items"], ["alpha", "beta"])
        self.assertEqual(parsed["root"]["cases"][0]["case_id"], "case_1")
        self.assertEqual(parsed["root"]["cases"][0]["expected"], ["schema_discipline"])


class RegistryLoaderTest(unittest.TestCase):
    def test_loads_all_agents_and_assets(self) -> None:
        registry = load_registry(ROOT)

        self.assertEqual(len(registry.agents), 18)
        self.assertIn("growth_hacker", registry.agent_ids())
        self.assertIn("systeme growth", registry.get_prompt("growth_hacker"))
        self.assertEqual(registry.get_schema("growth_hacker")["x-agent-id"], "growth_hacker")
        self.assertEqual(
            registry.get_eval("growth_hacker")["agent_eval"]["agent_id"],
            "growth_hacker",
        )

    def test_agent_definition_projection_is_runtime_ready(self) -> None:
        registry = load_registry(ROOT)

        definition = registry.get_agent_definition("growth_hacker")

        self.assertEqual(definition.agent_id, "growth_hacker")
        self.assertEqual(definition.status, AgentDefinitionStatus.DRAFT)
        self.assertEqual(definition.output_schema_name, "GrowthSystem")
        self.assertIn("growth_loop_design", definition.capabilities)
        self.assertIn("normalized_brief", definition.required_inputs)

    def test_agents_for_intent_uses_routing_and_platforms(self) -> None:
        registry = load_registry(ROOT)

        selection = registry.agents_for_intent(
            IntentType.GENERATE_CONTENT_BATCH,
            platforms=["facebook"],
        )
        rich_selection = registry.agents_for_intent(
            IntentType.GENERATE_CONTENT_BATCH,
            platforms=["facebook"],
            include_optional=True,
            include_conditional=True,
        )

        self.assertEqual(selection.required[0], "strategist")
        self.assertIn("facebook_native_agent", selection.all_agent_ids)
        self.assertNotIn("growth_hacker", selection.all_agent_ids)
        self.assertIn("growth_hacker", rich_selection.all_agent_ids)
        self.assertIn("creative_director", rich_selection.all_agent_ids)

    def test_unknown_intent_fails_clearly(self) -> None:
        registry = load_registry(ROOT)

        with self.assertRaisesRegex(RegistryError, "Unknown intent routing"):
            registry.agents_for_intent("not_an_intent")

        with self.assertRaisesRegex(RegistryError, "Unknown platform"):
            registry.agents_for_intent(
                IntentType.GENERATE_CONTENT_BATCH,
                platforms=["instagram"],
            )

    def test_registry_paths_cannot_escape_repo_root(self) -> None:
        registry = load_registry(ROOT)

        with self.assertRaisesRegex(RegistryError, "escapes repo root"):
            registry.get_agent("growth_hacker").prompt_path = "../README.md"
            registry.get_prompt("growth_hacker")

    def test_registry_validation_passes_current_registry(self) -> None:
        registry = load_registry(ROOT)
        report = RegistryValidator(registry).validate()

        self.assertTrue(report.ok)
        self.assertEqual(report.agent_count, 18)
        self.assertEqual(report.draft_agent_count, 18)
        self.assertEqual(report.active_agent_count, 0)
        self.assertEqual(report.errors, [])

    def test_registry_validation_detects_missing_prompt(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            shutil.copytree(ROOT / "registry", temp_root / "registry")
            (temp_root / "registry/prompts/growth_hacker.system.txt").unlink()

            report = validate_registry(temp_root)

            self.assertFalse(report.ok)
            self.assertTrue(
                any("growth_hacker.system.txt" in error for error in report.errors)
            )

    def test_registry_validation_detects_unknown_routed_agent(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            shutil.copytree(ROOT / "registry", temp_root / "registry")
            intents_path = temp_root / "registry/routing/intents.yaml"
            intents_path.write_text(
                intents_path.read_text(encoding="utf-8").replace(
                    '- "strategist"',
                    '- "unknown_agent"',
                    1,
                ),
                encoding="utf-8",
            )

            report = validate_registry(temp_root)

            self.assertFalse(report.ok)
            self.assertTrue(any("unknown_agent" in error for error in report.errors))


if __name__ == "__main__":
    unittest.main()
