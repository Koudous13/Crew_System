from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

from crew_system.core.models import (
    ContextSnapshot,
    IntentType,
    Job,
    JobLimits,
    JobStatus,
    JobType,
    ModelValidationError,
    NormalizedRequest,
    Platform,
    RuntimeModel,
    TaskGraph,
    TaskNode,
    TaskType,
    require_model,
    validate_string_list,
)
from crew_system.filesystem.workspace import utc_now
from crew_system.registry.loader import AgentRegistry, AgentSelection, RegistryError

GLOBAL_RUNTIME_PROJECT_SLUG = "global_runtime"


class PlannerError(RuntimeError):
    """Raised when a job cannot be planned safely."""


@dataclass(slots=True)
class JobPlan(RuntimeModel):
    job: Job
    task_graph: TaskGraph
    selected_agents: list[str] = field(default_factory=list)
    agent_reasons: dict[str, str] = field(default_factory=dict)
    blocked_reasons: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    parallel_safe_groups: list[list[str]] = field(default_factory=list)

    def validate(self) -> None:
        require_model(self.job, Job, "JobPlan.job")
        require_model(self.task_graph, TaskGraph, "JobPlan.task_graph")
        validate_string_list(self.selected_agents, "JobPlan.selected_agents")
        if not isinstance(self.agent_reasons, dict):
            raise ModelValidationError("JobPlan.agent_reasons must be an object")
        for agent_id, reason in self.agent_reasons.items():
            if not isinstance(agent_id, str) or not agent_id:
                raise ModelValidationError("JobPlan.agent_reasons key must be text")
            if not isinstance(reason, str) or not reason:
                raise ModelValidationError("JobPlan.agent_reasons value must be text")
        validate_string_list(self.blocked_reasons, "JobPlan.blocked_reasons")
        validate_string_list(self.assumptions, "JobPlan.assumptions")
        for group in self.parallel_safe_groups:
            validate_string_list(group, "JobPlan.parallel_safe_groups[]")


class AgentRouter:
    def __init__(self, registry: AgentRegistry) -> None:
        self.registry = registry

    def select(self, request: NormalizedRequest, context: ContextSnapshot | None = None) -> AgentSelection:
        intent = request.intent
        include_optional = should_read_optional_routes(request)
        include_conditional = should_read_conditional_routes(request)
        selection = self.registry.agents_for_intent(
            intent.intent_type,
            platforms=[platform.value for platform in intent.platforms],
            include_optional=include_optional,
            include_conditional=include_conditional,
        )
        return AgentSelection(
            intent_type=selection.intent_type,
            platforms=selection.platforms,
            required=selection.required,
            platform_required=selection.platform_required,
            optional=[
                agent_id
                for agent_id in selection.optional
                if optional_agent_is_active(agent_id, request, context)
            ],
            conditional={
                condition: [
                    agent_id
                    for agent_id in agent_ids
                    if conditional_agent_is_active(condition, agent_id, request, context)
                ]
                for condition, agent_ids in selection.conditional.items()
                if [
                    agent_id
                    for agent_id in agent_ids
                    if conditional_agent_is_active(condition, agent_id, request, context)
                ]
            },
        )

    def explain(self, selection: AgentSelection) -> dict[str, str]:
        reasons: dict[str, str] = {}
        for agent_id in selection.required:
            reasons[agent_id] = f"required_by_intent:{selection.intent_type}"
        for platform in selection.platforms:
            for agent_id in selection.platform_required.get(platform, []):
                reasons[agent_id] = f"required_for_platform:{platform}"
        for agent_id in selection.optional:
            reasons[agent_id] = f"optional_route_activated:{selection.intent_type}"
        for condition, agent_ids in selection.conditional.items():
            for agent_id in agent_ids:
                reasons[agent_id] = f"conditional_route_activated:{condition}"
        return reasons


