from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from crew_system.core.models import (
    JobStatus,
    RuntimeModel,
    require_bool,
    require_enum,
    require_non_empty,
    require_non_negative_int,
    require_positive_int,
    validate_identifier,
    validate_project_slug,
    validate_string_list,
)
from crew_system.filesystem import SafeFileWriter, WorkspaceEngine, WriteMode
from crew_system.filesystem.workspace import utc_now


class JobStoreError(RuntimeError):
    """Raised when durable job state cannot be read or written."""


@dataclass(slots=True)
class StoredJob(RuntimeModel):
    job_id: str
    project_slug: str
    request_message: str
    active_project_hint: str
    status: JobStatus
    created_at: str
    updated_at: str
    attempts: int = 0
    max_retries: int = 1
    runtime_job_id: str = ""
    completed_at: str = ""
    error: str = ""
    artifacts_created: list[str] = field(default_factory=list)
    agents_used: list[str] = field(default_factory=list)
    completed_tasks: list[str] = field(default_factory=list)
    pending_tasks: list[str] = field(default_factory=list)
    can_resume: bool = True

    def validate(self) -> None:
        validate_identifier(self.job_id, "StoredJob.job_id")
        validate_project_slug(self.project_slug, "StoredJob.project_slug")
        require_non_empty(self.request_message, "StoredJob.request_message")
        require_non_empty(self.active_project_hint, "StoredJob.active_project_hint")
        require_enum(self.status, JobStatus, "StoredJob.status")
        require_non_empty(self.created_at, "StoredJob.created_at")
        require_non_empty(self.updated_at, "StoredJob.updated_at")
        require_non_negative_int(self.attempts, "StoredJob.attempts")
        require_positive_int(self.max_retries, "StoredJob.max_retries")
        if self.runtime_job_id:
            validate_identifier(self.runtime_job_id, "StoredJob.runtime_job_id")
        validate_string_list(self.artifacts_created, "StoredJob.artifacts_created")
        validate_string_list(self.agents_used, "StoredJob.agents_used")
        validate_string_list(self.completed_tasks, "StoredJob.completed_tasks")
        validate_string_list(self.pending_tasks, "StoredJob.pending_tasks")
        require_bool(self.can_resume, "StoredJob.can_resume")
        if self.status is JobStatus.FAILED and not self.error:
            raise JobStoreError("StoredJob.error is required when failed")


@dataclass(slots=True)
class ProgressEvent(RuntimeModel):
    event_id: str
    job_id: str
    status: JobStatus
    message: str
    timestamp: str
    percent_estimate: int = 0
    current_phase: str = ""
    active_agents: list[str] = field(default_factory=list)
    artifacts_created: list[str] = field(default_factory=list)

    def validate(self) -> None:
        validate_identifier(self.event_id, "ProgressEvent.event_id")
        validate_identifier(self.job_id, "ProgressEvent.job_id")
        require_enum(self.status, JobStatus, "ProgressEvent.status")
        require_non_empty(self.message, "ProgressEvent.message")
        require_non_empty(self.timestamp, "ProgressEvent.timestamp")
        require_non_negative_int(self.percent_estimate, "ProgressEvent.percent_estimate")
        if self.percent_estimate > 100:
            raise JobStoreError("ProgressEvent.percent_estimate cannot exceed 100")
        validate_string_list(self.active_agents, "ProgressEvent.active_agents")
        validate_string_list(self.artifacts_created, "ProgressEvent.artifacts_created")


@dataclass(slots=True)
class JobCheckpoint(RuntimeModel):
    checkpoint_id: str
    job_id: str
    phase: str
    completed_tasks: list[str]
    pending_tasks: list[str]
    artifacts_written: list[str]
    context_hash: str = ""
    can_resume: bool = True
    resume_reason: str = ""

    def validate(self) -> None:
        validate_identifier(self.checkpoint_id, "JobCheckpoint.checkpoint_id")
        validate_identifier(self.job_id, "JobCheckpoint.job_id")
        require_non_empty(self.phase, "JobCheckpoint.phase")
        validate_string_list(self.completed_tasks, "JobCheckpoint.completed_tasks")
        validate_string_list(self.pending_tasks, "JobCheckpoint.pending_tasks")
        validate_string_list(self.artifacts_written, "JobCheckpoint.artifacts_written")
        require_bool(self.can_resume, "JobCheckpoint.can_resume")


