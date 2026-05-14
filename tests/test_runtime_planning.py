import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.core.models import (
    ChatRequest,
    IntentType,
    JobStatus,
    Platform,
    ProjectResolutionMode,
    ProjectStatus,
    RuntimeContext,
)
from crew_system.filesystem import WorkspaceEngine
from crew_system.registry import load_registry
from crew_system.runtime import (
    ContextLoader,
    JobPlanner,
    ProjectResolver,
    RequestNormalizer,
    RequestNormalizationError,
    RuleBasedIntentParser,
)


class RuntimePlanningTest(unittest.TestCase):
    def test_full_request_to_job_plan_uses_registry_and_context(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")
            write_complete_strategy_pack(Path(temp_dir, "projects/coach_saas"))

            chat_request = make_chat_request(
                "Genere 70 publications Facebook avec visuels pour le projet Coach SaaS. "
                "Je veux du growth hack et une viralisation propre."
            )
            parser = RuleBasedIntentParser()
            intent = parser.parse(chat_request)
            resolution = ProjectResolver(engine).resolve(chat_request, intent)
            normalized = RequestNormalizer().normalize(chat_request, intent, resolution)
            context = ContextLoader(engine).load("job_context_1", normalized)
            plan = JobPlanner(load_registry(ROOT)).plan(normalized, context)

            self.assertEqual(intent.intent_type, IntentType.GENERATE_CONTENT_BATCH)
            self.assertEqual(intent.platforms, [Platform.FACEBOOK])
            self.assertEqual(intent.requested_volume.total_items, 70)
            self.assertTrue(intent.requested_assets.images)
            self.assertEqual(resolution.mode, ProjectResolutionMode.EXPLICIT)
            self.assertEqual(context.missing_files, [])
            self.assertEqual(plan.job.status, JobStatus.QUEUED)
            self.assertIn("facebook_native_agent", plan.selected_agents)
            self.assertIn("growth_hacker", plan.selected_agents)
            self.assertIn("creative_director", plan.selected_agents)
            self.assertIn("risk_reviewer", plan.selected_agents)
            self.assertIn("hook_master", plan.selected_agents)
            self.assertIn("copywriter", plan.selected_agents)
            self.assertNotIn("calendar_architect", plan.selected_agents)
            self.assertNotIn("linkedin_native_agent", plan.selected_agents)
            self.assertTrue(plan.agent_reasons["growth_hacker"].startswith("conditional_route"))

            nodes = {node.task_id: node for node in plan.task_graph.nodes}
            self.assertIn("agent_facebook_native_agent", nodes["agent_copywriter"].depends_on)
            self.assertIn("agent_hook_master", nodes["agent_copywriter"].depends_on)
            self.assertTrue(nodes["agent_copywriter"].reason)
            self.assertIn("write_artifacts", nodes)
            self.assertIn(
                f"outputs/batches/{plan.job.job_id}/facebook_posts_ready.md",
                plan.job.expected_artifacts,
            )

    def test_campaign_pack_writes_context_needed_by_later_content_batches(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")

            chat_request = make_chat_request(
                "Cree la strategie complete Facebook et LinkedIn pour le projet Coach SaaS."
            )
            intent = RuleBasedIntentParser().parse(chat_request)
            resolution = ProjectResolver(engine).resolve(chat_request, intent)
            normalized = RequestNormalizer().normalize(chat_request, intent, resolution)
            context = ContextLoader(engine).load("job_context_campaign", normalized)
            plan = JobPlanner(load_registry(ROOT)).plan(normalized, context)

            self.assertEqual(plan.job.status, JobStatus.QUEUED)
            self.assertNotIn("calendar_architect", plan.selected_agents)
            self.assertIn("platforms/facebook_strategy.md", plan.job.expected_artifacts)
            self.assertIn("platforms/linkedin_strategy.md", plan.job.expected_artifacts)

    def test_massive_content_batch_blocks_when_strategy_context_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")

            chat_request = make_chat_request(
                "Fais 70 posts Facebook pour la semaine 4.",
                active_project_hint="coach_saas",
            )
            intent = RuleBasedIntentParser().parse(chat_request)
            resolution = ProjectResolver(engine).resolve(chat_request, intent)
            normalized = RequestNormalizer().normalize(chat_request, intent, resolution)
            context = ContextLoader(engine).load("job_context_2", normalized)
            plan = JobPlanner(load_registry(ROOT)).plan(normalized, context)

            self.assertIn("strategy/growth_system.md", context.missing_files)
            self.assertEqual(plan.job.status, JobStatus.WAITING_FOR_USER)
            self.assertEqual(plan.selected_agents, [])
            self.assertEqual(plan.task_graph.nodes[0].task_id, "human_clarification")
            self.assertTrue(any(reason.startswith("missing_context:") for reason in plan.blocked_reasons))

    def test_content_request_that_mentions_calendar_still_routes_to_content_batch(self) -> None:
        chat_request = make_chat_request(
            "Produis 3 publications Facebook pour la premiere semaine, "
            "en te basant sur le calendrier annuel."
        )

        intent = RuleBasedIntentParser().parse(chat_request)

        self.assertEqual(intent.intent_type, IntentType.GENERATE_CONTENT_BATCH)
        self.assertEqual(intent.requested_volume.total_items, 3)

    def test_project_resolver_detects_ambiguous_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            engine.create_project("Coach SaaS")
            engine.create_project("Fitness SaaS")

            chat_request = make_chat_request("Fais 70 posts Facebook.")
            intent = RuleBasedIntentParser().parse(chat_request)
            resolution = ProjectResolver(engine).resolve(chat_request, intent)

            self.assertEqual(resolution.mode, ProjectResolutionMode.AMBIGUOUS)
            self.assertEqual(sorted(resolution.candidates), ["coach_saas", "fitness_saas"])
            with self.assertRaises(RequestNormalizationError):
                RequestNormalizer().normalize(chat_request, intent, resolution)

    def test_new_project_request_resolves_as_draft_project_ref(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = WorkspaceEngine(temp_dir)
            chat_request = make_chat_request(
                "Cree un projet SaaS Coach Premium pour aider les coachs a vendre."
            )

            intent = RuleBasedIntentParser().parse(chat_request)
            resolution = ProjectResolver(engine).resolve(chat_request, intent)

            self.assertEqual(intent.intent_type, IntentType.CREATE_PROJECT_FROM_IDEA)
            self.assertEqual(resolution.mode, ProjectResolutionMode.NEW_PROJECT)
            self.assertEqual(resolution.project_ref.project_slug, "coach_premium")
            self.assertEqual(resolution.project_ref.status, ProjectStatus.DRAFT)


def make_chat_request(message: str, *, active_project_hint: str = "") -> ChatRequest:
    return ChatRequest(
        request_id="req_1",
        conversation_id="conv_1",
        user_message=message,
        received_at="2026-05-13T10:00:00Z",
        active_project_hint=active_project_hint,
        runtime_context=RuntimeContext(
            current_branch="codex/runtime-planning-core",
            workspace_root="workspace",
        ),
    )


def write_complete_strategy_pack(project_root: Path) -> None:
    (project_root / "brief/normalized_brief.json").write_text(
        '{"project": "Coach SaaS", "audience": "coachs premium"}',
        encoding="utf-8",
    )
    files = {
        "strategy/strategic_diagnosis.md": "# Diagnostic\n\nMarche premium.",
        "strategy/audience_intelligence.md": "# Audience\n\nCoachs ambitieux.",
        "strategy/positioning.md": "# Positioning\n\nAutorite calme.",
        "strategy/influence_architecture.md": "# Influence\n\nDesir, preuve, projection.",
        "strategy/growth_system.md": "# Growth\n\nBoucles commentaires et leads.",
        "calendar/annual_editorial_calendar.md": "# Calendar\n\nSemaine 4: acquisition.",
        "platforms/facebook_strategy.md": "# Facebook\n\nPosts courts, conversations.",
    }
    for relative_path, content in files.items():
        path = project_root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
