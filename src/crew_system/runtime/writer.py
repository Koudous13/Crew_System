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
    if target.relative_path.startswith("reviews/quality_reviews/"):
        return render_quality_markdown_payload(plan, target, quality_report, agents_used, status)
    return render_human_markdown_payload(plan, target, quality_report, agent_outputs, agents_used, status)


def render_human_markdown_payload(
    plan: WritePlan,
    target: WriteTarget,
    quality_report: QualityReport,
    agent_outputs: dict[str, AgentOutput],
    agents_used: list[str],
    status: ArtifactStatus,
) -> str:
    selected_outputs = outputs_for_markdown_target(target.relative_path, agent_outputs)
    lines = [
        f"# {human_title_for_path(target.relative_path)}",
        "",
        f"- job_id: {plan.job_id}",
        f"- Projet : {plan.project_slug}",
        f"- Statut : {human_status(status)}",
        f"- Score qualité : {quality_report.overall_score}/10",
        "",
    ]
    if agents_used:
        lines.extend(["## Agents mobilisés", ""])
        lines.append(", ".join(agent_id.replace("_", " ") for agent_id in agents_used))
        lines.append("")

    if not selected_outputs:
        lines.extend(["## Contenu", "", "Aucun contenu exploitable n'a été fourni pour ce document.", ""])
    for output in selected_outputs:
        lines.extend(render_agent_output_as_markdown(output))

    if quality_report.revision_notes:
        lines.extend(["## Points à revoir", ""])
        for note in quality_report.revision_notes[:8]:
            lines.append(f"- {clean_text(note)}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_quality_markdown_payload(
    plan: WritePlan,
    target: WriteTarget,
    quality_report: QualityReport,
    agents_used: list[str],
    status: ArtifactStatus,
) -> str:
    lines = [
        "# Rapport qualité interne",
        "",
        f"- Job : {plan.job_id}",
        f"- Projet : {plan.project_slug}",
        f"- Chemin : {target.relative_path}",
        f"- Statut : {human_status(status)}",
        f"- Agents : {', '.join(agents_used) if agents_used else 'aucun'}",
        f"- Décision qualité : {quality_report.decision.value}",
        f"- Score qualité : {quality_report.overall_score}/10",
        "",
        "## Synthèse",
        "",
    ]
    if quality_report.revision_notes:
        lines.append("### Notes de révision")
        lines.append("")
        for note in quality_report.revision_notes:
            lines.append(f"- {note}")
        lines.append("")
    else:
        lines.append("Aucune note de révision.")
        lines.append("")
    return "\n".join(lines)


def outputs_for_markdown_target(path: str, agent_outputs: dict[str, AgentOutput]) -> list[AgentOutput]:
    lowered = path.lower()
    mapping = [
        ("strategic_diagnosis", ["strategist"]),
        ("audience_intelligence", ["audience_psychologist"]),
        ("positioning", ["positioning_agent"]),
        ("influence_architecture", ["influence_architect"]),
        ("growth_system", ["growth_hacker"]),
        ("facebook_strategy", ["facebook_native_agent"]),
        ("linkedin_strategy", ["linkedin_native_agent"]),
        ("annual_editorial_calendar", ["calendar_architect"]),
        ("annual_calendar", ["calendar_architect"]),
        ("calendar", ["calendar_architect"]),
        ("content_batch", ["copywriter", "hook_master", "creative_director", "risk_reviewer"]),
        ("revision", ["copywriter", "strategist", "anti_banality_agent", "risk_reviewer"]),
    ]
    for token, agent_ids in mapping:
        if token in lowered:
            selected = [agent_outputs[agent_id] for agent_id in agent_ids if agent_id in agent_outputs]
            return selected or list(agent_outputs.values())
    if "campaign_pack" in lowered:
        preferred_order = [
            "strategist",
            "audience_psychologist",
            "positioning_agent",
            "influence_architect",
            "growth_hacker",
            "facebook_native_agent",
            "linkedin_native_agent",
            "experimentation_agent",
            "risk_reviewer",
            "anti_banality_agent",
        ]
        ordered = [agent_outputs[agent_id] for agent_id in preferred_order if agent_id in agent_outputs]
        ordered.extend(output for agent_id, output in agent_outputs.items() if agent_id not in preferred_order)
        return ordered
    return list(agent_outputs.values())


def render_agent_output_as_markdown(output: AgentOutput) -> list[str]:
    lines = [
        f"## {human_agent_title(output.agent_id)}",
        "",
    ]
    for key, value in output.payload.items():
        if key == "self_evaluation":
            continue
        lines.extend(render_value_markdown(value, heading_label(key), 3))
    return lines


