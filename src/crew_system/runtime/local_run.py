from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from crew_system.agents import AgentOutput, AgentRunner, MockAgentRunner
from crew_system.core.models import (
    ChatRequest,
    FinalChatResponse,
    GateDecision,
    GateResult,
    Job,
    JobStatus,
    QualityReport,
    QualityScope,
    RuntimeContext,
    RuntimeModel,
    TaskNode,
    TaskType,
    UserPreferences,
    require_model,
    require_non_empty,
    validate_model_list,
    validate_string_list,
)
from crew_system.filesystem import WorkspaceEngine
from crew_system.filesystem.workspace import utc_now
from crew_system.quality import QualityAssessment, QualityGateEngine
from crew_system.registry import load_registry
from crew_system.runtime.agent_executor import AgentTaskExecutor
from crew_system.runtime.context_loader import ContextLoader
from crew_system.runtime.intent import RuleBasedIntentParser
from crew_system.runtime.planner import JobPlanner
from crew_system.runtime.project_resolver import ProjectResolver
from crew_system.runtime.request import RequestNormalizer
from crew_system.runtime.writer import DeliverableWriteResult, DeliverableWriter, build_write_plan


class LocalRunError(RuntimeError):
    """Raised when a local runtime job cannot be executed."""


@dataclass(slots=True)
class LocalRunResult(RuntimeModel):
    job: Job
    final_response: FinalChatResponse
    quality_report: QualityReport | None = None
    write_result: DeliverableWriteResult | None = None
    agents_used: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def validate(self) -> None:
        require_model(self.job, Job, "LocalRunResult.job")
        require_model(self.final_response, FinalChatResponse, "LocalRunResult.final_response")
        if self.quality_report is not None:
            require_model(self.quality_report, QualityReport, "LocalRunResult.quality_report")
        if self.write_result is not None:
            require_model(self.write_result, DeliverableWriteResult, "LocalRunResult.write_result")
        validate_string_list(self.agents_used, "LocalRunResult.agents_used")
        validate_string_list(self.errors, "LocalRunResult.errors")


class LocalRuntime:
    def __init__(
        self,
        *,
        repo_root: str | Path,
        workspace_root: str | Path,
        runner: AgentRunner | None = None,
    ) -> None:
        self.repo_root = Path(repo_root).expanduser().resolve()
        self.workspace = WorkspaceEngine(workspace_root)
        self.registry = load_registry(self.repo_root)
        self.runner = runner or MockAgentRunner()

    def run(
        self,
        *,
        message: str,
        active_project_hint: str,
        conversation_id: str = "cli",
        request_id: str | None = None,
        job_id: str | None = None,
        user_preferences: UserPreferences | None = None,
    ) -> LocalRunResult:
        self.workspace.initialize_workspace()
        chat_request = ChatRequest(
            request_id=request_id or f"req_cli_{compact_now()}",
            conversation_id=conversation_id,
            user_message=message,
            received_at=utc_now(),
            active_project_hint=active_project_hint,
            runtime_context=RuntimeContext(
                current_branch="cli",
                workspace_root=str(self.workspace.workspace_root),
            ),
            user_preferences=user_preferences or UserPreferences(),
        )
        intent = RuleBasedIntentParser().parse(chat_request)
        resolution = ProjectResolver(self.workspace).resolve(chat_request, intent)
        normalized = RequestNormalizer().normalize(chat_request, intent, resolution)

        planning_job_id = f"job_context_{compact_now()}"
        context = ContextLoader(self.workspace).load(planning_job_id, normalized)
        plan = JobPlanner(self.registry).plan(normalized, context, job_id=job_id)
        job = plan.job
        self.workspace.create_job_folder(job.project_slug, job.job_id)

        if job.status is JobStatus.WAITING_FOR_USER:
            self.workspace.append_job_log(
                job.project_slug,
                job_log_entry(job, chat_request.request_id, [], [], 0, job.status_reason),
            )
            return LocalRunResult(
                job=job,
                final_response=FinalChatResponse(
                    job_id=job.job_id,
                    project_slug=job.project_slug,
                    status=JobStatus.WAITING_FOR_USER,
                    message=job.status_reason or "Le job attend une information utilisateur.",
                    created_at=utc_now(),
                    next_actions=plan.blocked_reasons,
                ),
                errors=plan.blocked_reasons,
            )

        ordered_agent_tasks = execution_order(plan.task_graph.nodes)
        executor = AgentTaskExecutor(
            workspace=self.workspace,
            registry=self.registry,
            runner=self.runner,
        )
        outputs: dict[str, AgentOutput] = {}
        assessments: list[QualityAssessment] = []
        errors: list[str] = []
        quality_engine = QualityGateEngine()
        for task in ordered_agent_tasks:
            result = executor.execute(
                project_slug=job.project_slug,
                task_node=task,
                request=normalized,
                context=context,
                upstream_outputs=outputs,
            )
            if result.output is not None:
                outputs[result.output.agent_id] = result.output
            assessment = quality_engine.evaluate_agent_output(
                job_id=job.job_id,
                output=result.output,
                schema_validation=result.schema_validation,
                context=context,
            )
            assessments.append(assessment)
            if result.error:
                errors.append(result.error)

        quality_report = merge_agent_quality_reports(job.job_id, assessments)
        write_result = DeliverableWriter(self.workspace).write(
            plan=build_write_plan(job),
            quality_report=quality_report,
            agent_outputs=outputs,
            agents_used=list(outputs),
        )
        final_status = JobStatus.COMPLETED if quality_report.decision is GateDecision.ACCEPT else JobStatus.NEEDS_REVISION
        artifacts_created = [artifact.artifact_id for artifact in write_result.artifacts]
        self.workspace.append_job_log(
            job.project_slug,
            job_log_entry(
                job,
                chat_request.request_id,
                list(outputs),
                artifacts_created,
                quality_report.overall_score,
                "; ".join(errors),
                status=final_status,
            ),
        )
        return LocalRunResult(
            job=Job(
                job_id=job.job_id,
                job_type=job.job_type,
                project_slug=job.project_slug,
                intent_type=job.intent_type,
                created_at=job.created_at,
                updated_at=utc_now(),
                task_graph_id=job.task_graph_id,
                status=final_status,
                expected_artifacts=job.expected_artifacts,
                limits=job.limits,
                status_reason="completed with quality gates" if final_status is JobStatus.COMPLETED else "needs revision after quality gates",
            ),
            quality_report=quality_report,
            write_result=write_result,
            agents_used=list(outputs),
            errors=errors,
            final_response=FinalChatResponse(
                job_id=job.job_id,
                project_slug=job.project_slug,
                status=final_status,
                message=f"Job {job.job_id} termine avec decision qualite {quality_report.decision.value}.",
                created_at=utc_now(),
                artifacts_created=artifacts_created,
                next_actions=quality_report.revision_notes,
            ),
        )


