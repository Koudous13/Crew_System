from __future__ import annotations

import json
import re
from dataclasses import MISSING, dataclass, field, fields, is_dataclass
from enum import Enum
from types import UnionType
from typing import Any, TypeVar, Union, get_args, get_origin, get_type_hints


T = TypeVar("T", bound="RuntimeModel")

PROJECT_SLUG_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")
IDENTIFIER_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_:-]*$")
VAGUE_PROJECT_SLUGS = {"new_project", "test", "project", "projet"}


class ModelValidationError(ValueError):
    """Raised when a runtime model violates its contract."""


class RuntimeModel:
    """Base class for strict runtime models."""

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        return None

    def to_dict(self) -> dict[str, Any]:
        return _to_plain(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, sort_keys=True)

    @classmethod
    def from_dict(cls: type[T], data: dict[str, Any]) -> T:
        if not isinstance(data, dict):
            raise ModelValidationError(f"{cls.__name__}.from_dict expects an object")

        type_hints = get_type_hints(cls)
        field_names = {model_field.name for model_field in fields(cls) if model_field.init}
        unknown_fields = sorted(set(data) - field_names)
        if unknown_fields:
            joined = ", ".join(unknown_fields)
            raise ModelValidationError(f"Unknown field(s) for {cls.__name__}: {joined}")

        kwargs: dict[str, Any] = {}
        for model_field in fields(cls):
            if not model_field.init:
                continue

            if model_field.name in data:
                annotation = type_hints.get(model_field.name, model_field.type)
                kwargs[model_field.name] = _coerce_value(
                    annotation,
                    data[model_field.name],
                    f"{cls.__name__}.{model_field.name}",
                )
            elif model_field.default is MISSING and model_field.default_factory is MISSING:
                raise ModelValidationError(
                    f"Missing required field '{model_field.name}' for {cls.__name__}"
                )

        return cls(**kwargs)

    @classmethod
    def from_json(cls: type[T], data: str) -> T:
        return cls.from_dict(json.loads(data))

    @classmethod
    def json_schema(cls) -> dict[str, Any]:
        type_hints = get_type_hints(cls)
        properties: dict[str, Any] = {}
        required: list[str] = []

        for model_field in fields(cls):
            if not model_field.init:
                continue
            annotation = type_hints.get(model_field.name, model_field.type)
            properties[model_field.name] = _schema_for_type(annotation)
            if model_field.default is MISSING and model_field.default_factory is MISSING:
                required.append(model_field.name)

        return {
            "title": cls.__name__,
            "type": "object",
            "additionalProperties": False,
            "properties": properties,
            "required": required,
        }


