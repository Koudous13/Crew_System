from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from crew_system.core.models import (
    ContextFile,
    ContextSnapshot,
    IntentType,
    NormalizedRequest,
    Platform,
)
from crew_system.filesystem.workspace import FileSystemError, ProjectManifest, WorkspaceEngine, utc_now


class ContextLoaderError(RuntimeError):
    """Raised when context cannot be loaded safely."""


@dataclass(frozen=True, slots=True)
class ContextSpec:
    path: str
    required: bool
    role: str


class ContextLoader:
    def __init__(self, workspace: WorkspaceEngine) -> None:
        self.workspace = workspace

    def load(self, job_id: str, request: NormalizedRequest) -> ContextSnapshot:
        project_ref = request.project_ref
        if project_ref is None:
            raise ContextLoaderError("Context loading requires a resolved project")

        project_root = Path(project_ref.root_path).expanduser().resolve()
        manifest = self._load_manifest_or_none(project_ref.project_slug)
        if not project_root.exists() and request.intent.intent_type is not IntentType.CREATE_PROJECT_FROM_IDEA:
            raise ContextLoaderError(f"Project folder does not exist: {project_ref.project_slug}")

        specs = context_policy_for(request.intent.intent_type, request.intent.platforms, manifest)
        files: list[ContextFile] = []
        missing_files: list[str] = []
        useful_points: list[str] = []
        assumptions: list[str] = list(request.assumptions)

        for spec in specs:
            target = resolve_project_file(project_root, spec.path)
            if not target.exists():
                files.append(ContextFile(path=spec.path, required=spec.required, missing=True))
                if spec.required:
                    missing_files.append(spec.path)
                    assumptions.append(f"missing_required_context:{spec.path}")
                else:
                    assumptions.append(f"missing_optional_context:{spec.path}")
                continue

            summary = summarize_file(target)
            files.append(
                ContextFile(
                    path=spec.path,
                    required=spec.required,
                    missing=False,
                    summary=summary,
                )
            )
            if summary:
                useful_points.append(f"{spec.path}: {summary}")

        return ContextSnapshot(
            job_id=job_id,
            project_slug=project_ref.project_slug,
            created_at=utc_now(),
            files_loaded=files,
            missing_files=missing_files,
            useful_points=useful_points,
            assumptions=dedupe(assumptions),
        )

    def _load_manifest_or_none(self, project_slug: str) -> ProjectManifest | None:
        try:
            return self.workspace.load_project_manifest(project_slug)
        except FileSystemError:
            return None


def context_policy_for(
    intent_type: IntentType,
    platforms: list[Platform],
    manifest: ProjectManifest | None,
) -> list[ContextSpec]:
    key_files = manifest.key_files if manifest else {}

    def path_for(key: str, fallback: str) -> str:
        return key_files.get(key, fallback)

    foundation = [
        ContextSpec("manifest.json", required=True, role="project_manifest"),
        ContextSpec("README.md", required=True, role="project_summary"),
    ]
    brief = [
        ContextSpec(
            path_for("normalized_brief", "brief/normalized_brief.json"),
            required=True,
            role="normalized_brief",
        )
    ]
    strategy_pack = [
        ContextSpec("strategy/strategic_diagnosis.md", required=True, role="strategic_diagnosis"),
        ContextSpec("strategy/audience_intelligence.md", required=True, role="audience_intelligence"),
        ContextSpec(path_for("positioning", "strategy/positioning.md"), required=True, role="positioning"),
        ContextSpec("strategy/influence_architecture.md", required=True, role="influence_architecture"),
        ContextSpec("strategy/growth_system.md", required=True, role="growth_system"),
    ]
    annual_calendar = [
        ContextSpec(
            path_for("annual_calendar", "calendar/annual_editorial_calendar.md"),
            required=True,
            role="annual_calendar",
        )
    ]
    artifact_memory = [
        ContextSpec("logs/artifacts.jsonl", required=False, role="artifact_index"),
        ContextSpec("logs/agent_runs.jsonl", required=False, role="agent_memory"),
    ]

    if intent_type is IntentType.CREATE_PROJECT_FROM_IDEA:
        return []

    if intent_type is IntentType.CREATE_CAMPAIGN_PACK:
        return foundation + brief + platform_context(platforms, key_files, required=False)

    if intent_type is IntentType.GENERATE_ANNUAL_CALENDAR:
        return foundation + brief + strategy_pack + platform_context(platforms, key_files, required=False)

    if intent_type in {IntentType.GENERATE_CONTENT_BATCH, IntentType.GENERATE_VIDEO_BATCH, IntentType.GENERATE_VISUAL_BATCH}:
        return (
            foundation
            + brief
            + strategy_pack
            + annual_calendar
            + platform_context(platforms, key_files, required=True)
            + artifact_memory
        )

    if intent_type is IntentType.REVISE_CONTENT_BATCH:
        return (
            foundation
            + brief
            + strategy_pack
            + annual_calendar
            + platform_context(platforms, key_files, required=True)
            + artifact_memory
            + [ContextSpec("outputs/batches", required=True, role="batch_source")]
        )

    if intent_type is IntentType.ANALYZE_PERFORMANCE:
        return (
            foundation
            + brief
            + strategy_pack
            + platform_context(platforms, key_files, required=False)
            + [
                ContextSpec("performance/reports", required=True, role="performance_reports"),
                ContextSpec("performance/raw", required=False, role="raw_performance_data"),
            ]
        )

    return foundation + brief


def platform_context(
    platforms: list[Platform],
    key_files: dict[str, str],
    *,
    required: bool,
) -> list[ContextSpec]:
    specs: list[ContextSpec] = []
    if not platforms:
        return specs
    mapping = {
        Platform.FACEBOOK: ("facebook_strategy", "platforms/facebook_strategy.md", "facebook_strategy"),
        Platform.LINKEDIN: ("linkedin_strategy", "platforms/linkedin_strategy.md", "linkedin_strategy"),
    }
    for platform in platforms:
        key, fallback, role = mapping[platform]
        specs.append(ContextSpec(key_files.get(key, fallback), required=required, role=role))
    return specs


def resolve_project_file(project_root: Path, relative_path: str) -> Path:
    candidate = Path(relative_path)
    if candidate.is_absolute():
        raise ContextLoaderError(f"Context path must be relative: {relative_path}")
    resolved = (project_root / candidate).resolve()
    try:
        resolved.relative_to(project_root)
    except ValueError as exc:
        raise ContextLoaderError(f"Context path escapes project root: {relative_path}") from exc
    return resolved


def summarize_file(path: Path) -> str:
    if path.is_dir():
        entries = sorted(item.name for item in path.iterdir())[:8]
        if not entries:
            return "empty directory"
        return "directory entries: " + ", ".join(entries)

    text = path.read_text(encoding="utf-8", errors="replace")
    if path.suffix.lower() == ".json":
        return summarize_json(text)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return "empty file"
    return trim_summary(" | ".join(lines[:3]))


def summarize_json(text: str) -> str:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return trim_summary(text.replace("\n", " "))
    if isinstance(payload, dict):
        keys = list(payload.keys())[:8]
        return "json keys: " + ", ".join(str(key) for key in keys)
    if isinstance(payload, list):
        return f"json list items: {len(payload)}"
    return "json scalar"


def trim_summary(value: str, limit: int = 260) -> str:
    value = " ".join(value.split())
    if len(value) <= limit:
        return value
    return value[: limit - 3].rstrip() + "..."


def dedupe(items: list[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        if item not in result:
            result.append(item)
    return result
