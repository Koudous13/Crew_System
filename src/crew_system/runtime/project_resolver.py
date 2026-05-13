from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from crew_system.core.models import (
    ChatRequest,
    Intent,
    IntentType,
    ModelValidationError,
    ProjectRef,
    ProjectResolutionMode,
    ProjectStatus,
    RuntimeModel,
    require_enum,
    require_model,
    validate_string_list,
)
from crew_system.filesystem.workspace import (
    FileSystemError,
    ProjectManifest,
    WorkspaceEngine,
    slugify_project_name,
)
from crew_system.runtime.intent import fold_text, normalize_user_message


class ProjectResolutionError(RuntimeError):
    """Raised when the runtime cannot resolve a project safely."""


@dataclass(slots=True)
class ProjectResolution(RuntimeModel):
    mode: ProjectResolutionMode
    project_ref: ProjectRef | None = None
    candidates: list[str] = field(default_factory=list)
    missing_information: list[str] = field(default_factory=list)
    ambiguity_flags: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)

    def validate(self) -> None:
        require_enum(self.mode, ProjectResolutionMode, "ProjectResolution.mode")
        if self.project_ref is not None:
            require_model(self.project_ref, ProjectRef, "ProjectResolution.project_ref")
        validate_string_list(self.candidates, "ProjectResolution.candidates")
        validate_string_list(self.missing_information, "ProjectResolution.missing_information")
        validate_string_list(self.ambiguity_flags, "ProjectResolution.ambiguity_flags")
        validate_string_list(self.assumptions, "ProjectResolution.assumptions")
        if self.mode in {ProjectResolutionMode.EXPLICIT, ProjectResolutionMode.ACTIVE_CONTEXT, ProjectResolutionMode.INFERRED, ProjectResolutionMode.NEW_PROJECT}:
            if self.project_ref is None:
                raise ModelValidationError("ProjectResolution.project_ref is required for resolved modes")


class ProjectResolver:
    def __init__(self, workspace: WorkspaceEngine) -> None:
        self.workspace = workspace

    def resolve(self, chat_request: ChatRequest, intent: Intent) -> ProjectResolution:
        if intent.intent_type is IntentType.CREATE_PROJECT_FROM_IDEA:
            return self._resolve_new_project(chat_request)

        if not intent.project_required:
            return ProjectResolution(
                mode=ProjectResolutionMode.MISSING,
                assumptions=["no_project_required_for_intent"],
            )

        active_projects = self._active_project_slugs()
        if not active_projects:
            return ProjectResolution(
                mode=ProjectResolutionMode.MISSING,
                missing_information=["project"],
                ambiguity_flags=["no_workspace_project_available"],
            )

        active_hint = chat_request.active_project_hint.strip()
        if active_hint:
            candidates = self._match_project(active_hint, active_projects)
            if len(candidates) == 1:
                return self._resolved(candidates[0], ProjectResolutionMode.ACTIVE_CONTEXT)
            if len(candidates) > 1:
                return ProjectResolution(
                    mode=ProjectResolutionMode.AMBIGUOUS,
                    candidates=candidates,
                    missing_information=["project"],
                    ambiguity_flags=["active_project_hint_matches_multiple_projects"],
                )

        if intent.project_hint:
            candidates = self._match_project(intent.project_hint, active_projects)
            if len(candidates) == 1:
                return self._resolved(candidates[0], ProjectResolutionMode.EXPLICIT)
            if len(candidates) > 1:
                return ProjectResolution(
                    mode=ProjectResolutionMode.AMBIGUOUS,
                    candidates=candidates,
                    missing_information=["project"],
                    ambiguity_flags=["project_hint_matches_multiple_projects"],
                )
            return ProjectResolution(
                mode=ProjectResolutionMode.MISSING,
                missing_information=["project"],
                ambiguity_flags=["project_hint_not_found"],
                assumptions=[f"requested_project_hint={intent.project_hint}"],
            )

        if len(active_projects) == 1:
            return self._resolved(
                active_projects[0],
                ProjectResolutionMode.INFERRED,
                assumptions=["single_active_project_in_workspace"],
            )

        return ProjectResolution(
            mode=ProjectResolutionMode.AMBIGUOUS,
            candidates=active_projects,
            missing_information=["project"],
            ambiguity_flags=["multiple_active_projects_without_project_hint"],
        )

    def _resolve_new_project(self, chat_request: ChatRequest) -> ProjectResolution:
        self.workspace.initialize_workspace()
        project_name = infer_new_project_name(chat_request.user_message)
        if not project_name:
            return ProjectResolution(
                mode=ProjectResolutionMode.MISSING,
                missing_information=["project_name"],
                ambiguity_flags=["new_project_name_missing"],
            )

        try:
            project_slug = self.workspace.suggest_project_slug(project_name)
        except FileSystemError as exc:
            return ProjectResolution(
                mode=ProjectResolutionMode.MISSING,
                missing_information=["project_name"],
                ambiguity_flags=["new_project_name_unstable"],
                assumptions=[str(exc)],
            )

        root_path = self.workspace.project_path(project_slug)
        return ProjectResolution(
            mode=ProjectResolutionMode.NEW_PROJECT,
            project_ref=ProjectRef(
                project_slug=project_slug,
                project_name=project_name,
                root_path=str(root_path),
                project_manifest_path=str(root_path / "manifest.json"),
                status=ProjectStatus.DRAFT,
                resolution_mode=ProjectResolutionMode.NEW_PROJECT,
                active_outputs_path=str(root_path / "outputs"),
            ),
        )

    def _active_project_slugs(self) -> list[str]:
        try:
            manifest = self.workspace.load_workspace_manifest()
        except FileSystemError:
            return []
        return list(manifest.active_projects)

    def _match_project(self, hint: str, active_projects: list[str]) -> list[str]:
        folded_hint = fold_text(hint)
        normalized_slug = normalize_project_hint_to_slug(hint)
        matches: list[str] = []
        for slug in active_projects:
            manifest = self._load_project_manifest_or_none(slug)
            folded_name = fold_text(manifest.project_name) if manifest else ""
            if slug == normalized_slug or slug == folded_hint:
                append_unique(matches, slug)
            elif manifest and slugify_project_name(manifest.project_name) == normalized_slug:
                append_unique(matches, slug)
            elif normalized_slug and normalized_slug in slug:
                append_unique(matches, slug)
            elif folded_hint and folded_hint in folded_name:
                append_unique(matches, slug)
        return matches

    def _resolved(
        self,
        project_slug: str,
        mode: ProjectResolutionMode,
        *,
        assumptions: list[str] | None = None,
    ) -> ProjectResolution:
        manifest = self.workspace.load_project_manifest(project_slug)
        return ProjectResolution(
            mode=mode,
            project_ref=project_ref_from_manifest(
                self.workspace.workspace_root,
                manifest,
                mode,
            ),
            assumptions=assumptions or [],
        )

    def _load_project_manifest_or_none(self, project_slug: str) -> ProjectManifest | None:
        try:
            return self.workspace.load_project_manifest(project_slug)
        except FileSystemError:
            return None


