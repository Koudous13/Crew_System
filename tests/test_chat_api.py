import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.api import ChatApiService, make_api_server


class ChatApiTest(unittest.TestCase):
    def test_http_api_lists_projects_for_frontend(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with running_api(temp_dir) as base_url:
                api_post(base_url, "/projects", {"name": "Coach SaaS"}, expected_status=201)

                projects = api_get(base_url, "/projects")

                self.assertEqual(projects["projects"][0]["project_slug"], "coach_saas")

    def test_http_api_runs_chat_job_exposes_artifacts_and_validation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with running_api(temp_dir) as base_url:
                project_payload = api_post(
                    base_url,
                    "/projects",
                    {"name": "Coach SaaS", "description": "SaaS pour coachs premium"},
                    expected_status=201,
                )
                project_slug = project_payload["project"]["project_slug"]
                seed_strategy_context(Path(project_payload["project"]["root_path"]))

                conversation_payload = api_post(
                    base_url,
                    "/conversations",
                    {"project_slug": project_slug, "title": "Batch Facebook"},
                    expected_status=201,
                )
                conversation_id = conversation_payload["conversation"]["conversation_id"]
                run_payload = api_post(
                    base_url,
                    f"/conversations/{conversation_id}/messages",
                    {
                        "message": (
                            "Genere 3 publications facebook pour le projet coach_saas. "
                            "Plateforme cible: facebook. Volume cible: 3 publications facebook."
                        ),
                        "provider": "mock",
                        "run_async": False,
                    },
                )
                job_id = run_payload["job"]["job_id"]

                job_payload = api_get(base_url, f"/jobs/{project_slug}/{job_id}")
                events_payload = api_get(base_url, f"/jobs/{project_slug}/{job_id}/events")
                artifacts_payload = api_get(
                    base_url,
                    "/artifacts",
                    {"project_slug": project_slug, "job_id": job_id},
                )
                markdown_artifact = next(
                    artifact
                    for artifact in artifacts_payload["artifacts"]
                    if artifact["path"].endswith(".md")
                )
                artifact_payload = api_get(
                    base_url,
                    "/artifact",
                    {"project_slug": project_slug, "artifact_id": markdown_artifact["artifact_id"]},
                )
                validation_payload = api_post(
                    base_url,
                    "/artifacts/validate",
                    {
                        "project_slug": project_slug,
                        "artifact_id": markdown_artifact["artifact_id"],
                        "approved_by": "Koudous",
                        "notes": "Validation test API",
                    },
                )
                validated_artifacts_payload = api_get(
                    base_url,
                    "/artifacts",
                    {"project_slug": project_slug, "job_id": job_id},
                )
                validations_payload = api_get(
                    base_url,
                    "/validations",
                    {"project_slug": project_slug, "artifact_id": markdown_artifact["artifact_id"]},
                )
                conversations_payload = api_get(base_url, "/conversations", {"project_slug": project_slug})
                conversation_state = api_get(base_url, f"/conversations/{conversation_id}")
                final_message_payload = api_post(
                    base_url,
                    f"/conversations/{conversation_id}/assistant-messages",
                    {
                        "content": "Message final visible apres rafraichissement.",
                        "job_id": job_id,
                        "project_slug": project_slug,
                    },
                    expected_status=201,
                )
                refreshed_conversation_state = api_get(base_url, f"/conversations/{conversation_id}")
                stream_payload = api_get_text(
                    base_url,
                    f"/jobs/{project_slug}/{job_id}/events/stream",
                )

                self.assertIn(run_payload["job"]["status"], {"completed", "needs_revision"})
                self.assertEqual(run_payload["provider"], "mock")
                self.assertEqual(job_payload["job"]["job_id"], job_id)
                self.assertGreaterEqual(len(events_payload["events"]), 2)
                self.assertTrue(any(event["active_agents"] for event in events_payload["events"]))
                self.assertTrue(
                    any(str(event["current_phase"]).startswith("agent:") for event in events_payload["events"])
                )
                self.assertTrue(artifacts_payload["artifacts"])
                self.assertEqual(artifact_payload["content_type"], "text/markdown")
                self.assertIn("content", artifact_payload)
                self.assertEqual(validation_payload["validation"]["decision"], "approved_by_human")
                self.assertEqual(artifact_payload["human_validation"], {})
                self.assertEqual(validations_payload["validations"][0]["decision"], "approved_by_human")
                self.assertTrue(
                    any(
                        artifact.get("human_validation", {}).get("decision") == "approved_by_human"
                        for artifact in validated_artifacts_payload["artifacts"]
                    )
                )
                self.assertEqual(conversations_payload["conversations"][0]["conversation_id"], conversation_id)
                self.assertGreaterEqual(len(conversation_state["messages"]), 2)
                self.assertEqual(final_message_payload["message"]["role"], "assistant")
                self.assertTrue(
                    any(
                        message["content"] == "Message final visible apres rafraichissement."
                        for message in refreshed_conversation_state["messages"]
                    )
                )
                self.assertIn("event: progress", stream_payload)
                self.assertIn("event: heartbeat", stream_payload)
                self.assertIn("event: done", stream_payload)

    def test_http_api_answers_project_question_without_static_route_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with running_api(temp_dir) as base_url:
                project_payload = api_post(
                    base_url,
                    "/projects",
                    {"name": "Coach SaaS", "description": "SaaS pour coachs premium"},
                    expected_status=201,
                )
                project_slug = project_payload["project"]["project_slug"]
                seed_strategy_context(Path(project_payload["project"]["root_path"]))
                conversation_payload = api_post(
                    base_url,
                    "/conversations",
                    {"project_slug": project_slug, "title": "Audit projet"},
                    expected_status=201,
                )
                conversation_id = conversation_payload["conversation"]["conversation_id"]

                run_payload = api_post(
                    base_url,
                    f"/conversations/{conversation_id}/messages",
                    {
                        "message": "Qu'est-ce qui est a reviser dans le projet coach_saas ?",
                        "provider": "mock",
                        "run_async": False,
                    },
                )

                self.assertNotEqual(run_payload["job"]["status"], "failed")
                self.assertIn("strategist", run_payload["job"]["agents_used"])
                self.assertNotIn("Unknown intent routing", json.dumps(run_payload))

    def test_http_api_keeps_greeting_in_chat_without_starting_job(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with running_api(temp_dir) as base_url:
                project_payload = api_post(
                    base_url,
                    "/projects",
                    {"name": "Coach SaaS", "description": "SaaS pour coachs premium"},
                    expected_status=201,
                )
                project_slug = project_payload["project"]["project_slug"]
                conversation_payload = api_post(
                    base_url,
                    "/conversations",
                    {"project_slug": project_slug, "title": "Accueil"},
                    expected_status=201,
                )
                conversation_id = conversation_payload["conversation"]["conversation_id"]

                run_payload = api_post(
                    base_url,
                    f"/conversations/{conversation_id}/messages",
                    {
                        "message": "Salut",
                        "provider": "mock",
                        "run_async": True,
                    },
                    expected_status=202,
                )
                jobs_payload = api_get(base_url, "/jobs", {"project_slug": project_slug})
                conversation_state = api_get(base_url, f"/conversations/{conversation_id}")

                self.assertIsNone(run_payload["job"])
                self.assertEqual(run_payload["mode"], "chat")
                self.assertEqual(run_payload["provider"], "none")
                self.assertIn("Salut Koudous", run_payload["assistant_message"]["content"])
                self.assertEqual(jobs_payload["jobs"], [])
                self.assertEqual(len(conversation_state["messages"]), 2)

    def test_http_api_answers_conversation_question_without_starting_job(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with running_api(temp_dir) as base_url:
                project_payload = api_post(
                    base_url,
                    "/projects",
                    {"name": "Coach SaaS", "description": "SaaS pour coachs premium"},
                    expected_status=201,
                )
                project_slug = project_payload["project"]["project_slug"]
                seed_strategy_context(Path(project_payload["project"]["root_path"]))
                conversation_payload = api_post(
                    base_url,
                    "/conversations",
                    {"project_slug": project_slug, "title": "Discussion"},
                    expected_status=201,
                )
                conversation_id = conversation_payload["conversation"]["conversation_id"]

                run_payload = api_post(
                    base_url,
                    f"/conversations/{conversation_id}/messages",
                    {
                        "message": "Comment tu fonctionnes concrètement ?",
                        "provider": "mock",
                        "run_async": True,
                    },
                    expected_status=202,
                )
                jobs_payload = api_get(base_url, "/jobs", {"project_slug": project_slug})

                self.assertIsNone(run_payload["job"])
                self.assertEqual(run_payload["mode"], "chat")
                self.assertIn("répondre directement", run_payload["assistant_message"]["content"])
                self.assertEqual(jobs_payload["jobs"], [])

    def test_http_api_returns_actionable_questions_when_job_needs_context(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with running_api(temp_dir) as base_url:
                project_payload = api_post(
                    base_url,
                    "/projects",
                    {"name": "Blank SaaS", "description": "Projet encore vide"},
                    expected_status=201,
                )
                project_slug = project_payload["project"]["project_slug"]
                conversation_payload = api_post(
                    base_url,
                    "/conversations",
                    {"project_slug": project_slug, "title": "Questions"},
                    expected_status=201,
                )
                conversation_id = conversation_payload["conversation"]["conversation_id"]

                run_payload = api_post(
                    base_url,
                    f"/conversations/{conversation_id}/messages",
                    {
                        "message": (
                            "Genere 3 publications facebook pour le projet blank_saas. "
                            "Plateforme cible: facebook. Volume cible: 3 publications facebook."
                        ),
                        "provider": "mock",
                        "run_async": False,
                    },
                )
                job = run_payload["job"]

                self.assertEqual(job["status"], "waiting_for_user")
                self.assertIn("base strategique", job["assistant_message"])
                self.assertGreaterEqual(len(job["required_questions"]), 3)
                self.assertTrue(any("offre exacte" in question for question in job["required_questions"]))
                self.assertIn("strategy_pack", job["missing_information"])
                self.assertTrue(any(reason.startswith("missing_context:") for reason in job["blocked_reasons"]))
                self.assertIn("base strategique", run_payload["assistant_message"]["content"])

    def test_http_api_rejects_unsafe_artifact_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            with running_api(temp_dir) as base_url:
                api_post(base_url, "/projects", {"name": "Coach SaaS"}, expected_status=201)

                error_payload = api_get(
                    base_url,
                    "/artifact",
                    {"project_slug": "coach_saas", "path": "../secret.txt"},
                    expected_status=400,
                )

                self.assertEqual(error_payload["error"]["code"], "unsafe_artifact_path")


class running_api:
    def __init__(self, workspace_root: str) -> None:
        self.workspace_root = workspace_root
        self.server = None
        self.thread = None
        self.base_url = ""

    def __enter__(self) -> str:
        service = ChatApiService(repo_root=ROOT, workspace_root=self.workspace_root, default_provider="mock")
        self.server = make_api_server(host="127.0.0.1", port=0, service=service)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address
        self.base_url = f"http://{host}:{port}"
        return self.base_url

    def __exit__(self, exc_type, exc, tb) -> None:
        if self.server is not None:
            self.server.shutdown()
            self.server.server_close()
        if self.thread is not None:
            self.thread.join(timeout=5)


def api_get(
    base_url: str,
    path: str,
    query: dict[str, str] | None = None,
    *,
    expected_status: int = 200,
) -> dict:
    suffix = f"?{urlencode(query)}" if query else ""
    request = Request(f"{base_url}{path}{suffix}", method="GET")
    return read_response(request, expected_status)


def api_post(
    base_url: str,
    path: str,
    payload: dict,
    *,
    expected_status: int = 200,
) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = Request(
        f"{base_url}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return read_response(request, expected_status)


def api_get_text(
    base_url: str,
    path: str,
    query: dict[str, str] | None = None,
    *,
    expected_status: int = 200,
) -> str:
    suffix = f"?{urlencode(query)}" if query else ""
    request = Request(f"{base_url}{path}{suffix}", method="GET")
    try:
        with urlopen(request, timeout=120) as response:
            payload = response.read().decode("utf-8")
            status = response.status
    except HTTPError as exc:
        payload = exc.read().decode("utf-8")
        status = exc.code
    if status != expected_status:
        raise AssertionError(f"Expected HTTP {expected_status}, got {status}: {payload}")
    return payload


def read_response(request: Request, expected_status: int) -> dict:
    try:
        with urlopen(request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
            status = response.status
    except HTTPError as exc:
        payload = json.loads(exc.read().decode("utf-8"))
        status = exc.code
    if status != expected_status:
        raise AssertionError(f"Expected HTTP {expected_status}, got {status}: {payload}")
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