def render_value_markdown(value: Any, title: str, level: int) -> list[str]:
    heading = "#" * min(max(level, 2), 6)
    lines = [f"{heading} {title}", ""]
    if isinstance(value, dict):
        for key, item in value.items():
            lines.extend(render_item_markdown(key, item, level + 1))
    elif isinstance(value, list):
        lines.extend(render_list_markdown(value, level + 1))
    else:
        text = clean_text(value)
        if text:
            lines.extend([text, ""])
    return lines


def render_item_markdown(key: str, value: Any, level: int) -> list[str]:
    label = heading_label(key)
    if isinstance(value, dict):
        return render_value_markdown(value, label, level)
    if isinstance(value, list):
        lines = [f"{'#' * min(max(level, 2), 6)} {label}", ""]
        lines.extend(render_list_markdown(value, level + 1))
        return lines
    text = clean_text(value)
    return [f"- **{label}** : {text}", ""] if text else []


def render_list_markdown(values: list[Any], level: int) -> list[str]:
    lines: list[str] = []
    for index, item in enumerate(values, start=1):
        if isinstance(item, dict):
            lines.extend(render_value_markdown(item, f"Élément {index}", level))
        elif isinstance(item, list):
            lines.extend(render_list_markdown(item, level + 1))
        else:
            text = clean_text(item)
            if text:
                lines.append(f"- {text}")
    if lines and lines[-1] != "":
        lines.append("")
    return lines


def human_title_for_path(path: str) -> str:
    filename = path.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    labels = {
        "campaign_pack": "Base stratégique complète",
        "strategic_diagnosis": "Diagnostic stratégique",
        "audience_intelligence": "Intelligence d'audience",
        "positioning": "Positionnement",
        "influence_architecture": "Architecture d'influence",
        "growth_system": "Système de croissance",
        "facebook_strategy": "Stratégie Facebook",
        "linkedin_strategy": "Stratégie LinkedIn",
        "content_batch": "Batch de contenus",
        "revision": "Révision",
    }
    return labels.get(filename, heading_label(filename))


def human_agent_title(agent_id: str) -> str:
    labels = {
        "strategist": "Stratégie",
        "audience_psychologist": "Psychologie d'audience",
        "positioning_agent": "Positionnement",
        "influence_architect": "Influence",
        "growth_hacker": "Growth",
        "facebook_native_agent": "Facebook",
        "linkedin_native_agent": "LinkedIn",
        "experimentation_agent": "Expérimentation",
        "risk_reviewer": "Risques et garde-fous",
        "anti_banality_agent": "Anti-banalité",
        "copywriter": "Rédaction",
        "hook_master": "Hooks",
        "creative_director": "Direction créative",
    }
    return labels.get(agent_id, heading_label(agent_id))


def heading_label(value: str) -> str:
    labels = {
        "strategic_diagnosis": "Diagnostic stratégique",
        "big_idea_seed": "Idée centrale",
        "hidden_problem": "Problème caché",
        "market_noise": "Bruit du marché",
        "perception_to_change": "Perception à changer",
        "perception_to_shift": "Perception à déplacer",
        "strongest_acceptable_angle": "Angle fort acceptable",
        "strongest_lever": "Levier principal",
        "decision_to_trigger": "Décision à déclencher",
        "do_not_soften": "À ne pas adoucir",
        "audience_intelligence": "Intelligence d'audience",
        "core_identity_desires": "Désirs identitaires",
        "deep_fears": "Peurs profondes",
        "hidden_desires": "Désirs cachés",
        "hidden_pains": "Douleurs cachées",
        "language_triggers": "Langage déclencheur",
        "visible_pains": "Douleurs visibles",
        "message_system": "Système de message",
        "core_promise": "Promesse centrale",
        "brand_voice": "Voix de marque",
        "key_messages": "Messages clés",
        "proof_points": "Preuves",
        "influence_architecture": "Architecture d'influence",
        "growth_system": "Système de croissance",
        "facebook_strategy": "Stratégie Facebook",
        "linkedin_strategy": "Stratégie LinkedIn",
        "annual_editorial_calendar": "Calendrier éditorial annuel",
        "annual_calendar": "Calendrier éditorial annuel",
        "content_pillars": "Piliers de contenu",
        "conversion_path": "Chemin de conversion",
        "tone_of_voice": "Tonalité",
        "risk_review": "Revue des risques",
        "overall_assessment": "Évaluation générale",
    }
    if value in labels:
        return labels[value]
    cleaned = value.replace("_", " ").replace("-", " ").strip()
    return cleaned[:1].upper() + cleaned[1:]


def human_status(status: ArtifactStatus) -> str:
    labels = {
        ArtifactStatus.DRAFT: "brouillon",
        ArtifactStatus.READY_FOR_HUMAN_REVIEW: "prêt à relire",
        ArtifactStatus.NEEDS_REVISION: "à réviser",
        ArtifactStatus.REJECTED: "rejeté",
        ArtifactStatus.APPROVED_BY_HUMAN: "validé",
        ArtifactStatus.ARCHIVED: "archivé",
    }
    return labels.get(status, status.value)


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
