from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from crew_system.agents import AgentRunner, MockAgentRunner
from crew_system.core.models import JobStatus
from crew_system.filesystem import WorkspaceEngine
from crew_system.jobs.store import JobCheckpoint, JobStore, JobStoreError, StoredJob
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
        runner: AgentRunner | None = None,
    ) -> None:
        self.repo_root = Path(repo_root).expanduser().resolve()
        self.workspace = WorkspaceEngine(workspace_root)
        self.store = JobStore(self.workspace)
        self.runner = runner or MockAgentRunner()

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
        stored.completed_tasks = [f"agent_{agent_id}" for agent_id in local_result.agents_used]
        stored.pending_tasks = []
        stored.error = "; ".join(local_result.errors)
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

    def _record_failure(self, stored: StoredJob, error: str) -> StoredJob:
        if stored.attempts <= stored.max_retries:
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
