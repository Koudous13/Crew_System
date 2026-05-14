from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from crew_system.agents.runner import AgentOutput
from crew_system.core.models import (
    Artifact,
    ArtifactStatus,
    ArtifactType,
    GateDecision,
    Job,
    JobType,
    QualityReport,
    RuntimeModel,
    require_bool,
    require_enum,
    require_model,
    require_non_empty,
    validate_model_list,
    validate_string_list,
)
from crew_system.filesystem import SafeFileWriter, SafeWriteResult, WorkspaceEngine, WriteMode
from crew_system.filesystem.workspace import utc_now


class DeliverableWriterError(RuntimeError):
    """Raised when deliverables cannot be written safely."""


@dataclass(slots=True)
class WriteTarget(RuntimeModel):
    relative_path: str
    artifact_type: ArtifactType
    write_mode: WriteMode
    source_task_id: str
    validation_required: bool = True

    def validate(self) -> None:
        require_non_empty(self.relative_path, "WriteTarget.relative_path")
        require_enum(self.artifact_type, ArtifactType, "WriteTarget.artifact_type")
        require_enum(self.write_mode, WriteMode, "WriteTarget.write_mode")
        require_non_empty(self.source_task_id, "WriteTarget.source_task_id")
        require_bool(self.validation_required, "WriteTarget.validation_required")


@dataclass(slots=True)
class WritePlan(RuntimeModel):
    job_id: str
    project_slug: str
    files: list[WriteTarget]

    def validate(self) -> None:
        require_non_empty(self.job_id, "WritePlan.job_id")
        require_non_empty(self.project_slug, "WritePlan.project_slug")
        validate_model_list(self.files, WriteTarget, "WritePlan.files")
        if not self.files:
            raise DeliverableWriterError("WritePlan.files cannot be empty")


@dataclass(slots=True)
class DeliverableWriteResult(RuntimeModel):
    job_id: str
    project_slug: str
    artifacts: list[Artifact] = field(default_factory=list)
    writes: list[SafeWriteResult] = field(default_factory=list)

    def validate(self) -> None:
        require_non_empty(self.job_id, "DeliverableWriteResult.job_id")
        require_non_empty(self.project_slug, "DeliverableWriteResult.project_slug")
        validate_model_list(self.artifacts, Artifact, "DeliverableWriteResult.artifacts")
        validate_model_list(self.writes, SafeWriteResult, "DeliverableWriteResult.writes")


class DeliverableWriter:
    def __init__(self, workspace: WorkspaceEngine) -> None:
        self.workspace = workspace

    def write(
        self,
        *,
        plan: WritePlan,
        quality_report: QualityReport,
        agent_outputs: dict[str, AgentOutput],
        agents_used: list[str],
        status: ArtifactStatus | None = None,
    ) -> DeliverableWriteResult:
        artifact_status = status or artifact_status_for_quality(quality_report)
        writer = SafeFileWriter(
            self.workspace.project_path(plan.project_slug),
            self.workspace.workspace_root / "tmp",
        )
        artifacts: list[Artifact] = []
        writes: list[SafeWriteResult] = []
        for target in plan.files:
            content = render_target_content(
                plan=plan,
                target=target,
                quality_report=quality_report,
                agent_outputs=agent_outputs,
                agents_used=agents_used,
                status=artifact_status,
            )
            write_result = writer.write_text(
                target.relative_path,
                content,
                job_id=plan.job_id,
                mode=target.write_mode,
            )
            artifact = Artifact(
                artifact_id=artifact_id_for(plan.job_id, target.relative_path),
                job_id=plan.job_id,
                project_slug=plan.project_slug,
                artifact_type=target.artifact_type,
                path=target.relative_path,
                created_at=utc_now(),
                status=artifact_status,
                created_by_agents=agents_used,
                source_files=[target.source_task_id],
                schema_name=schema_name_for(target),
            )
            self.workspace.register_artifact(
                artifact,
                content_hash=write_result.content_hash,
            )
            writes.append(write_result)
            artifacts.append(artifact)
        return DeliverableWriteResult(
            job_id=plan.job_id,
            project_slug=plan.project_slug,
            artifacts=artifacts,
            writes=writes,
        )


def build_write_plan(job: Job) -> WritePlan:
    paths = job.expected_artifacts or default_artifact_paths(job)
    targets = [write_target_for_path(path, "write_artifacts") for path in paths]
    targets.extend(
        [
            WriteTarget(
                relative_path=f"reviews/quality_reviews/{job.job_id}_quality_report.md",
                artifact_type=ArtifactType.MARKDOWN,
                write_mode=WriteMode.OVERWRITE_WITH_VERSION,
                source_task_id="quality_gate",
            ),
            WriteTarget(
                relative_path=f"reviews/quality_reviews/{job.job_id}_quality_report.json",
                artifact_type=ArtifactType.JSON,
                write_mode=WriteMode.OVERWRITE_WITH_VERSION,
                source_task_id="quality_gate",
            ),
            WriteTarget(
                relative_path=f"logs/jobs/{job.job_id}/run_summary.json",
                artifact_type=ArtifactType.JSON,
                write_mode=WriteMode.OVERWRITE_WITH_VERSION,
                source_task_id="write_artifacts",
            ),
        ]
    )
    return WritePlan(job_id=job.job_id, project_slug=job.project_slug, files=targets)


