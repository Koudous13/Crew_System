from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from crew_system.agents import AgentRunner, RunnerNotConfiguredError
from crew_system.core.models import FinalChatResponse, JobStatus
from crew_system.filesystem import WorkspaceEngine
from crew_system.filesystem.workspace import utc_now
from crew_system.jobs.store import JobCheckpoint, JobStore, JobStoreError, ProgressEvent, StoredJob, new_event_id
from crew_system.runtime import LocalRunResult, LocalRuntime


class WorkerError(RuntimeError):
    """Raised when a local worker cannot process a stored job."""


@dataclass(slots=True)
class WorkerRunResult:
    stored_job: StoredJob
    local_result: LocalRunResult | None = None


class LocalWorker:
    def __init__(
        self,
        *,
        repo_root: str | Path,
        workspace_root: str | Path,
        runner: AgentRunner,
    ) -> None:
        self.repo_root = Path(repo_root).expanduser().resolve()
        self.workspace = WorkspaceEngine(workspace_root)
        self.store = JobStore(self.workspace)
        if runner is None:
            raise RunnerNotConfiguredError("LocalWorker requires an explicit AgentRunner")
        self.runner = runner

    def enqueue(
        self,
        *,
        project_slug: str,
        message: str,
        active_project_hint: str | None = None,
        max_retries: int = 1,
    ) -> StoredJob:
        self.workspace.initialize_workspace()
        return self.store.create(
            project_slug=project_slug,
            request_message=message,
            active_project_hint=active_project_hint or project_slug,
            max_retries=max_retries,
        )

    def run(self, *, project_slug: str, job_id: str) -> WorkerRunResult:
        stored = self.store.load(project_slug, job_id)
        if stored.status is JobStatus.CANCELLED:
            raise WorkerError(f"Cannot run cancelled job: {job_id}")
        if stored.status is JobStatus.COMPLETED:
            return WorkerRunResult(stored_job=stored)
        stored.attempts += 1
        self.store.update_status(
            stored,
            JobStatus.RUNNING,
            message="Worker started job",
            percent_estimate=10,
            current_phase="running",
        )
        try:
            local_result = LocalRuntime(
                repo_root=self.repo_root,
                workspace_root=self.workspace.workspace_root,
                runner=self.runner,
            ).run(
                message=stored.request_message,
                active_project_hint=stored.active_project_hint,
                request_id=f"req_{stored.job_id}",
                job_id=stored.job_id,
                progress_callback=lambda status, message, percent, phase, agents: self._append_runtime_progress(
                    stored=stored,
                    status=status,
                    message=message,
                    percent_estimate=percent,
                    current_phase=phase,
                    active_agents=agents,
                ),
            )
        except Exception as exc:
            return WorkerRunResult(
                stored_job=self._record_failure(stored, str(exc)),
                local_result=None,
            )

        stored.runtime_job_id = local_result.job.job_id
        stored.status = local_result.job.status
        stored.agents_used = local_result.agents_used
        stored.artifacts_created = (
            [artifact.artifact_id for artifact in local_result.write_result.artifacts]
            if local_result.write_result
            else []
        )
        apply_final_response(stored, local_result.final_response, blocked_reasons=local_result.errors)
        stored.completed_tasks = [f"agent_{agent_id}" for agent_id in local_result.agents_used]
        stored.pending_tasks = []
        stored.error = "; ".join(local_result.errors) if stored.status is JobStatus.FAILED else ""
        stored.updated_at = local_result.job.updated_at
        if stored.status in {JobStatus.COMPLETED, JobStatus.NEEDS_REVISION}:
            stored.completed_at = stored.updated_at
        self.store.save(stored)
        self.store.save_checkpoint(
            stored.project_slug,
            JobCheckpoint(
                checkpoint_id=f"checkpoint_{stored.job_id}",
                job_id=stored.job_id,
                phase=stored.status.value,
                completed_tasks=stored.completed_tasks,
                pending_tasks=stored.pending_tasks,
                artifacts_written=stored.artifacts_created,
                can_resume=stored.status is not JobStatus.COMPLETED,
                resume_reason="quality revision possible" if stored.status is JobStatus.NEEDS_REVISION else "",
            ),
        )
        self.store.update_status(
            stored,
            stored.status,
            message=f"Worker finished job with status {stored.status.value}",
            percent_estimate=100,
            current_phase=stored.status.value,
        )
        return WorkerRunResult(stored_job=stored, local_result=local_result)

    def resume(self, *, project_slug: str, job_id: str) -> WorkerRunResult:
        stored = self.store.load(project_slug, job_id)
        checkpoint = self.store.load_checkpoint(project_slug, job_id)
        if checkpoint is not None and not checkpoint.can_resume:
            raise WorkerError(f"Checkpoint does not allow resume: {checkpoint.resume_reason}")
        if not stored.can_resume:
            raise WorkerError(f"Job cannot resume: {job_id}")
        return self.run(project_slug=project_slug, job_id=job_id)

    def cancel(self, *, project_slug: str, job_id: str) -> StoredJob:
        return self.store.cancel(project_slug, job_id)

    def _append_runtime_progress(
        self,
        *,
        stored: StoredJob,
        status: JobStatus,
        message: str,
        percent_estimate: int,
        current_phase: str,
        active_agents: list[str],
    ) -> None:
        self.store.append_progress(
            ProgressEvent(
                event_id=new_event_id(stored.job_id),
                job_id=stored.job_id,
                status=status,
                message=message,
                timestamp=utc_now(),
                percent_estimate=percent_estimate,
                current_phase=current_phase,
                active_agents=active_agents,
                artifacts_created=stored.artifacts_created,
            )
        )

    def _record_failure(self, stored: StoredJob, error: str) -> StoredJob:
        if stored.attempts < stored.max_retries:
            stored.can_resume = True
            return self.store.update_status(
                stored,
                JobStatus.QUEUED,
                message="Worker failed; job queued for retry",
                error=error,
                percent_estimate=20,
                current_phase="retry_waiting",
            )
        stored.can_resume = False
        return self.store.update_status(
            stored,
            JobStatus.FAILED,
            message="Worker failed; retries exhausted",
            error=error,
            percent_estimate=100,
            current_phase="failed",
        )


def apply_final_response(
    stored: StoredJob,
    final_response: FinalChatResponse,
    *,
    blocked_reasons: list[str],
) -> None:
    stored.assistant_message = final_response.message
    stored.suggested_user_reply = final_response.suggested_user_reply
    stored.missing_information = list(final_response.missing_information)
    stored.required_questions = list(final_response.required_questions)
    stored.blocked_reasons = list(blocked_reasons)