class JobPlanner:
    def __init__(self, registry: AgentRegistry) -> None:
        self.registry = registry
        self.router = AgentRouter(registry)

    def plan(
        self,
        request: NormalizedRequest,
        context: ContextSnapshot | None = None,
    ) -> JobPlan:
        project_slug = request.project_ref.project_slug if request.project_ref else GLOBAL_RUNTIME_PROJECT_SLUG
        job_id = new_job_id()
        graph_id = f"graph_{job_id}"
        blocked_reasons = blocking_reasons_for(request, context)
        now = utc_now()
        job_type = job_type_for_intent(request.intent.intent_type)

        if blocked_reasons:
            job = Job(
                job_id=job_id,
                job_type=job_type,
                project_slug=project_slug,
                intent_type=request.intent.intent_type,
                created_at=now,
                updated_at=now,
                task_graph_id=graph_id,
                status=JobStatus.WAITING_FOR_USER,
                status_reason="; ".join(blocked_reasons),
                expected_artifacts=[],
            )
            task_graph = TaskGraph(
                task_graph_id=graph_id,
                job_id=job_id,
                nodes=[
                    TaskNode(
                        task_id="human_clarification",
                        job_id=job_id,
                        task_type=TaskType.HUMAN_INPUT,
                        reason="; ".join(blocked_reasons),
                    )
                ],
            )
            return JobPlan(
                job=job,
                task_graph=task_graph,
                blocked_reasons=blocked_reasons,
                assumptions=dedupe(request.assumptions + (context.assumptions if context else [])),
            )

        try:
            selection = self.router.select(request, context)
        except RegistryError as exc:
            raise PlannerError(str(exc)) from exc

        selected_agents = selection.all_agent_ids
        for agent_id in selected_agents:
            self.registry.get_agent_definition(agent_id)

        agent_reasons = self.router.explain(selection)
        dependency_blockers: list[str] = []
        nodes = build_agent_nodes(
            job_id=job_id,
            selected_agents=selected_agents,
            agent_reasons=agent_reasons,
            registry=self.registry,
            blockers=dependency_blockers,
        )
        if dependency_blockers:
            return self._blocked_by_dependencies(
                request=request,
                context=context,
                job_id=job_id,
                graph_id=graph_id,
                job_type=job_type,
                now=now,
                blockers=dependency_blockers,
            )

        final_agent_tasks = [node.task_id for node in nodes]
        nodes.append(
            TaskNode(
                task_id="quality_gate",
                job_id=job_id,
                task_type=TaskType.VALIDATION,
                depends_on=final_agent_tasks,
                reason="validate planned agent outputs before file writes",
            )
        )
        nodes.append(
            TaskNode(
                task_id="write_artifacts",
                job_id=job_id,
                task_type=TaskType.FILE_WRITE,
                depends_on=["quality_gate"],
                output_artifacts=expected_artifacts_for(job_type, job_id),
                reason="persist approved outputs with safe writer policies",
            )
        )

        job = Job(
            job_id=job_id,
            job_type=job_type,
            project_slug=project_slug,
            intent_type=request.intent.intent_type,
            created_at=now,
            updated_at=now,
            task_graph_id=graph_id,
            status=JobStatus.QUEUED,
            expected_artifacts=expected_artifacts_for(job_type, job_id),
            limits=JobLimits(max_agent_runs=max(len(selected_agents) + 2, 1)),
        )

        return JobPlan(
            job=job,
            task_graph=TaskGraph(task_graph_id=graph_id, job_id=job_id, nodes=nodes),
            selected_agents=selected_agents,
            agent_reasons=agent_reasons,
            assumptions=dedupe(request.assumptions + (context.assumptions if context else [])),
            parallel_safe_groups=parallel_safe_groups_for(self.registry, selected_agents),
        )

    def _blocked_by_dependencies(
        self,
        *,
        request: NormalizedRequest,
        context: ContextSnapshot | None,
        job_id: str,
        graph_id: str,
        job_type: JobType,
        now: str,
        blockers: list[str],
    ) -> JobPlan:
        job = Job(
            job_id=job_id,
            job_type=job_type,
            project_slug=request.project_ref.project_slug if request.project_ref else GLOBAL_RUNTIME_PROJECT_SLUG,
            intent_type=request.intent.intent_type,
            created_at=now,
            updated_at=now,
            task_graph_id=graph_id,
            status=JobStatus.WAITING_FOR_USER,
            status_reason="; ".join(blockers),
        )
        task_graph = TaskGraph(
            task_graph_id=graph_id,
            job_id=job_id,
            nodes=[
                TaskNode(
                    task_id="dependency_blocker",
                    job_id=job_id,
                    task_type=TaskType.HUMAN_INPUT,
                    reason="; ".join(blockers),
                )
            ],
        )
        return JobPlan(
            job=job,
            task_graph=task_graph,
            blocked_reasons=blockers,
            assumptions=dedupe(request.assumptions + (context.assumptions if context else [])),
        )


def build_agent_nodes(
    *,
    job_id: str,
    selected_agents: list[str],
    agent_reasons: dict[str, str],
    registry: AgentRegistry,
    blockers: list[str],
) -> list[TaskNode]:
    selected_set = set(selected_agents)
    nodes: list[TaskNode] = []
    for agent_id in selected_agents:
        definition = registry.get_agent_definition(agent_id)
        dependencies = resolve_agent_dependencies(agent_id, selected_set, registry, blockers)
        nodes.append(
            TaskNode(
                task_id=task_id_for_agent(agent_id),
                job_id=job_id,
                task_type=TaskType.AGENT_RUN,
                agent_id=agent_id,
                reason=agent_reasons.get(agent_id, "selected_by_registry"),
                depends_on=[task_id_for_agent(dependency) for dependency in dependencies],
                input_artifacts=list(definition.required_inputs),
                output_artifacts=[definition.output_schema_name],
                max_retries=max(definition.max_iterations - 1, 0),
            )
        )
    return nodes