class RequestDepth(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"


class IntentType(str, Enum):
    CREATE_PROJECT_FROM_IDEA = "create_project_from_idea"
    CREATE_CAMPAIGN_PACK = "create_campaign_pack"
    GENERATE_ANNUAL_CALENDAR = "generate_annual_calendar"
    GENERATE_CONTENT_BATCH = "generate_content_batch"
    GENERATE_VIDEO_BATCH = "generate_video_batch"
    GENERATE_VISUAL_BATCH = "generate_visual_batch"
    REVISE_DOCUMENT = "revise_document"
    REVISE_CONTENT_BATCH = "revise_content_batch"
    ANALYZE_PERFORMANCE = "analyze_performance"
    ANSWER_PROJECT_QUESTION = "answer_project_question"
    LIST_PROJECTS = "list_projects"
    SHOW_JOB_STATUS = "show_job_status"
    ARCHIVE_PROJECT_OR_BATCH = "archive_project_or_batch"
    UNKNOWN_OR_AMBIGUOUS = "unknown_or_ambiguous"


class PeriodType(str, Enum):
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    CUSTOM = "custom"
    NONE = "none"


class Platform(str, Enum):
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DRAFT = "draft"


class ProjectResolutionMode(str, Enum):
    EXPLICIT = "explicit"
    ACTIVE_CONTEXT = "active_context"
    INFERRED = "inferred"
    NEW_PROJECT = "new_project"
    AMBIGUOUS = "ambiguous"
    MISSING = "missing"


class JobType(str, Enum):
    PROJECT_BOOTSTRAP = "project_bootstrap_job"
    CAMPAIGN_PACK = "campaign_pack_job"
    ANNUAL_CALENDAR = "annual_calendar_job"
    CONTENT_BATCH = "content_batch_job"
    REVISION = "revision_job"
    ANALYSIS = "analysis_job"
    MAINTENANCE = "maintenance_job"


class JobStatus(str, Enum):
    DRAFT = "draft"
    QUEUED = "queued"
    RUNNING = "running"
    WAITING_FOR_USER = "waiting_for_user"
    NEEDS_REVISION = "needs_revision"
    FAILED = "failed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskType(str, Enum):
    AGENT_RUN = "agent_run"
    VALIDATION = "validation"
    FILE_WRITE = "file_write"
    TRANSFORM = "transform"
    HUMAN_INPUT = "human_input"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING = "waiting"
    SKIPPED = "skipped"
    FAILED = "failed"
    COMPLETED = "completed"


class AgentDefinitionStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DISABLED = "disabled"
    DEPRECATED = "deprecated"


class AgentRunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ArtifactType(str, Enum):
    MARKDOWN = "markdown"
    JSON = "json"
    LOG = "log"
    MANIFEST = "manifest"
    YAML = "yaml"
    TEXT = "text"


class ArtifactStatus(str, Enum):
    DRAFT = "draft"
    READY_FOR_HUMAN_REVIEW = "ready_for_human_review"
    NEEDS_REVISION = "needs_revision"
    REJECTED = "rejected"
    APPROVED_BY_HUMAN = "approved_by_human"
    ARCHIVED = "archived"


class GateDecision(str, Enum):
    ACCEPT = "accept"
    REVISE = "revise"
    REJECT = "reject"
    ESCALATE = "escalate"


class QualityScope(str, Enum):
    JOB = "job"
    ARTIFACT = "artifact"
    AGENT_OUTPUT = "agent_output"
    CONTENT_UNIT = "content_unit"


@dataclass(slots=True)
class UserPreferences(RuntimeModel):
    language: str = "fr"
    tone: str = "strategic"
    depth: RequestDepth = RequestDepth.HIGH

    def validate(self) -> None:
        require_non_empty(self.language, "UserPreferences.language")
        require_non_empty(self.tone, "UserPreferences.tone")
        require_enum(self.depth, RequestDepth, "UserPreferences.depth")


@dataclass(slots=True)
class RuntimeContext(RuntimeModel):
    current_branch: str
    workspace_root: str

    def validate(self) -> None:
        require_non_empty(self.current_branch, "RuntimeContext.current_branch")
        require_non_empty(self.workspace_root, "RuntimeContext.workspace_root")


@dataclass(slots=True)
class ChatRequest(RuntimeModel):
    request_id: str
    conversation_id: str
    user_message: str
    received_at: str
    runtime_context: RuntimeContext
    user_preferences: UserPreferences = field(default_factory=UserPreferences)
    active_project_hint: str = ""
    attachments: list[str] = field(default_factory=list)
    referenced_files: list[str] = field(default_factory=list)
    previous_job_id: str = ""

    def validate(self) -> None:
        validate_identifier(self.request_id, "ChatRequest.request_id")
        validate_identifier(self.conversation_id, "ChatRequest.conversation_id")
        require_non_empty(self.user_message, "ChatRequest.user_message")
        require_non_empty(self.received_at, "ChatRequest.received_at")
        require_model(
            self.runtime_context,
            RuntimeContext,
            "ChatRequest.runtime_context",
        )
        require_model(
            self.user_preferences,
            UserPreferences,
            "ChatRequest.user_preferences",
        )
        validate_string_list(self.attachments, "ChatRequest.attachments")
        validate_string_list(self.referenced_files, "ChatRequest.referenced_files")


@dataclass(slots=True)
class PeriodHint(RuntimeModel):
    period_type: PeriodType = PeriodType.NONE
    value: str = ""

    def validate(self) -> None:
        require_enum(self.period_type, PeriodType, "PeriodHint.period_type")
        if self.period_type is not PeriodType.NONE:
            require_non_empty(self.value, "PeriodHint.value")


@dataclass(slots=True)
class RequestedVolume(RuntimeModel):
    total_items: int = 0
    per_platform: dict[str, int] = field(default_factory=dict)

    def validate(self) -> None:
        require_non_negative_int(self.total_items, "RequestedVolume.total_items")
        for platform, count in self.per_platform.items():
            require_non_empty(platform, "RequestedVolume.per_platform key")
            require_non_negative_int(count, f"RequestedVolume.per_platform[{platform}]")


@dataclass(slots=True)
class RequestedAssets(RuntimeModel):
    text: bool = True
    images: bool = False
    videos: bool = False
    carousels: bool = False

    def validate(self) -> None:
        require_bool(self.text, "RequestedAssets.text")
        require_bool(self.images, "RequestedAssets.images")
        require_bool(self.videos, "RequestedAssets.videos")
        require_bool(self.carousels, "RequestedAssets.carousels")


@dataclass(slots=True)
class OutputExpectation(RuntimeModel):
    files_required: bool = True
    chat_only: bool = False
    markdown: bool = True
    json: bool = True

    def validate(self) -> None:
        require_bool(self.files_required, "OutputExpectation.files_required")
        require_bool(self.chat_only, "OutputExpectation.chat_only")
        require_bool(self.markdown, "OutputExpectation.markdown")
        require_bool(self.json, "OutputExpectation.json")
        if not self.files_required and not self.chat_only:
            raise ModelValidationError("OutputExpectation needs files or chat output")


@dataclass(slots=True)
class Intent(RuntimeModel):
    intent_type: IntentType
    confidence_score: int
    project_required: bool
    project_hint: str = ""
    period_hint: PeriodHint = field(default_factory=PeriodHint)
    platforms: list[Platform] = field(default_factory=list)
    requested_volume: RequestedVolume = field(default_factory=RequestedVolume)
    requested_assets: RequestedAssets = field(default_factory=RequestedAssets)
    output_expectation: OutputExpectation = field(default_factory=OutputExpectation)
    missing_information: list[str] = field(default_factory=list)
    ambiguity_flags: list[str] = field(default_factory=list)

    def validate(self) -> None:
        require_enum(self.intent_type, IntentType, "Intent.intent_type")
        require_bool(self.project_required, "Intent.project_required")
        validate_score(self.confidence_score, "Intent.confidence_score")
        require_model(self.period_hint, PeriodHint, "Intent.period_hint")
        require_model(
            self.requested_volume,
            RequestedVolume,
            "Intent.requested_volume",
        )
        require_model(
            self.requested_assets,
            RequestedAssets,
            "Intent.requested_assets",
        )
        require_model(
            self.output_expectation,
            OutputExpectation,
            "Intent.output_expectation",
        )
        validate_enum_list(self.platforms, Platform, "Intent.platforms")
        validate_string_list(self.missing_information, "Intent.missing_information")
        validate_string_list(self.ambiguity_flags, "Intent.ambiguity_flags")
        if self.intent_type is IntentType.UNKNOWN_OR_AMBIGUOUS and not self.ambiguity_flags:
            raise ModelValidationError("Intent.ambiguity_flags is required for unknown intent")


@dataclass(slots=True)
class ProjectRef(RuntimeModel):
    project_slug: str
    project_name: str
    root_path: str
    project_manifest_path: str
    status: ProjectStatus = ProjectStatus.ACTIVE
    resolution_mode: ProjectResolutionMode = ProjectResolutionMode.EXPLICIT
    source_brief_path: str = ""
    campaign_pack_path: str = ""
    annual_calendar_path: str = ""
    active_outputs_path: str = ""

    def validate(self) -> None:
        require_enum(self.status, ProjectStatus, "ProjectRef.status")
        require_enum(self.resolution_mode, ProjectResolutionMode, "ProjectRef.resolution_mode")
        validate_project_slug(self.project_slug, "ProjectRef.project_slug")
        require_non_empty(self.project_name, "ProjectRef.project_name")
        require_non_empty(self.root_path, "ProjectRef.root_path")
        require_non_empty(self.project_manifest_path, "ProjectRef.project_manifest_path")


@dataclass(slots=True)
class NormalizedRequest(RuntimeModel):
    request_id: str
    normalized_message: str
    intent: Intent
    project_ref: ProjectRef | None = None
    missing_information: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)

    def validate(self) -> None:
        validate_identifier(self.request_id, "NormalizedRequest.request_id")
        require_non_empty(self.normalized_message, "NormalizedRequest.normalized_message")
        require_model(self.intent, Intent, "NormalizedRequest.intent")
        if self.project_ref is not None:
            require_model(self.project_ref, ProjectRef, "NormalizedRequest.project_ref")
        validate_string_list(self.missing_information, "NormalizedRequest.missing_information")
        validate_string_list(self.assumptions, "NormalizedRequest.assumptions")
        if self.intent.project_required and self.project_ref is None:
            raise ModelValidationError("NormalizedRequest.project_ref is required by intent")