class JobStore:
    def __init__(self, workspace: WorkspaceEngine) -> None:
        self.workspace = workspace

    def create(
        self,
        *,
        project_slug: str,
        request_message: str,
        active_project_hint: str,
        max_retries: int = 1,
    ) -> StoredJob:
        job_id = new_job_id()
        self.workspace.create_job_folder(project_slug, job_id)
        now = utc_now()
        stored = StoredJob(
            job_id=job_id,
            project_slug=project_slug,
            request_message=request_message,
            active_project_hint=active_project_hint,
            status=JobStatus.QUEUED,
            created_at=now,
            updated_at=now,
            max_retries=max_retries,
        )
        self.save(stored)
        self.append_progress(
            ProgressEvent(
                event_id=new_event_id(job_id),
                job_id=job_id,
                status=JobStatus.QUEUED,
                message="Job queued",
                timestamp=now,
                percent_estimate=0,
                current_phase="queued",
            )
        )
        return stored

    def load(self, project_slug: str, job_id: str) -> StoredJob:
        path = self.state_path(project_slug, job_id)
        if not path.exists():
            raise JobStoreError(f"Job state not found: {job_id}")
        return StoredJob.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def save(self, stored: StoredJob) -> None:
        writer = self.project_writer(stored.project_slug)
        writer.write_json(
            f"logs/jobs/{stored.job_id}/job_state.json",
            stored.to_dict(),
            job_id=stored.job_id,
            mode=WriteMode.OVERWRITE_WITH_VERSION,
        )

    def update_status(
        self,
        stored: StoredJob,
        status: JobStatus,
        *,
        message: str,
        error: str = "",
        percent_estimate: int = 0,
        current_phase: str = "",
    ) -> StoredJob:
        stored.status = status
        stored.error = error
        stored.updated_at = utc_now()
        if status in {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED}:
            stored.completed_at = stored.updated_at
            stored.can_resume = status is not JobStatus.CANCELLED
        self.save(stored)
        self.append_progress(
            ProgressEvent(
                event_id=new_event_id(stored.job_id),
                job_id=stored.job_id,
                status=status,
                message=message,
                timestamp=stored.updated_at,
                percent_estimate=percent_estimate,
                current_phase=current_phase or status.value,
                artifacts_created=stored.artifacts_created,
                active_agents=stored.agents_used,
            )
        )
        return stored

    def save_checkpoint(self, project_slug: str, checkpoint: JobCheckpoint) -> None:
        self.project_writer(project_slug).write_json(
            f"logs/jobs/{checkpoint.job_id}/checkpoint.json",
            checkpoint.to_dict(),
            job_id=checkpoint.job_id,
            mode=WriteMode.OVERWRITE_WITH_VERSION,
        )

    def load_checkpoint(self, project_slug: str, job_id: str) -> JobCheckpoint | None:
        path = self.job_folder(project_slug, job_id) / "checkpoint.json"
        if not path.exists():
            return None
        return JobCheckpoint.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def append_progress(self, event: ProgressEvent) -> None:
        self.project_writer_for_job(event.job_id).append_jsonl(
            self.progress_path_for_event(event),
            event.to_dict(),
            job_id=event.job_id,
        )

    def cancel(self, project_slug: str, job_id: str) -> StoredJob:
        stored = self.load(project_slug, job_id)
        return self.update_status(
            stored,
            JobStatus.CANCELLED,
            message="Job cancelled",
            percent_estimate=100,
            current_phase="cancelled",
        )

    def state_path(self, project_slug: str, job_id: str) -> Path:
        return self.job_folder(project_slug, job_id) / "job_state.json"

    def job_folder(self, project_slug: str, job_id: str) -> Path:
        return self.workspace.project_path(project_slug) / "logs" / "jobs" / job_id

    def project_writer(self, project_slug: str) -> SafeFileWriter:
        return SafeFileWriter(self.workspace.project_path(project_slug), self.workspace.workspace_root / "tmp")

    def project_writer_for_job(self, job_id: str) -> SafeFileWriter:
        # Progress events only contain job_id, so find the project by walking active workspaces.
        for project_dir in (self.workspace.workspace_root / "projects").glob("*"):
            candidate = project_dir / "logs" / "jobs" / job_id
            if candidate.exists():
                return SafeFileWriter(project_dir, self.workspace.workspace_root / "tmp")
        raise JobStoreError(f"Cannot find project for job {job_id}")

    def progress_path_for_event(self, event: ProgressEvent) -> str:
        return f"logs/jobs/{event.job_id}/progress_events.jsonl"


def new_job_id() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"job_{timestamp}_{uuid4().hex[:8]}"


def new_event_id(job_id: str) -> str:
    return f"event_{job_id}_{uuid4().hex[:8]}"
