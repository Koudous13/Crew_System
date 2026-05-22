from __future__ import annotations

import json
import socket
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from crew_system.api.service import ChatApiError, ChatApiService


def make_api_server(
    *,
    host: str,
    port: int,
    service: ChatApiService,
) -> ThreadingHTTPServer:
    class CrewSystemApiHandler(JsonApiHandler):
        api_service = service

    return ThreadingHTTPServer((host, port), CrewSystemApiHandler)


def serve_api(
    *,
    repo_root: str | Path,
    workspace_root: str | Path,
    host: str = "127.0.0.1",
    port: int = 8765,
    default_provider: str = "auto",
) -> int:
    service = ChatApiService(
        repo_root=repo_root,
        workspace_root=workspace_root,
        default_provider=default_provider,
    )
    server = make_api_server(host=host, port=port, service=service)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


class JsonApiHandler(BaseHTTPRequestHandler):
    api_service: ChatApiService
    server_version = "CrewSystemApi/0.1"

    def do_OPTIONS(self) -> None:
        self._write_json(204, {})

    def do_GET(self) -> None:
        try:
            path, query = self._path_and_query()
            if self._maybe_route_stream_get(path, query):
                return
            payload = self._route_get(path, query)
            self._write_json(200, payload)
        except ChatApiError as exc:
            self._write_error(exc)
        except Exception as exc:  # pragma: no cover - HTTP safety boundary
            self._write_error(ChatApiError(500, str(exc), code="internal_error"))

    def do_POST(self) -> None:
        try:
            path, query = self._path_and_query()
            body = self._read_body()
            payload, status = self._route_post(path, query, body)
            self._write_json(status, payload)
        except ChatApiError as exc:
            self._write_error(exc)
        except json.JSONDecodeError as exc:
            self._write_error(ChatApiError(400, f"Invalid JSON: {exc}", code="invalid_json"))
        except Exception as exc:  # pragma: no cover - HTTP safety boundary
            self._write_error(ChatApiError(500, str(exc), code="internal_error"))

    def _route_get(self, path: str, query: dict[str, list[str]]) -> dict[str, Any]:
        parts = split_path(path)
        if parts == ["health"]:
            return self.api_service.health()
        if parts == ["projects"]:
            return self.api_service.list_projects()
        if parts == ["conversations"]:
            return self.api_service.list_conversations(project_slug=optional_query(query, "project_slug"))
        if len(parts) == 2 and parts[0] == "conversations":
            return self.api_service.get_conversation(parts[1])
        if parts == ["jobs"]:
            return self.api_service.list_jobs(required_query(query, "project_slug"))
        if len(parts) == 3 and parts[0] == "jobs":
            return self.api_service.get_job(parts[1], parts[2])
        if len(parts) == 4 and parts[0] == "jobs" and parts[3] == "events":
            return self.api_service.get_job_events(parts[1], parts[2])
        if parts == ["validations"]:
            return self.api_service.list_validations(
                required_query(query, "project_slug"),
                artifact_id=optional_query(query, "artifact_id"),
            )
        if parts == ["artifacts"]:
            return self.api_service.list_artifacts(
                required_query(query, "project_slug"),
                job_id=optional_query(query, "job_id"),
            )
        if parts == ["artifact"]:
            return self.api_service.read_artifact(
                required_query(query, "project_slug"),
                artifact_id=optional_query(query, "artifact_id"),
                path=optional_query(query, "path"),
            )
        raise ChatApiError(404, f"Route not found: GET {path}", code="route_not_found")

    def _route_post(
        self,
        path: str,
        query: dict[str, list[str]],
        body: dict[str, Any],
    ) -> tuple[dict[str, Any], int]:
        parts = split_path(path)
        if parts == ["projects"]:
            return (
                self.api_service.create_project(
                    name=required_body(body, "name"),
                    description=body_text(body, "description"),
                    project_slug=body_text(body, "project_slug") or None,
                ),
                201,
            )
        if parts == ["conversations"]:
            return (
                self.api_service.create_conversation(
                    project_slug=body_text(body, "project_slug"),
                    title=body_text(body, "title"),
                ),
                201,
            )
        if len(parts) == 3 and parts[0] == "conversations" and parts[2] == "messages":
            return (
                self.api_service.send_message(
                    conversation_id=parts[1],
                    message=required_body(body, "message"),
                    project_slug=body_text(body, "project_slug"),
                    provider=body_text(body, "provider") or None,
                    run_async=body_bool(body, "run_async", True),
                ),
                202 if body_bool(body, "run_async", True) else 200,
            )
        if len(parts) == 3 and parts[0] == "conversations" and parts[2] == "assistant-messages":
            return (
                self.api_service.append_assistant_message(
                    conversation_id=parts[1],
                    content=required_body(body, "content"),
                    job_id=body_text(body, "job_id"),
                    project_slug=body_text(body, "project_slug"),
                ),
                201,
            )
        if parts == ["jobs"]:
            return (
                self.api_service.start_job(
                    project_slug=required_body(body, "project_slug"),
                    message=required_body(body, "message"),
                    provider=body_text(body, "provider") or None,
                    run_async=body_bool(body, "run_async", True),
                ),
                202 if body_bool(body, "run_async", True) else 200,
            )
        if len(parts) == 4 and parts[0] == "jobs" and parts[3] == "cancel":
            return self.api_service.cancel_job(parts[1], parts[2]), 200
        if parts == ["artifacts", "validate"]:
            return (
                self.api_service.validate_artifact(
                    required_body(body, "project_slug"),
                    artifact_id=body_text(body, "artifact_id"),
                    path=body_text(body, "path"),
                    approved_by=required_body(body, "approved_by"),
                    notes=body_text(body, "notes"),
                ),
                200,
            )
        if parts == ["artifacts", "revise"]:
            return (
                self.api_service.request_revision(
                    required_body(body, "project_slug"),
                    artifact_id=body_text(body, "artifact_id"),
                    path=body_text(body, "path"),
                    instructions=required_body(body, "instructions"),
                    provider=body_text(body, "provider") or None,
                    run_async=body_bool(body, "run_async", True),
                ),
                202 if body_bool(body, "run_async", True) else 200,
            )
        raise ChatApiError(404, f"Route not found: POST {path}", code="route_not_found")

    def _maybe_route_stream_get(self, path: str, query: dict[str, list[str]]) -> bool:
        parts = split_path(path)
        if len(parts) == 5 and parts[0] == "jobs" and parts[3] == "events" and parts[4] == "stream":
            self._write_event_stream(parts[1], parts[2])
            return True
        return False

    def _write_event_stream(self, project_slug: str, job_id: str) -> None:
        self.api_service.get_job(project_slug, job_id)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        seen_event_ids = set()
        while True:
            events = self.api_service.get_job_events(project_slug, job_id)["events"]
            for event in events:
                event_id = event.get("event_id")
                if event_id in seen_event_ids:
                    continue
                seen_event_ids.add(event_id)
                if not self._write_sse_event("progress", event):
                    self.close_connection = True
                    return
            job = self.api_service.get_job(project_slug, job_id)["job"]
            if not self._write_sse_event("heartbeat", heartbeat_payload(job)):
                self.close_connection = True
                return
            if job["status"] in {"completed", "failed", "cancelled", "needs_revision", "waiting_for_user"}:
                self._write_sse_event("done", job)
                self.close_connection = True
                return
            time.sleep(1)

    def _write_sse_event(self, event_name: str, payload: dict[str, Any]) -> bool:
        body = (
            f"event: {event_name}\n"
            f"data: {json.dumps(payload, ensure_ascii=False, sort_keys=True)}\n\n"
        ).encode("utf-8")
        try:
            self.wfile.write(body)
            self.wfile.flush()
            return True
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError, socket.error):
            return False

    def _path_and_query(self) -> tuple[str, dict[str, list[str]]]:
        parsed = urlparse(self.path)
        return parsed.path.rstrip("/") or "/", parse_qs(parsed.query)

    def _read_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ChatApiError(400, "JSON body must be an object", code="invalid_body")
        return payload

    def _write_error(self, error: ChatApiError) -> None:
        self._write_json(
            error.status_code,
            {
                "ok": False,
                "error": {
                    "code": error.code,
                    "message": error.message,
                },
            },
        )

    def _write_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        return