def resolve_agent_dependencies(
    agent_id: str,
    selected_agents: set[str],
    registry: AgentRegistry,
    blockers: list[str],
) -> list[str]:
    rules = registry.dependencies.get("dependency_rules", {})
    raw_dependencies = rules.get(agent_id, {}).get("should_run_after", [])
    resolved: list[str] = []
    known_agent_ids = set(registry.agent_ids())
    for dependency in raw_dependencies:
        if dependency in selected_agents:
            append_unique(resolved, dependency)
        elif dependency == "platform_agents":
            for platform_agent in ["facebook_native_agent", "linkedin_native_agent"]:
                if platform_agent in selected_agents:
                    append_unique(resolved, platform_agent)
        elif dependency == "content_or_strategy_generated":
            for candidate in ["copywriter", "calendar_architect", "strategist", "positioning_agent"]:
                if candidate in selected_agents:
                    append_unique(resolved, candidate)
        elif dependency == "performance_data_available":
            continue
        elif dependency in known_agent_ids:
            continue
        else:
            blockers.append(f"unknown_dependency:{agent_id}->{dependency}")
    return resolved


def blocking_reasons_for(
    request: NormalizedRequest,
    context: ContextSnapshot | None,
) -> list[str]:
    blockers: list[str] = []
    for item in request.missing_information:
        if item in {"project", "platform", "volume", "project_name", "clarification"}:
            blockers.append(f"missing_information:{item}")

    intent_type = request.intent.intent_type
    if intent_type in {
        IntentType.GENERATE_CONTENT_BATCH,
        IntentType.GENERATE_VIDEO_BATCH,
        IntentType.GENERATE_VISUAL_BATCH,
        IntentType.REVISE_CONTENT_BATCH,
        IntentType.ANALYZE_PERFORMANCE,
    }:
        if context is None:
            blockers.append("missing_context_snapshot")
        elif context.missing_files:
            for path in context.missing_files:
                blockers.append(f"missing_context:{path}")

    if intent_type is IntentType.UNKNOWN_OR_AMBIGUOUS:
        blockers.append("unknown_or_ambiguous_intent")

    return dedupe(blockers)


def job_type_for_intent(intent_type: IntentType) -> JobType:
    mapping = {
        IntentType.CREATE_PROJECT_FROM_IDEA: JobType.PROJECT_BOOTSTRAP,
        IntentType.CREATE_CAMPAIGN_PACK: JobType.CAMPAIGN_PACK,
        IntentType.GENERATE_ANNUAL_CALENDAR: JobType.ANNUAL_CALENDAR,
        IntentType.GENERATE_CONTENT_BATCH: JobType.CONTENT_BATCH,
        IntentType.GENERATE_VIDEO_BATCH: JobType.CONTENT_BATCH,
        IntentType.GENERATE_VISUAL_BATCH: JobType.CONTENT_BATCH,
        IntentType.REVISE_DOCUMENT: JobType.REVISION,
        IntentType.REVISE_CONTENT_BATCH: JobType.REVISION,
        IntentType.ANALYZE_PERFORMANCE: JobType.ANALYSIS,
        IntentType.ANSWER_PROJECT_QUESTION: JobType.MAINTENANCE,
        IntentType.LIST_PROJECTS: JobType.MAINTENANCE,
        IntentType.SHOW_JOB_STATUS: JobType.MAINTENANCE,
        IntentType.ARCHIVE_PROJECT_OR_BATCH: JobType.MAINTENANCE,
        IntentType.UNKNOWN_OR_AMBIGUOUS: JobType.MAINTENANCE,
    }
    return mapping[intent_type]


def expected_artifacts_for(job_type: JobType, job_id: str) -> list[str]:
    if job_type is JobType.PROJECT_BOOTSTRAP:
        return ["brief/normalized_brief.json", "memory/project_file_plan.json"]
    if job_type is JobType.CAMPAIGN_PACK:
        return [
            "outputs/campaign_packs/campaign_pack.md",
            "strategy/strategic_diagnosis.md",
            "strategy/audience_intelligence.md",
            "strategy/positioning.md",
            "strategy/influence_architecture.md",
            "strategy/growth_system.md",
        ]
    if job_type is JobType.ANNUAL_CALENDAR:
        return ["calendar/annual_editorial_calendar.md", "calendar/annual_editorial_calendar.json"]
    if job_type is JobType.CONTENT_BATCH:
        return [
            f"outputs/batches/{job_id}/content_batch.md",
            f"outputs/batches/{job_id}/content_batch.json",
        ]
    if job_type is JobType.REVISION:
        return [f"outputs/revisions/{job_id}/revision.md", f"outputs/revisions/{job_id}/revision.json"]
    if job_type is JobType.ANALYSIS:
        return [f"performance/reports/{job_id}/analysis.md", f"performance/reports/{job_id}/analysis.json"]
    return [f"logs/jobs/{job_id}/runtime_report.json"]