def infer_new_project_name(message: str) -> str:
    normalized = normalize_user_message(message)
    patterns = [
        r"\b(?:idee|idée|saas|offre|projet|business)\s+(?:de|pour|sur)?\s*(?P<name>[A-Za-z0-9 _-]{3,80})",
        r"\b(?:creer|créer|lancer)\s+(?:un|une)?\s*(?P<name>[A-Za-z0-9 _-]{3,80})",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if match:
            candidate = clean_inferred_project_name(match.group("name"))
            if candidate:
                return candidate
    return ""


def clean_inferred_project_name(value: str) -> str:
    cleaned = re.split(
        r"\b(avec|pour|qui|et ensuite|ensuite|sur facebook|sur linkedin)\b",
        value,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]
    cleaned = cleaned.strip(" .,:;!?\"'")
    cleaned = re.sub(
        r"^(?:un|une|nouveau|nouvelle|projet|saas|offre|business)\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip(" .,:;!?\"'")
    if fold_text(cleaned) in {"projet", "un projet", "nouveau projet", "saas"}:
        return ""
    return cleaned


def normalize_project_hint_to_slug(hint: str) -> str:
    try:
        return slugify_project_name(hint)
    except FileSystemError:
        return fold_text(hint).strip().replace(" ", "_")


def project_ref_from_manifest(
    workspace_root: str | Path,
    manifest: ProjectManifest,
    mode: ProjectResolutionMode,
) -> ProjectRef:
    project_root = Path(workspace_root) / "projects" / manifest.project_slug
    return ProjectRef(
        project_slug=manifest.project_slug,
        project_name=manifest.project_name,
        root_path=str(project_root),
        project_manifest_path=str(project_root / "manifest.json"),
        status=manifest.status,
        resolution_mode=mode,
        source_brief_path=manifest.key_files.get("normalized_brief", ""),
        campaign_pack_path=manifest.active_campaign_pack_id,
        annual_calendar_path=manifest.key_files.get("annual_calendar", ""),
        active_outputs_path=str(project_root / "outputs"),
    )


def append_unique(items: list[str], item: str) -> None:
    if item not in items:
        items.append(item)