@dataclass(slots=True)
class ContextFile(RuntimeModel):
    path: str
    required: bool = True
    missing: bool = False
    artifact_id: str = ""
    summary: str = ""

    def validate(self) -> None:
        require_non_empty(self.path, "ContextFile.path")
        require_bool(self.required, "ContextFile.required")
        require_bool(self.missing, "ContextFile.missing")


@dataclass(slots=True)
class ContextSnapshot(RuntimeModel):
    job_id: str
    project_slug: str
    created_at: str
    files_loaded: list[ContextFile] = field(default_factory=list)
    missing_files: list[str] = field(default_factory=list)
    useful_points: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)

    def validate(self) -> None:
        validate_identifier(self.job_id, "ContextSnapshot.job_id")
        validate_project_slug(self.project_slug, "ContextSnapshot.project_slug")
        require_non_empty(self.created_at, "ContextSnapshot.created_at")
        validate_model_list(self.files_loaded, ContextFile, "ContextSnapshot.files_loaded")
        validate_string_list(self.missing_files, "ContextSnapshot.missing_files")
        validate_string_list(self.useful_points, "ContextSnapshot.useful_points")
        validate_string_list(self.assumptions, "ContextSnapshot.assumptions")


@dataclass(slots=True)
class JobLimits(RuntimeModel):
    max_agent_runs: int = 20
    max_iterations_per_agent: int = 3
    timeout_seconds: int = 3600

    def validate(self) -> None:
        require_positive_int(self.max_agent_runs, "JobLimits.max_agent_runs")
        require_positive_int(self.max_iterations_per_agent, "JobLimits.max_iterations_per_agent")
        require_positive_int(self.timeout_seconds, "JobLimits.timeout_seconds")