def default_artifact_paths(job: Job) -> list[str]:
    if job.job_type is JobType.CAMPAIGN_PACK:
        return [
            f"outputs/campaign_packs/{job.job_id}/campaign_pack.md",
            f"outputs/campaign_packs/{job.job_id}/campaign_pack.json",
        ]
    if job.job_type is JobType.ANNUAL_CALENDAR:
        return [
            f"calendar/campaign_calendars/{job.job_id}/annual_calendar.md",
            f"calendar/campaign_calendars/{job.job_id}/annual_calendar.json",
        ]
    if job.job_type is JobType.CONTENT_BATCH:
        return [
            f"outputs/batches/{job.job_id}/content_batch.md",
            f"outputs/batches/{job.job_id}/content_batch.json",
            f"outputs/batches/{job.job_id}/posts_ready.md",
        ]
    if job.job_type is JobType.REVISION:
        return [
            f"outputs/revisions/{job.job_id}/revision.md",
            f"outputs/revisions/{job.job_id}/revision.json",
        ]
    return [
        f"logs/jobs/{job.job_id}/runtime_report.md",
        f"logs/jobs/{job.job_id}/runtime_report.json",
    ]


def write_target_for_path(path: str, source_task_id: str) -> WriteTarget:
    artifact_type = artifact_type_for_path(path)
    return WriteTarget(
        relative_path=path,
        artifact_type=artifact_type,
        write_mode=WriteMode.OVERWRITE_WITH_VERSION,
        source_task_id=source_task_id,
    )


def artifact_type_for_path(path: str) -> ArtifactType:
    suffix = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    if suffix == "md":
        return ArtifactType.MARKDOWN
    if suffix == "json":
        return ArtifactType.JSON
    if suffix == "jsonl":
        return ArtifactType.LOG
    if suffix in {"yaml", "yml"}:
        return ArtifactType.YAML
    return ArtifactType.TEXT


def render_target_content(
    *,
    plan: WritePlan,
    target: WriteTarget,
    quality_report: QualityReport,
    agent_outputs: dict[str, AgentOutput],
    agents_used: list[str],
    status: ArtifactStatus,
) -> str:
    if is_ready_posts_target(target.relative_path):
        return render_ready_posts_payload(plan, target, quality_report, agent_outputs, status)
    if target.artifact_type is ArtifactType.JSON:
        return json.dumps(
            render_json_payload(plan, target, quality_report, agent_outputs, agents_used, status),
            indent=2,
            sort_keys=True,
        ) + "\n"
    return render_markdown_payload(plan, target, quality_report, agent_outputs, agents_used, status)


def is_ready_posts_target(path: str) -> bool:
    filename = path.rsplit("/", 1)[-1].lower()
    return filename == "posts_ready.md" or filename.endswith("_posts_ready.md")


def render_ready_posts_payload(
    plan: WritePlan,
    target: WriteTarget,
    quality_report: QualityReport,
    agent_outputs: dict[str, AgentOutput],
    status: ArtifactStatus,
) -> str:
    content_units = copywriter_content_units(agent_outputs)
    platform_label = platform_label_for_ready_path(target.relative_path, content_units)
    lines = [
        f"# Publications {platform_label} pretes a relire",
        "",
        f"- job_id: {plan.job_id}",
        f"- project_slug: {plan.project_slug}",
        f"- status: {status.value}",
        f"- quality_decision: {quality_report.decision.value}",
        f"- quality_score: {quality_report.overall_score}",
        "",
    ]
    if not content_units:
        lines.extend(
            [
                "Aucune publication redigee n'a ete trouvee dans la sortie du copywriter.",
                "",
            ]
        )
        return "\n".join(lines)

    for index, (unit_id, unit) in enumerate(sorted_content_units(content_units), start=1):
        lines.extend(render_ready_post(index, unit_id, unit))
    return "\n".join(lines).rstrip() + "\n"


def copywriter_content_units(agent_outputs: dict[str, AgentOutput]) -> dict[str, Any]:
    output = agent_outputs.get("copywriter")
    if output is None:
        return {}
    units = output.payload.get("content_units")
    return units if isinstance(units, dict) else {}


def platform_label_for_ready_path(path: str, content_units: dict[str, Any]) -> str:
    filename = path.rsplit("/", 1)[-1].lower()
    for platform in ["facebook", "linkedin"]:
        if filename.startswith(platform):
            return platform.capitalize()
    detected = sorted(
        {
            str(unit.get("platform", "")).strip().lower()
            for unit in content_units.values()
            if isinstance(unit, dict) and str(unit.get("platform", "")).strip()
        }
    )
    if len(detected) == 1:
        return detected[0].capitalize()
    return "réseaux sociaux"