def should_read_optional_routes(request: NormalizedRequest) -> bool:
    intent_type = request.intent.intent_type
    return intent_type in {
        IntentType.CREATE_PROJECT_FROM_IDEA,
        IntentType.CREATE_CAMPAIGN_PACK,
        IntentType.GENERATE_ANNUAL_CALENDAR,
        IntentType.GENERATE_VIDEO_BATCH,
        IntentType.GENERATE_VISUAL_BATCH,
        IntentType.ANALYZE_PERFORMANCE,
    }


def should_read_conditional_routes(request: NormalizedRequest) -> bool:
    return request.intent.intent_type in {
        IntentType.GENERATE_CONTENT_BATCH,
        IntentType.REVISE_CONTENT_BATCH,
    }


def optional_agent_is_active(
    agent_id: str,
    request: NormalizedRequest,
    context: ContextSnapshot | None,
) -> bool:
    assets = request.intent.requested_assets
    text = request.normalized_message.lower()
    if agent_id == "creative_director":
        return assets.images or assets.carousels or request.intent.intent_type is IntentType.GENERATE_ANNUAL_CALENDAR
    if agent_id == "video_agent":
        return assets.videos
    if agent_id == "experimentation_agent":
        return has_any(text, ["a/b", "ab test", "experiment", "test", "growth", "performance"])
    if agent_id == "anti_banality_agent":
        return True
    if agent_id == "risk_reviewer":
        return risk_review_is_useful(request, context)
    if agent_id == "growth_hacker":
        return request.intent.intent_type is IntentType.ANALYZE_PERFORMANCE
    if agent_id == "audience_psychologist":
        return request.intent.intent_type is IntentType.ANALYZE_PERFORMANCE
    return True


def conditional_agent_is_active(
    condition: str,
    agent_id: str,
    request: NormalizedRequest,
    context: ContextSnapshot | None,
) -> bool:
    assets = request.intent.requested_assets
    if agent_id == "creative_director":
        return assets.images or assets.carousels
    if agent_id == "video_agent":
        return assets.videos
    if agent_id == "growth_hacker":
        return request.intent.intent_type is IntentType.GENERATE_CONTENT_BATCH or has_any(
            request.normalized_message.lower(),
            ["growth", "hack", "viral", "commentaires", "leads", "amplification"],
        )
    if agent_id == "risk_reviewer":
        return risk_review_is_useful(request, context)
    if agent_id == "hook_master":
        return "hooks" in condition or "hook" in request.normalized_message.lower()
    return True


def risk_review_is_useful(request: NormalizedRequest, context: ContextSnapshot | None) -> bool:
    text = request.normalized_message.lower()
    risky_terms = [
        "promesse",
        "claim",
        "garanti",
        "manipulation",
        "argent",
        "sante",
        "finance",
        "agressif",
        "viral",
    ]
    if request.intent.intent_type in {
        IntentType.GENERATE_CONTENT_BATCH,
        IntentType.GENERATE_VIDEO_BATCH,
        IntentType.CREATE_CAMPAIGN_PACK,
    }:
        return True
    if has_any(text, risky_terms):
        return True
    if context and any("risk" in point.lower() for point in context.useful_points):
        return True
    return False


def parallel_safe_groups_for(registry: AgentRegistry, selected_agents: list[str]) -> list[list[str]]:
    selected = set(selected_agents)
    groups = registry.dependencies.get("parallel_safe_groups", [])
    safe_groups: list[list[str]] = []
    for group in groups:
        if not isinstance(group, list):
            continue
        filtered = [agent_id for agent_id in group if agent_id in selected]
        if len(filtered) > 1:
            safe_groups.append(filtered)
    return safe_groups


def task_id_for_agent(agent_id: str) -> str:
    return f"agent_{agent_id}"


def new_job_id() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"job_{timestamp}_{uuid4().hex[:8]}"


def has_any(text: str, needles: list[str]) -> bool:
    return any(needle in text for needle in needles)


def append_unique(items: list[str], item: str) -> None:
    if item not in items:
        items.append(item)


def dedupe(items: list[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        if item not in result:
            result.append(item)
    return result