@dataclass(slots=True)
class Job(RuntimeModel):
    job_id: str
    job_type: JobType
    project_slug: str
    intent_type: IntentType
    created_at: str
    updated_at: str
    task_graph_id: str
    status: JobStatus = JobStatus.DRAFT
    expected_artifacts: list[str] = field(default_factory=list)
    limits: JobLimits = field(default_factory=JobLimits)
    status_reason: str = ""

    def validate(self) -> None:
        require_enum(self.job_type, JobType, "Job.job_type")
        require_enum(self.intent_type, IntentType, "Job.intent_type")
        require_enum(self.status, JobStatus, "Job.status")
        validate_identifier(self.job_id, "Job.job_id")
        validate_project_slug(self.project_slug, "Job.project_slug")
        require_non_empty(self.created_at, "Job.created_at")
        require_non_empty(self.updated_at, "Job.updated_at")
        validate_identifier(self.task_graph_id, "Job.task_graph_id")
        validate_string_list(self.expected_artifacts, "Job.expected_artifacts")
        require_model(self.limits, JobLimits, "Job.limits")


@dataclass(slots=True)
class TaskNode(RuntimeModel):
    task_id: str
    job_id: str
    task_type: TaskType
    status: TaskStatus = TaskStatus.PENDING
    agent_id: str = ""
    reason: str = ""
    depends_on: list[str] = field(default_factory=list)
    input_artifacts: list[str] = field(default_factory=list)
    output_artifacts: list[str] = field(default_factory=list)
    retries: int = 0
    max_retries: int = 0
    error: str = ""

    def validate(self) -> None:
        require_enum(self.task_type, TaskType, "TaskNode.task_type")
        require_enum(self.status, TaskStatus, "TaskNode.status")
        validate_identifier(self.task_id, "TaskNode.task_id")
        validate_identifier(self.job_id, "TaskNode.job_id")
        validate_string_list(self.depends_on, "TaskNode.depends_on")
        validate_string_list(self.input_artifacts, "TaskNode.input_artifacts")
        validate_string_list(self.output_artifacts, "TaskNode.output_artifacts")
        require_non_negative_int(self.retries, "TaskNode.retries")
        require_non_negative_int(self.max_retries, "TaskNode.max_retries")
        if self.retries > self.max_retries:
            raise ModelValidationError("TaskNode.retries cannot exceed max_retries")
        if self.task_type is TaskType.AGENT_RUN:
            validate_agent_id(self.agent_id, "TaskNode.agent_id")