def split_path(path: str) -> list[str]:
    return [part for part in path.split("/") if part]


def heartbeat_payload(job: dict[str, Any]) -> dict[str, Any]:
    job_id = str(job.get("job_id", "job"))
    status = str(job.get("status", "running"))
    agents_used = job.get("agents_used", [])
    artifacts_created = job.get("artifacts_created", [])
    terminal = status in {"completed", "failed", "cancelled", "needs_revision", "waiting_for_user"}
    return {
        "event_id": f"heartbeat_{job_id}_{int(time.time())}",
        "job_id": job_id,
        "status": status,
        "message": "Signal runtime actif. Le job continue en arriere-plan.",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "percent_estimate": 100 if terminal else 0,
        "current_phase": "heartbeat",
        "active_agents": agents_used if isinstance(agents_used, list) else [],
        "artifacts_created": artifacts_created if isinstance(artifacts_created, list) else [],
    }


def required_query(query: dict[str, list[str]], key: str) -> str:
    value = optional_query(query, key)
    if not value:
        raise ChatApiError(400, f"Query parameter is required: {key}", code="missing_query_parameter")
    return value


def optional_query(query: dict[str, list[str]], key: str) -> str:
    values = query.get(key, [])
    return values[0] if values else ""


def required_body(body: dict[str, Any], key: str) -> str:
    value = body_text(body, key)
    if not value:
        raise ChatApiError(400, f"Body field is required: {key}", code="missing_body_field")
    return value


def body_text(body: dict[str, Any], key: str) -> str:
    value = body.get(key, "")
    return value.strip() if isinstance(value, str) else str(value).strip()


def body_bool(body: dict[str, Any], key: str, default: bool) -> bool:
    value = body.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)