def sorted_content_units(content_units: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    units = [(unit_id, unit) for unit_id, unit in content_units.items() if isinstance(unit, dict)]
    return sorted(units, key=lambda item: natural_sort_key(item[0]))


def natural_sort_key(value: str) -> list[Any]:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def render_ready_post(index: int, unit_id: str, unit: dict[str, Any]) -> list[str]:
    lines = [
        f"## Publication {index}",
        "",
        f"- id: {unit_id}",
    ]
    for label, key in [
        ("plateforme", "platform"),
        ("format", "content_type"),
        ("risque", "risk_flag"),
    ]:
        value = clean_text(unit.get(key, ""))
        if value:
            lines.append(f"- {label}: {value}")
    lines.append("")

    for title, key in [
        ("Hook", "hook"),
        ("Texte", "body"),
        ("CTA", "cta"),
        ("Visuel a prevoir", "visual_requirement"),
        ("Note de risque", "risk_note"),
    ]:
        value = clean_text(unit.get(key, ""))
        if value:
            lines.extend([f"### {title}", "", value, ""])

    extra_fields = {
        key: value
        for key, value in unit.items()
        if key
        not in {
            "platform",
            "content_type",
            "risk_flag",
            "hook",
            "body",
            "cta",
            "visual_requirement",
            "risk_note",
        }
    }
    if extra_fields:
        lines.extend(["### Notes complementaires", ""])
        for key, value in extra_fields.items():
            rendered = clean_text(value)
            if rendered:
                lines.append(f"- {key}: {rendered}")
        lines.append("")
    return lines


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value).strip()


def render_json_payload(
    plan: WritePlan,
    target: WriteTarget,
    quality_report: QualityReport,
    agent_outputs: dict[str, AgentOutput],
    agents_used: list[str],
    status: ArtifactStatus,
) -> dict[str, Any]:
    return {
        "job_id": plan.job_id,
        "project_slug": plan.project_slug,
        "path": target.relative_path,
        "status": status.value,
        "agents_used": agents_used,
        "quality_report": quality_report.to_dict(),
        "agent_outputs": {agent_id: output.to_dict() for agent_id, output in agent_outputs.items()},
    }


def render_markdown_payload(
    plan: WritePlan,
    target: WriteTarget,
    quality_report: QualityReport,
    agent_outputs: dict[str, AgentOutput],
    agents_used: list[str],
    status: ArtifactStatus,
) -> str:
    lines = [
        f"# Crew_System Deliverable",
        "",
        f"- job_id: {plan.job_id}",
        f"- project_slug: {plan.project_slug}",
        f"- path: {target.relative_path}",
        f"- status: {status.value}",
        f"- agents_used: {', '.join(agents_used) if agents_used else 'none'}",
        f"- quality_decision: {quality_report.decision.value}",
        f"- quality_score: {quality_report.overall_score}",
        "",
        "## Agent Outputs",
        "",
    ]
    if not agent_outputs:
        lines.append("No agent output was provided.")
    for agent_id, output in agent_outputs.items():
        lines.extend(
            [
                f"### {agent_id}",
                "",
                f"- schema: {output.schema_name}",
                f"- quality_score: {output.quality_score}",
                f"- confidence_score: {output.confidence_score}",
                "",
                "```json",
                json.dumps(output.payload, indent=2, sort_keys=True),
                "```",
                "",
            ]
        )
    lines.extend(
        [
            "## Quality Report",
            "",
            f"- decision: {quality_report.decision.value}",
            f"- overall_score: {quality_report.overall_score}",
            f"- confidence_score: {quality_report.confidence_score}",
            "",
        ]
    )
    if quality_report.revision_notes:
        lines.append("### Revision Notes")
        lines.append("")
        for note in quality_report.revision_notes:
            lines.append(f"- {note}")
        lines.append("")
    return "\n".join(lines)


def artifact_status_for_quality(report: QualityReport) -> ArtifactStatus:
    if report.decision is GateDecision.ACCEPT:
        return ArtifactStatus.READY_FOR_HUMAN_REVIEW
    if report.decision is GateDecision.REVISE:
        return ArtifactStatus.NEEDS_REVISION
    if report.decision is GateDecision.REJECT:
        return ArtifactStatus.REJECTED
    return ArtifactStatus.NEEDS_REVISION


def artifact_id_for(job_id: str, path: str) -> str:
    safe_path = re.sub(r"[^A-Za-z0-9_:-]+", "_", path).strip("_")
    return f"art_{job_id}_{safe_path}"


def schema_name_for(target: WriteTarget) -> str:
    if target.artifact_type is ArtifactType.JSON:
        return "CrewSystemDeliverable"
    if target.artifact_type is ArtifactType.MARKDOWN:
        return "CrewSystemMarkdownDeliverable"
    return "CrewSystemArtifact"