@dataclass(slots=True)
class TaskGraph(RuntimeModel):
    task_graph_id: str
    job_id: str
    nodes: list[TaskNode]

    def validate(self) -> None:
        validate_identifier(self.task_graph_id, "TaskGraph.task_graph_id")
        validate_identifier(self.job_id, "TaskGraph.job_id")
        validate_model_list(self.nodes, TaskNode, "TaskGraph.nodes")
        if not self.nodes:
            raise ModelValidationError("TaskGraph.nodes cannot be empty")

        node_ids = [node.task_id for node in self.nodes]
        if len(set(node_ids)) != len(node_ids):
            raise ModelValidationError("TaskGraph.nodes contains duplicate task_id")

        node_id_set = set(node_ids)
        for node in self.nodes:
            if node.job_id != self.job_id:
                raise ModelValidationError("TaskGraph node job_id does not match graph job_id")
            for dependency in node.depends_on:
                if dependency == node.task_id:
                    raise ModelValidationError("TaskGraph node cannot depend on itself")
                if dependency not in node_id_set:
                    raise ModelValidationError(
                        f"TaskGraph dependency '{dependency}' does not exist"
                    )

        detect_cycle(self.nodes)


@dataclass(slots=True)
class AgentDefinition(RuntimeModel):
    agent_id: str
    name: str
    version: str
    status: AgentDefinitionStatus
    prompt_path: str
    schema_path: str
    eval_path: str
    capabilities: list[str]
    required_inputs: list[str]
    output_schema_name: str
    default_mode: str = "deep_work"
    max_iterations: int = 3

    def validate(self) -> None:
        require_enum(self.status, AgentDefinitionStatus, "AgentDefinition.status")
        validate_agent_id(self.agent_id, "AgentDefinition.agent_id")
        require_non_empty(self.name, "AgentDefinition.name")
        require_non_empty(self.version, "AgentDefinition.version")
        require_non_empty(self.prompt_path, "AgentDefinition.prompt_path")
        require_non_empty(self.schema_path, "AgentDefinition.schema_path")
        require_non_empty(self.eval_path, "AgentDefinition.eval_path")
        validate_string_list(self.capabilities, "AgentDefinition.capabilities")
        validate_string_list(self.required_inputs, "AgentDefinition.required_inputs")
        require_non_empty(self.output_schema_name, "AgentDefinition.output_schema_name")
        require_positive_int(self.max_iterations, "AgentDefinition.max_iterations")


