from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Any, Mapping
from uuid import uuid4

from crew_system.agents.providers import runner_for_provider
from crew_system.api.models import ApiConversation, ApiMessage
from crew_system.core.models import JobStatus
from crew_system.filesystem import FileSystemError, SafeFileWriter, WorkspaceEngine, WriteMode
from crew_system.filesystem.workspace import utc_now
from crew_system.jobs import JobStore, LocalWorker
from crew_system.llm import DeepSeekConfigurationError


class ChatApiError(RuntimeError):
    def __init__(self, status_code: int, message: str, *, code: str = "api_error") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code


class ChatApiService:
    def __init__(
        self,
        *,
        repo_root: str | Path,
        workspace_root: str | Path,
        default_provider: str = "auto",
        env: Mapping[str, str] | None = None,
    ) -> None:
        self.repo_root = Path(repo_root).expanduser().resolve()
        self.workspace = WorkspaceEngine(workspace_root)
        self.workspace.initialize_workspace()
        self.default_provider = default_provider
        self.env = env
        self.writer = SafeFileWriter(self.workspace.workspace_root, self.workspace.workspace_root / "tmp")

    def health(self) -> dict[str, Any]:
        return {
            "ok": True,
            "service": "crew_system_api",
            "workspace_root": str(self.workspace.workspace_root),
            "default_provider": self.default_provider,
        }

    def create_project(
        self,
        *,
        name: str,
        description: str = "",
        project_slug: str | None = None,
    ) -> dict[str, Any]:
        if not name or not name.strip():
            raise ChatApiError(400, "Project name is required", code="missing_project_name")
        try:
            project = self.workspace.create_project(
                name.strip(),
                project_slug=project_slug or None,
                description=description,
            )
        except FileSystemError as exc:
            raise ChatApiError(400, str(exc), code="project_error") from exc
        return {"project": project.to_dict()}

    def create_conversation(self, *, project_slug: str = "", title: str = "") -> dict[str, Any]:
        conversation_id = new_conversation_id()
        now = utc_now()
        conversation = ApiConversation(
            conversation_id=conversation_id,
            project_slug=project_slug,
            title=title,
            created_at=now,
            updated_at=now,
        )
        self.writer.write_json(
            f"conversations/{conversation_id}/conversation.json",
            conversation.to_dict(),
            job_id=conversation_id,
            mode=WriteMode.CREATE,
        )
        self.writer.write_text(
            f"conversations/{conversation_id}/messages.jsonl",
            "",
            job_id=conversation_id,
            mode=WriteMode.CREATE,
        )
        return {"conversation": conversation.to_dict(), "messages": []}

    def get_conversation(self, conversation_id: str) -> dict[str, Any]:
        conversation = self._load_conversation(conversation_id)
        return {
            "conversation": conversation.to_dict(),
            "messages": self._read_messages(conversation_id),
        }

    def send_message(
        self,
        *,
        conversation_id: str,
        message: str,
        project_slug: str = "",
        provider: str | None = None,
        run_async: bool = True,
    ) -> dict[str, Any]:
        conversation = self._load_conversation(conversation_id)
        if not message or not message.strip():
            raise ChatApiError(400, "Message is required", code="missing_message")
        target_project = project_slug or conversation.project_slug
        if not target_project:
            raise ChatApiError(400, "project_slug is required", code="missing_project_slug")

        user_message = ApiMessage.build(
            message_id=new_message_id(),
            conversation_id=conversation_id,
            role="user",
            content=message.strip(),
            metadata={"project_slug": target_project},
        )
        self._append_message(user_message)

        job_payload = self.start_job(
            project_slug=target_project,
            message=message.strip(),
            provider=provider,
            run_async=run_async,
        )
        stored_job = job_payload["job"]
        assistant_message = ApiMessage.build(
            message_id=new_message_id(),
            conversation_id=conversation_id,
            role="assistant",
            content=response_message_for_job(stored_job["status"], run_async),
            job_id=stored_job["job_id"],
            metadata={
                "provider": job_payload["provider"],
                "project_slug": target_project,
                "run_async": run_async,
            },
        )
        self._append_message(assistant_message)
        self._touch_conversation(conversation, target_project)

        return {
            "conversation": conversation.to_dict(),
            "message": user_message.to_dict(),
            "assistant_message": assistant_message.to_dict(),
            **job_payload,
        }

    def start_job(
        self,
        *,
        project_slug: str,
        message: str,
        provider: str | None = None,
        run_async: bool = True,
    ) -> dict[str, Any]:
        if not project_slug or not project_slug.strip():
            raise ChatApiError(400, "project_slug is required", code="missing_project_slug")
        if not message or not message.strip():
            raise ChatApiError(400, "message is required", code="missing_message")
        self._require_project(project_slug)
        try:
            runner, provider_used = runner_for_provider(
                provider or self.default_provider,
                env=self.env,
            )
        except DeepSeekConfigurationError as exc:
            raise ChatApiError(400, str(exc), code="provider_configuration_error") from exc

        worker = LocalWorker(
            repo_root=self.repo_root,
            workspace_root=self.workspace.workspace_root,
            runner=runner,
        )
        stored = worker.enqueue(
            project_slug=project_slug,
            message=message.strip(),
            active_project_hint=project_slug,
        )
        if run_async:
            thread = threading.Thread(
                target=self._run_background_job,
                args=(worker, project_slug, stored.job_id),
                daemon=True,
            )
            thread.start()
        else:
            stored = worker.run(project_slug=project_slug, job_id=stored.job_id).stored_job

        return {
            "job": stored.to_dict(),
            "provider": provider_used,
            "run_async": run_async,
        }

    def list_jobs(self, project_slug: str) -> dict[str, Any]:
        self._require_project(project_slug)
        store = JobStore(self.workspace)
        return {"jobs": [job.to_dict() for job in store.list_jobs(project_slug)]}

    def get_job(self, project_slug: str, job_id: str) -> dict[str, Any]:
        self._require_project(project_slug)
        try:
            stored = JobStore(self.workspace).load(project_slug, job_id)
        except Exception as exc:
            raise ChatApiError(404, f"Job not found: {job_id}", code="job_not_found") from exc
        return {"job": stored.to_dict()}

    def get_job_events(self, project_slug: str, job_id: str) -> dict[str, Any]:
        self._require_project(project_slug)
        try:
            events = JobStore(self.workspace).progress_events(project_slug, job_id)
        except Exception as exc:
            raise ChatApiError(404, f"Job events not found: {job_id}", code="job_events_not_found") from exc
        return {"events": [event.to_dict() for event in events]}

    def cancel_job(self, project_slug: str, job_id: str) -> dict[str, Any]:
        self._require_project(project_slug)
        try:
            stored = JobStore(self.workspace).cancel(project_slug, job_id)
        except Exception as exc:
            raise ChatApiError(404, f"Job not found: {job_id}", code="job_not_found") from exc
        return {"job": stored.to_dict()}

    def list_artifacts(self, project_slug: str, *, job_id: str = "") -> dict[str, Any]:
        self._require_project(project_slug)
        validations_by_artifact = self._latest_validations_by_artifact(project_slug)
        validations_by_path = self._latest_validations_by_path(project_slug)
        artifacts = []
        for entry in self._artifact_log_entries(project_slug):
            if not entry.get("artifact_id"):
                continue
            if job_id and entry.get("job_id") != job_id:
                continue
            entry = dict(entry)
            validation = validations_by_artifact.get(str(entry.get("artifact_id", ""))) or validations_by_path.get(
                str(entry.get("path", ""))
            )
            if validation:
                entry["human_validation"] = validation
                entry["status"] = validation["decision"]
                entry["human_approved_by"] = validation["approved_by"]
            artifacts.append(entry)
        artifacts.sort(key=lambda entry: str(entry.get("created_at", "")), reverse=True)
        return {"artifacts": artifacts}

    def read_artifact(
        self,
        project_slug: str,
        *,
        artifact_id: str = "",
        path: str = "",
    ) -> dict[str, Any]:
        self._require_project(project_slug)
        artifact, relative_path = self._resolve_artifact_reference(
            project_slug,
            artifact_id=artifact_id,
            path=path,
        )
        project_writer = SafeFileWriter(
            self.workspace.project_path(project_slug),
            self.workspace.workspace_root / "tmp",
        )
        try:
            absolute_path = project_writer.resolve(relative_path)
        except FileSystemError as exc:
            raise ChatApiError(400, str(exc), code="unsafe_artifact_path") from exc
        if not absolute_path.exists():
            raise ChatApiError(404, f"Artifact file not found: {relative_path}", code="artifact_file_not_found")
        content = absolute_path.read_text(encoding="utf-8")
        validation = self._latest_validations_by_artifact(project_slug).get(str(artifact.get("artifact_id", "")))
        if not validation:
            validation = self._latest_validations_by_path(project_slug).get(relative_path)
        return {
            "artifact": artifact,
            "path": relative_path,
            "content_type": content_type_for(relative_path),
            "content": content,
            "human_validation": validation or {},
        }

    def validate_artifact(
        self,
        project_slug: str,
        *,
        approved_by: str,
        artifact_id: str = "",
        path: str = "",
        notes: str = "",
    ) -> dict[str, Any]:
        if not approved_by or not approved_by.strip():
            raise ChatApiError(400, "approved_by is required", code="missing_approved_by")
        self._require_project(project_slug)
        artifact, relative_path = self._resolve_artifact_reference(
            project_slug,
            artifact_id=artifact_id,
            path=path,
        )
        validation_id = new_validation_id()
        record = {
            "validation_id": validation_id,
            "artifact_id": artifact.get("artifact_id", artifact_id),
            "artifact_path": relative_path,
            "project_slug": project_slug,
            "decision": "approved_by_human",
            "approved_by": approved_by.strip(),
            "notes": notes,
            "created_at": utc_now(),
        }
        writer = SafeFileWriter(
            self.workspace.project_path(project_slug),
            self.workspace.workspace_root / "tmp",
        )
        writer.append_jsonl("logs/human_validations.jsonl", record, job_id=validation_id)
        writer.append_jsonl("logs/artifacts.jsonl", {"human_validation": record}, job_id=validation_id)
        self.workspace.write_decision(
            project_slug,
            job_id=validation_id,
            decision="human_approved_artifact",
            reason=notes or f"Approved by {approved_by.strip()}",
            impact="artifact explicitly approved for downstream use",
            files=[relative_path],
        )
        return {"validation": record}

    def list_validations(
        self,
        project_slug: str,
        *,
        artifact_id: str = "",
    ) -> dict[str, Any]:
        self._require_project(project_slug)
        validations = self._validation_entries(project_slug)
        if artifact_id:
            validations = [
                validation
                for validation in validations
                if validation.get("artifact_id") == artifact_id
            ]
        validations.sort(key=lambda entry: str(entry.get("created_at", "")), reverse=True)
        return {"validations": validations}

    def request_revision(
        self,
        project_slug: str,
        *,
        instructions: str,
        artifact_id: str = "",
        path: str = "",
        provider: str | None = None,
        run_async: bool = True,
    ) -> dict[str, Any]:
        if not instructions or not instructions.strip():
            raise ChatApiError(400, "instructions are required", code="missing_revision_instructions")
        _, relative_path = self._resolve_artifact_reference(
            project_slug,
            artifact_id=artifact_id,
            path=path,
        )
        message = (
            f"Revise le livrable {relative_path}. "
            f"Instructions de revision: {instructions.strip()}"
        )
        return self.start_job(
            project_slug=project_slug,
            message=message,
            provider=provider,
            run_async=run_async,
        )

    def _run_background_job(self, worker: LocalWorker, project_slug: str, job_id: str) -> None:
        try:
            worker.run(project_slug=project_slug, job_id=job_id)
        except Exception:
            # LocalWorker persists normal runtime failures. This protects the API thread boundary.
            try:
                stored = worker.store.load(project_slug, job_id)
                worker.store.update_status(
                    stored,
                    JobStatus.FAILED,
                    message="Background job crashed",
                    error="Background job crashed outside the runtime boundary",
                    percent_estimate=100,
                    current_phase="failed",
                )
            except Exception:
                return

    def _require_project(self, project_slug: str) -> None:
        try:
            self.workspace.load_project_manifest(project_slug)
        except FileSystemError as exc:
            raise ChatApiError(404, f"Project not found: {project_slug}", code="project_not_found") from exc

    def _load_conversation(self, conversation_id: str) -> ApiConversation:
        ensure_safe_id(conversation_id, "conversation_id")
        path = self.workspace.workspace_root / "conversations" / conversation_id / "conversation.json"
        if not path.exists():
            raise ChatApiError(404, f"Conversation not found: {conversation_id}", code="conversation_not_found")
        return ApiConversation.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def _touch_conversation(self, conversation: ApiConversation, project_slug: str) -> None:
        conversation.updated_at = utc_now()
        if project_slug:
            conversation.project_slug = project_slug
        self.writer.write_json(
            f"conversations/{conversation.conversation_id}/conversation.json",
            conversation.to_dict(),
            job_id=conversation.conversation_id,
            mode=WriteMode.OVERWRITE_WITH_VERSION,
        )

    def _append_message(self, message: ApiMessage) -> None:
        self.writer.append_jsonl(
            f"conversations/{message.conversation_id}/messages.jsonl",
            message.to_dict(),
            job_id=message.message_id,
        )

    def _read_messages(self, conversation_id: str) -> list[dict[str, Any]]:
        path = self.workspace.workspace_root / "conversations" / conversation_id / "messages.jsonl"
        return read_jsonl(path)

    def _artifact_log_entries(self, project_slug: str) -> list[dict[str, Any]]:
        path = self.workspace.project_path(project_slug) / "logs" / "artifacts.jsonl"
        return read_jsonl(path)

    def _validation_entries(self, project_slug: str) -> list[dict[str, Any]]:
        path = self.workspace.project_path(project_slug) / "logs" / "human_validations.jsonl"
        return read_jsonl(path)

    def _latest_validations_by_artifact(self, project_slug: str) -> dict[str, dict[str, Any]]:
        validations = {}
        for entry in self._validation_entries(project_slug):
            artifact_id = str(entry.get("artifact_id", ""))
            if artifact_id:
                validations[artifact_id] = entry
        return validations

    def _latest_validations_by_path(self, project_slug: str) -> dict[str, dict[str, Any]]:
        validations = {}
        for entry in self._validation_entries(project_slug):
            artifact_path = str(entry.get("artifact_path", ""))
            if artifact_path:
                validations[artifact_path] = entry
        return validations

    def _resolve_artifact_reference(
        self,
        project_slug: str,
        *,
        artifact_id: str = "",
        path: str = "",
    ) -> tuple[dict[str, Any], str]:
        if not artifact_id and not path:
            raise ChatApiError(400, "artifact_id or path is required", code="missing_artifact_reference")
        artifacts = [entry for entry in self._artifact_log_entries(project_slug) if entry.get("artifact_id")]
        if artifact_id:
            matches = [entry for entry in artifacts if entry.get("artifact_id") == artifact_id]
            if not matches:
                raise ChatApiError(404, f"Artifact not found: {artifact_id}", code="artifact_not_found")
            artifact = matches[-1]
            return artifact, str(artifact["path"])
        relative_path = path.strip().replace("\\", "/")
        matches = [entry for entry in artifacts if entry.get("path") == relative_path]
        return (matches[-1] if matches else {}, relative_path)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def ensure_safe_id(value: str, field_name: str) -> None:
    if not isinstance(value, str) or not re.match(r"^[A-Za-z0-9_:-]+$", value):
        raise ChatApiError(400, f"Unsafe {field_name}", code="unsafe_identifier")


def content_type_for(path: str) -> str:
    if path.endswith(".json"):
        return "application/json"
    if path.endswith(".md"):
        return "text/markdown"
    return "text/plain"


def response_message_for_job(status: str, run_async: bool) -> str:
    if run_async:
        return "Job lance en arriere-plan. Tu peux suivre sa progression et lire les artefacts produits."
    if status in {"completed", "needs_revision"}:
        return "Job termine. Les artefacts sont disponibles."
    return "Job termine avec un statut a verifier."


def new_conversation_id() -> str:
    return f"conversation_{uuid4().hex[:16]}"


def new_message_id() -> str:
    return f"message_{uuid4().hex[:16]}"


def new_validation_id() -> str:
    return f"validation_{uuid4().hex[:16]}"