def execution_order(nodes: list[TaskNode]) -> list[TaskNode]:
    agent_nodes = {node.task_id: node for node in nodes if node.task_type is TaskType.AGENT_RUN}
    ordered: list[TaskNode] = []
    completed: set[str] = set()
    while len(ordered) < len(agent_nodes):
        progressed = False
        for task_id, node in agent_nodes.items():
            if task_id in completed:
                continue
            dependencies = [dependency for dependency in node.depends_on if dependency in agent_nodes]
            if all(dependency in completed for dependency in dependencies):
                ordered.append(node)
                completed.add(task_id)
                progressed = True
        if not progressed:
            raise LocalRunError("Cannot resolve task execution order")
    return ordered


def merge_agent_quality_reports(job_id: str, assessments: list[QualityAssessment]) -> QualityReport:
    if not assessments:
        raise LocalRunError("Cannot build quality report without agent assessments")
    gates: list[GateResult] = []
    for assessment in assessments:
        report = assessment.report
        passed = report.decision is GateDecision.ACCEPT
        gates.append(
            GateResult(
                gate_name=f"agent_{report.target_id}_quality",
                passed=passed,
                decision=report.decision,
                required=True,
                score=report.overall_score,
                reasons=[] if passed else report.revision_notes or [f"agent {report.target_id} needs revision"],
            )
        )
    decision = aggregate_quality_decision([assessment.report.decision for assessment in assessments])
    return QualityReport(
        quality_report_id=f"qr_{job_id}_final",
        job_id=job_id,
        applies_to=QualityScope.JOB,
        target_id=job_id,
        decision=decision,
        overall_score=round(sum(assessment.report.overall_score for assessment in assessments) / len(assessments)),
        confidence_score=round(sum(assessment.report.confidence_score for assessment in assessments) / len(assessments)),
        gate_results=gates,
        revision_notes=[
            note
            for assessment in assessments
            for note in assessment.report.revision_notes
        ],
    )


def aggregate_quality_decision(decisions: list[GateDecision]) -> GateDecision:
    if any(decision is GateDecision.REJECT for decision in decisions):
        return GateDecision.REJECT
    if any(decision is GateDecision.ESCALATE for decision in decisions):
        return GateDecision.ESCALATE
    if any(decision is GateDecision.REVISE for decision in decisions):
        return GateDecision.REVISE
    return GateDecision.ACCEPT


def job_log_entry(
    job: Job,
    request_id: str,
    agents_used: list[str],
    artifacts_created: list[str],
    quality_score: int,
    error: str,
    *,
    status: JobStatus | None = None,
) -> dict:
    return {
        "job_id": job.job_id,
        "request_id": request_id,
        "intent_type": job.intent_type.value,
        "project_slug": job.project_slug,
        "status": (status or job.status).value,
        "started_at": job.created_at,
        "completed_at": utc_now(),
        "agents_used": agents_used,
        "artifacts_created": artifacts_created,
        "quality_score": quality_score,
        "error": error,
    }


def compact_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