@dataclass(slots=True)
class AgentRun(RuntimeModel):
    agent_run_id: str
    job_id: str
    agent_id: str
    status: AgentRunStatus
    input_artifacts: list[str] = field(default_factory=list)
    output_artifacts: list[str] = field(default_factory=list)
    started_at: str = ""
    ended_at: str = ""
    quality_score: int | None = None
    confidence_score: int | None = None
    error: str = ""

    def validate(self) -> None:
        require_enum(self.status, AgentRunStatus, "AgentRun.status")
        validate_identifier(self.agent_run_id, "AgentRun.agent_run_id")
        validate_identifier(self.job_id, "AgentRun.job_id")
        validate_agent_id(self.agent_id, "AgentRun.agent_id")
        validate_string_list(self.input_artifacts, "AgentRun.input_artifacts")
        validate_string_list(self.output_artifacts, "AgentRun.output_artifacts")
        validate_score(self.quality_score, "AgentRun.quality_score", allow_none=True)
        validate_score(self.confidence_score, "AgentRun.confidence_score", allow_none=True)
        if self.status is AgentRunStatus.FAILED and not self.error:
            raise ModelValidationError("AgentRun.error is required when status is failed")


@dataclass(slots=True)
class Artifact(RuntimeModel):
    artifact_id: str
    job_id: str
    project_slug: str
    artifact_type: ArtifactType
    path: str
    created_at: str
    status: ArtifactStatus = ArtifactStatus.DRAFT
    created_by_agents: list[str] = field(default_factory=list)
    source_files: list[str] = field(default_factory=list)
    schema_name: str = ""
    human_approved_by: str = ""

    def validate(self) -> None:
        require_enum(self.artifact_type, ArtifactType, "Artifact.artifact_type")
        require_enum(self.status, ArtifactStatus, "Artifact.status")
        validate_identifier(self.artifact_id, "Artifact.artifact_id")
        validate_identifier(self.job_id, "Artifact.job_id")
        validate_project_slug(self.project_slug, "Artifact.project_slug")
        require_non_empty(self.path, "Artifact.path")
        require_non_empty(self.created_at, "Artifact.created_at")
        for agent_id in self.created_by_agents:
            validate_agent_id(agent_id, "Artifact.created_by_agents")
        validate_string_list(self.source_files, "Artifact.source_files")
        if self.status is ArtifactStatus.APPROVED_BY_HUMAN:
            require_non_empty(self.human_approved_by, "Artifact.human_approved_by")


@dataclass(slots=True)
class GateResult(RuntimeModel):
    gate_name: str
    passed: bool
    decision: GateDecision
    required: bool = True
    score: int | None = None
    reasons: list[str] = field(default_factory=list)

    def validate(self) -> None:
        require_enum(self.decision, GateDecision, "GateResult.decision")
        require_bool(self.passed, "GateResult.passed")
        require_bool(self.required, "GateResult.required")
        require_non_empty(self.gate_name, "GateResult.gate_name")
        validate_score(self.score, "GateResult.score", allow_none=True)
        validate_string_list(self.reasons, "GateResult.reasons")
        if not self.passed and not self.reasons:
            raise ModelValidationError("GateResult.reasons is required when gate fails")


@dataclass(slots=True)
class QualityReport(RuntimeModel):
    quality_report_id: str
    job_id: str
    applies_to: QualityScope
    target_id: str
    decision: GateDecision
    overall_score: int
    confidence_score: int
    gate_results: list[GateResult] = field(default_factory=list)
    revision_notes: list[str] = field(default_factory=list)

    def validate(self) -> None:
        require_enum(self.applies_to, QualityScope, "QualityReport.applies_to")
        require_enum(self.decision, GateDecision, "QualityReport.decision")
        validate_identifier(self.quality_report_id, "QualityReport.quality_report_id")
        validate_identifier(self.job_id, "QualityReport.job_id")
        require_non_empty(self.target_id, "QualityReport.target_id")
        validate_score(self.overall_score, "QualityReport.overall_score")
        validate_score(self.confidence_score, "QualityReport.confidence_score")
        validate_model_list(self.gate_results, GateResult, "QualityReport.gate_results")
        validate_string_list(self.revision_notes, "QualityReport.revision_notes")
        if not self.gate_results:
            raise ModelValidationError("QualityReport.gate_results cannot be empty")
        failed_required = [
            gate.gate_name for gate in self.gate_results if gate.required and not gate.passed
        ]
        if self.decision is GateDecision.ACCEPT and failed_required:
            joined = ", ".join(failed_required)
            raise ModelValidationError(f"QualityReport cannot accept failed gates: {joined}")


@dataclass(slots=True)
class FinalChatResponse(RuntimeModel):
    job_id: str
    project_slug: str
    status: JobStatus
    message: str
    created_at: str
    artifacts_created: list[str] = field(default_factory=list)
    next_actions: list[str] = field(default_factory=list)

    def validate(self) -> None:
        require_enum(self.status, JobStatus, "FinalChatResponse.status")
        validate_identifier(self.job_id, "FinalChatResponse.job_id")
        validate_project_slug(self.project_slug, "FinalChatResponse.project_slug")
        require_non_empty(self.message, "FinalChatResponse.message")
        require_non_empty(self.created_at, "FinalChatResponse.created_at")
        validate_string_list(self.artifacts_created, "FinalChatResponse.artifacts_created")
        validate_string_list(self.next_actions, "FinalChatResponse.next_actions")


def require_non_empty(value: str, field_name: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ModelValidationError(f"{field_name} must be a non-empty string")


def require_positive_int(value: int, field_name: str) -> None:
    if type(value) is not int or value <= 0:
        raise ModelValidationError(f"{field_name} must be a positive integer")


def require_non_negative_int(value: int, field_name: str) -> None:
    if type(value) is not int or value < 0:
        raise ModelValidationError(f"{field_name} must be a non-negative integer")


def require_bool(value: bool, field_name: str) -> None:
    if type(value) is not bool:
        raise ModelValidationError(f"{field_name} must be a boolean")


def require_enum(value: Enum, enum_type: type[Enum], field_name: str) -> None:
    if not isinstance(value, enum_type):
        raise ModelValidationError(
            f"{field_name} must be one of {[item.value for item in enum_type]}"
        )


def require_model(value: Any, model_type: type[RuntimeModel], field_name: str) -> None:
    if not isinstance(value, model_type):
        raise ModelValidationError(f"{field_name} must be a {model_type.__name__} object")


def validate_identifier(value: str, field_name: str) -> None:
    require_non_empty(value, field_name)
    if not IDENTIFIER_RE.match(value):
        raise ModelValidationError(f"{field_name} must be a stable identifier")


def validate_agent_id(value: str, field_name: str) -> None:
    require_non_empty(value, field_name)
    if not PROJECT_SLUG_RE.match(value):
        raise ModelValidationError(f"{field_name} must be snake_case ASCII")


def validate_project_slug(value: str, field_name: str) -> None:
    require_non_empty(value, field_name)
    if not PROJECT_SLUG_RE.match(value):
        raise ModelValidationError(f"{field_name} must be snake_case ASCII")
    if value in VAGUE_PROJECT_SLUGS:
        raise ModelValidationError(f"{field_name} is too vague")


def validate_score(value: int | None, field_name: str, allow_none: bool = False) -> None:
    if value is None and allow_none:
        return
    if type(value) is not int or value < 0 or value > 10:
        raise ModelValidationError(f"{field_name} must be an integer between 0 and 10")


def validate_string_list(values: list[str], field_name: str) -> None:
    if not isinstance(values, list):
        raise ModelValidationError(f"{field_name} must be a list")
    for value in values:
        require_non_empty(value, field_name)


def validate_enum_list(values: list[Enum], enum_type: type[Enum], field_name: str) -> None:
    if not isinstance(values, list):
        raise ModelValidationError(f"{field_name} must be a list")
    for value in values:
        require_enum(value, enum_type, field_name)


def validate_model_list(
    values: list[RuntimeModel],
    model_type: type[RuntimeModel],
    field_name: str,
) -> None:
    if not isinstance(values, list):
        raise ModelValidationError(f"{field_name} must be a list")
    for value in values:
        require_model(value, model_type, field_name)


def detect_cycle(nodes: list[TaskNode]) -> None:
    dependency_map = {node.task_id: set(node.depends_on) for node in nodes}
    temporary: set[str] = set()
    permanent: set[str] = set()

    def visit(task_id: str) -> None:
        if task_id in permanent:
            return
        if task_id in temporary:
            raise ModelValidationError("TaskGraph contains a dependency cycle")
        temporary.add(task_id)
        for dependency in dependency_map[task_id]:
            visit(dependency)
        temporary.remove(task_id)
        permanent.add(task_id)

    for node_id in dependency_map:
        visit(node_id)


def _to_plain(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value):
        return {model_field.name: _to_plain(getattr(value, model_field.name)) for model_field in fields(value)}
    if isinstance(value, list):
        return [_to_plain(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_plain(item) for key, item in value.items()}
    return value


def _coerce_value(annotation: Any, value: Any, field_name: str) -> Any:
    if annotation is Any:
        return value

    origin = get_origin(annotation)
    args = get_args(annotation)

    if value is None:
        if _is_optional(annotation):
            return None
        raise ModelValidationError(f"{field_name} cannot be null")

    if origin in (Union, UnionType):
        errors: list[str] = []
        for option in args:
            if option is type(None):
                continue
            try:
                return _coerce_value(option, value, field_name)
            except ModelValidationError as exc:
                errors.append(str(exc))
        raise ModelValidationError(f"{field_name} does not match allowed types: {errors}")

    if origin is list:
        if not isinstance(value, list):
            raise ModelValidationError(f"{field_name} must be a list")
        item_type = args[0] if args else Any
        return [_coerce_value(item_type, item, f"{field_name}[]") for item in value]

    if origin is dict:
        if not isinstance(value, dict):
            raise ModelValidationError(f"{field_name} must be an object")
        key_type = args[0] if args else str
        value_type = args[1] if len(args) > 1 else Any
        return {
            _coerce_value(key_type, key, f"{field_name}.key"): _coerce_value(
                value_type,
                item,
                f"{field_name}[{key}]",
            )
            for key, item in value.items()
        }

    if isinstance(annotation, type) and issubclass(annotation, Enum):
        if isinstance(value, annotation):
            return value
        try:
            return annotation(value)
        except ValueError as exc:
            raise ModelValidationError(
                f"{field_name} must be one of {[item.value for item in annotation]}"
            ) from exc

    if isinstance(annotation, type) and issubclass(annotation, RuntimeModel):
        if isinstance(value, annotation):
            return value
        if isinstance(value, dict):
            return annotation.from_dict(value)
        raise ModelValidationError(f"{field_name} must be an object")

    if annotation is str:
        if type(value) is not str:
            raise ModelValidationError(f"{field_name} must be a string")
        return value

    if annotation is int:
        if type(value) is not int:
            raise ModelValidationError(f"{field_name} must be an integer")
        return value

    if annotation is bool:
        if type(value) is not bool:
            raise ModelValidationError(f"{field_name} must be a boolean")
        return value

    return value


def _is_optional(annotation: Any) -> bool:
    origin = get_origin(annotation)
    if origin not in (Union, UnionType):
        return False
    return type(None) in get_args(annotation)


def _schema_for_type(annotation: Any) -> dict[str, Any]:
    origin = get_origin(annotation)
    args = get_args(annotation)

    if origin in (Union, UnionType):
        non_null = [item for item in args if item is not type(None)]
        schema = {"anyOf": [_schema_for_type(item) for item in non_null]}
        if len(non_null) < len(args):
            schema["nullable"] = True
        return schema

    if origin is list:
        item_type = args[0] if args else Any
        return {"type": "array", "items": _schema_for_type(item_type)}

    if origin is dict:
        value_type = args[1] if len(args) > 1 else Any
        return {"type": "object", "additionalProperties": _schema_for_type(value_type)}

    if annotation is str:
        return {"type": "string"}
    if annotation is int:
        return {"type": "integer"}
    if annotation is bool:
        return {"type": "boolean"}
    if annotation is Any:
        return {}

    if isinstance(annotation, type) and issubclass(annotation, Enum):
        return {"type": "string", "enum": [item.value for item in annotation]}

    if isinstance(annotation, type) and issubclass(annotation, RuntimeModel):
        return {"type": "object", "title": annotation.__name__}

    return {}
