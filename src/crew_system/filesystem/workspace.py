from __future__ import annotations

import json
import re
import shutil
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from crew_system.core.models import (
    Artifact,
    ModelValidationError,
    ProjectRef,
    ProjectResolutionMode,
    ProjectStatus,
    RuntimeModel,
)
from crew_system.filesystem.safe_writer import FileSystemError, SafeFileWriter, WriteMode

SCHEMA_VERSION = "0.1.0"
WORKSPACE_VERSION = "0.1.0"
PROJECT_VERSION = "0.1.0"

WORKSPACE_DIRECTORIES = [
    "projects",
    "global_registry",
    "templates",
    "exports",
    "archives",
    "tmp",
    "logs",
]

PROJECT_DIRECTORIES = [
    "brief/source_materials",
    "strategy/versions",
    "calendar/campaign_calendars",
    "platforms",
    "creative/asset_briefs",
    "outputs/campaign_packs",
    "outputs/batches",
    "outputs/revisions",
    "outputs/exports",
    "performance/reports",
    "performance/raw",
    "reviews/quality_reviews",
    "memory",
    "logs/jobs",
    "archive/documents",
    "archive/outputs",
    "archive/jobs",
]

PROJECT_LOG_FILES = [
    "logs/jobs.jsonl",
    "logs/agent_runs.jsonl",
    "logs/artifacts.jsonl",
    "logs/errors.jsonl",
]


@dataclass(slots=True)
class WorkspaceManifest(RuntimeModel):
    workspace_id: str
    version: str
    created_at: str
    updated_at: str
    projects_root: str = "projects"
    active_projects: list[str] = field(default_factory=list)
    archived_projects: list[str] = field(default_factory=list)
    global_registry_path: str = "global_registry"
    templates_path: str = "templates"
    archives_path: str = "archives"
    schema_version: str = SCHEMA_VERSION

    def validate(self) -> None:
        _require_text(self.workspace_id, "WorkspaceManifest.workspace_id")
        _require_text(self.version, "WorkspaceManifest.version")
        _require_text(self.created_at, "WorkspaceManifest.created_at")
        _require_text(self.updated_at, "WorkspaceManifest.updated_at")
        _require_text(self.projects_root, "WorkspaceManifest.projects_root")
        _require_text(self.schema_version, "WorkspaceManifest.schema_version")
        _require_string_list(self.active_projects, "WorkspaceManifest.active_projects")
        _require_string_list(self.archived_projects, "WorkspaceManifest.archived_projects")


@dataclass(slots=True)
class ProjectManifest(RuntimeModel):
    project_slug: str
    project_name: str
    status: ProjectStatus
    version: str
    created_at: str
    updated_at: str
    owner: str = ""
    description: str = ""
    active_campaign_pack_id: str = ""
    active_annual_calendar_id: str = ""
    active_platforms: list[str] = field(default_factory=lambda: ["facebook", "linkedin"])
    key_files: dict[str, str] = field(default_factory=dict)
    indexes: dict[str, str] = field(default_factory=dict)
    current_state: dict[str, Any] = field(default_factory=dict)
    schema_version: str = SCHEMA_VERSION

    def validate(self) -> None:
        ProjectRef(
            project_slug=self.project_slug,
            project_name=self.project_name,
            root_path=f"workspace/projects/{self.project_slug}",
            project_manifest_path=f"workspace/projects/{self.project_slug}/manifest.json",
            status=self.status,
        )
        _require_text(self.version, "ProjectManifest.version")
        _require_text(self.created_at, "ProjectManifest.created_at")
        _require_text(self.updated_at, "ProjectManifest.updated_at")
        _require_string_list(self.active_platforms, "ProjectManifest.active_platforms")
        if not isinstance(self.key_files, dict):
            raise ModelValidationError("ProjectManifest.key_files must be an object")
        if not isinstance(self.indexes, dict):
            raise ModelValidationError("ProjectManifest.indexes must be an object")
        if not isinstance(self.current_state, dict):
            raise ModelValidationError("ProjectManifest.current_state must be an object")


@dataclass(slots=True)
class ArchiveRecord(RuntimeModel):
    artifact_id: str
    original_path: str
    archive_path: str
    reason: str
    archived_at: str
    archived_by_job_id: str

    def validate(self) -> None:
        _require_text(self.artifact_id, "ArchiveRecord.artifact_id")
        _require_text(self.original_path, "ArchiveRecord.original_path")
        _require_text(self.archive_path, "ArchiveRecord.archive_path")
        _require_text(self.reason, "ArchiveRecord.reason")
        _require_text(self.archived_at, "ArchiveRecord.archived_at")
        _require_text(self.archived_by_job_id, "ArchiveRecord.archived_by_job_id")


class WorkspaceEngine:
    def __init__(self, workspace_root: str | Path) -> None:
        self.workspace_root = Path(workspace_root).expanduser().resolve()
        self.writer = SafeFileWriter(self.workspace_root, self.workspace_root / "tmp")

    def initialize_workspace(self) -> WorkspaceManifest:
        self.workspace_root.mkdir(parents=True, exist_ok=True)
        for relative_dir in WORKSPACE_DIRECTORIES:
            (self.workspace_root / relative_dir).mkdir(parents=True, exist_ok=True)

        readme_path = self.workspace_root / "README.md"
        if not readme_path.exists():
            self.writer.write_text(
                "README.md",
                "# Crew_System Workspace\n\nRuntime memory for Crew_System projects.\n",
                job_id="workspace_init",
                mode=WriteMode.CREATE,
            )

        manifest_path = self.workspace_root / "workspace_manifest.json"
        if manifest_path.exists():
            return self.load_workspace_manifest()

        now = utc_now()
        manifest = WorkspaceManifest(
            workspace_id=f"workspace_{now_compact()}",
            version=WORKSPACE_VERSION,
            created_at=now,
            updated_at=now,
        )
        self._write_workspace_manifest(manifest, mode=WriteMode.CREATE)
        return manifest

    def load_workspace_manifest(self) -> WorkspaceManifest:
        path = self.workspace_root / "workspace_manifest.json"
        if not path.exists():
            raise FileSystemError(f"Workspace manifest not found: {path}")
        return WorkspaceManifest.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def create_project(
        self,
        project_name: str,
        *,
        project_slug: str | None = None,
        description: str = "",
        owner: str = "",
        active_platforms: list[str] | None = None,
    ) -> ProjectRef:
        self.initialize_workspace()
        slug = project_slug or self.suggest_project_slug(project_name)
        try:
            ProjectRef(
                project_slug=slug,
                project_name=project_name,
                root_path=str(self.project_path(slug)),
                project_manifest_path=str(self.project_path(slug) / "manifest.json"),
            )
        except ModelValidationError as exc:
            raise FileSystemError(str(exc)) from exc

        project_root = self.project_path(slug)
        if project_root.exists():
            raise FileSystemError(f"Project already exists: {slug}")

        project_root.mkdir(parents=True)
        for relative_dir in PROJECT_DIRECTORIES:
            (project_root / relative_dir).mkdir(parents=True, exist_ok=True)

        project_writer = self._project_writer(slug)
        now = utc_now()
        manifest = ProjectManifest(
            project_slug=slug,
            project_name=project_name,
            status=ProjectStatus.ACTIVE,
            version=PROJECT_VERSION,
            created_at=now,
            updated_at=now,
            owner=owner,
            description=description,
            active_platforms=active_platforms or ["facebook", "linkedin"],
            key_files=default_key_files(),
            indexes=default_indexes(),
            current_state=default_current_state(),
        )
        project_writer.write_text(
            "README.md",
            project_readme(project_name, description),
            job_id="project_init",
            mode=WriteMode.CREATE,
        )
        project_writer.write_text(
            "logs/decisions.md",
            f"# Decisions - {project_name}\n\n",
            job_id="project_init",
            mode=WriteMode.CREATE,
        )
        for log_file in PROJECT_LOG_FILES:
            project_writer.write_text(
                log_file,
                "",
                job_id="project_init",
                mode=WriteMode.CREATE,
            )

        self.save_project_manifest(slug, manifest, mode=WriteMode.CREATE)
        self._activate_project(slug)

        return ProjectRef(
            project_slug=slug,
            project_name=project_name,
            root_path=str(project_root),
            project_manifest_path=str(project_root / "manifest.json"),
            status=ProjectStatus.ACTIVE,
            resolution_mode=ProjectResolutionMode.NEW_PROJECT,
            active_outputs_path=str(project_root / "outputs"),
        )

    def suggest_project_slug(self, project_name: str) -> str:
        base = slugify_project_name(project_name)
        if base in {"new_project", "test", "project", "projet"}:
            raise FileSystemError(f"Project name is too vague for a stable slug: {project_name}")

        candidate = base
        index = 2
        while self.project_path(candidate).exists():
            candidate = f"{base}_{index}"
            index += 1
        return candidate

    def project_path(self, project_slug: str) -> Path:
        return self.workspace_root / "projects" / project_slug

    def load_project_manifest(self, project_slug: str) -> ProjectManifest:
        path = self.project_path(project_slug) / "manifest.json"
        if not path.exists():
            raise FileSystemError(f"Project manifest not found: {path}")
        return ProjectManifest.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def save_project_manifest(
        self,
        project_slug: str,
        manifest: ProjectManifest,
        *,
        mode: WriteMode = WriteMode.OVERWRITE_WITH_VERSION,
    ) -> None:
        if manifest.project_slug != project_slug:
            raise FileSystemError("Project manifest slug does not match target project")
        self._project_writer(project_slug).write_json(
            "manifest.json",
            manifest.to_dict(),
            job_id="project_manifest",
            mode=mode,
        )

    def create_job_folder(self, project_slug: str, job_id: str) -> Path:
        project_root = self.project_path(project_slug)
        _ensure_project_exists(project_root)
        job_folder = project_root / "logs" / "jobs" / job_id
        job_folder.mkdir(parents=True, exist_ok=True)
        return job_folder

    def append_job_log(self, project_slug: str, entry: dict[str, Any]) -> None:
        self._append_log(project_slug, "logs/jobs.jsonl", entry, "job_log")
        self._set_last_job_id(project_slug, str(entry.get("job_id", "")))

    def append_agent_run_log(self, project_slug: str, entry: dict[str, Any]) -> None:
        self._append_log(project_slug, "logs/agent_runs.jsonl", entry, "agent_run_log")

    def append_error_log(self, project_slug: str, entry: dict[str, Any]) -> None:
        self._append_log(project_slug, "logs/errors.jsonl", entry, "error_log")

    def register_artifact(
        self,
        artifact: Artifact,
        *,
        content_hash: str = "",
        version: str = "v001",
    ) -> None:
        entry = artifact.to_dict()
        entry["format"] = artifact.artifact_type.value
        entry["version"] = version
        entry["hash"] = content_hash
        self._append_log(
            artifact.project_slug,
            "logs/artifacts.jsonl",
            entry,
            "artifact_log",
        )

    def write_decision(
        self,
        project_slug: str,
        *,
        job_id: str,
        decision: str,
        reason: str,
        impact: str,
        files: list[str] | None = None,
    ) -> None:
        files_text = ", ".join(files or [])
        block = (
            f"## {utc_now()}\n\n"
            f"- job: {job_id}\n"
            f"- decision: {decision}\n"
            f"- reason: {reason}\n"
            f"- impact: {impact}\n"
            f"- files: {files_text}\n\n"
        )
        self._project_writer(project_slug).write_text(
            "logs/decisions.md",
            block,
            job_id=job_id,
            mode=WriteMode.APPEND,
        )

    def archive_artifact(
        self,
        project_slug: str,
        *,
        artifact_id: str,
        original_relative_path: str,
        reason: str,
        archived_by_job_id: str,
    ) -> ArchiveRecord:
        project_root = self.project_path(project_slug)
        _ensure_project_exists(project_root)
        original_path = self._project_writer(project_slug).resolve(original_relative_path)
        if not original_path.exists():
            raise FileSystemError(f"Cannot archive missing artifact: {original_relative_path}")

        archive_relative_path = archive_path_for(artifact_id, original_path)
        archive_path = self._project_writer(project_slug).resolve(archive_relative_path)
        archive_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(original_path), str(archive_path))

        record = ArchiveRecord(
            artifact_id=artifact_id,
            original_path=original_relative_path,
            archive_path=archive_relative_path,
            reason=reason,
            archived_at=utc_now(),
            archived_by_job_id=archived_by_job_id,
        )
        self._append_log(
            project_slug,
            "logs/artifacts.jsonl",
            {"archive_record": record.to_dict()},
            archived_by_job_id,
        )
        self.write_decision(
            project_slug,
            job_id=archived_by_job_id,
            decision="archive_artifact",
            reason=reason,
            impact="artifact removed from active project path",
            files=[original_relative_path, archive_relative_path],
        )
        return record

    def _activate_project(self, project_slug: str) -> None:
        manifest = self.load_workspace_manifest()
        if project_slug not in manifest.active_projects:
            manifest.active_projects.append(project_slug)
        if project_slug in manifest.archived_projects:
            manifest.archived_projects.remove(project_slug)
        manifest.updated_at = utc_now()
        self._write_workspace_manifest(manifest, mode=WriteMode.OVERWRITE_WITH_VERSION)

    def _set_last_job_id(self, project_slug: str, job_id: str) -> None:
        if not job_id:
            return
        manifest = self.load_project_manifest(project_slug)
        manifest.current_state["last_job_id"] = job_id
        manifest.updated_at = utc_now()
        self.save_project_manifest(project_slug, manifest)

    def _append_log(
        self,
        project_slug: str,
        relative_path: str,
        entry: dict[str, Any],
        job_id: str,
    ) -> None:
        _ensure_project_exists(self.project_path(project_slug))
        self._project_writer(project_slug).append_jsonl(
            relative_path,
            entry,
            job_id=job_id,
        )

    def _write_workspace_manifest(
        self,
        manifest: WorkspaceManifest,
        *,
        mode: WriteMode,
    ) -> None:
        self.writer.write_json(
            "workspace_manifest.json",
            manifest.to_dict(),
            job_id="workspace_manifest",
            mode=mode,
        )

    def _project_writer(self, project_slug: str) -> SafeFileWriter:
        return SafeFileWriter(self.project_path(project_slug), self.workspace_root / "tmp")


def slugify_project_name(project_name: str) -> str:
    if not isinstance(project_name, str) or not project_name.strip():
        raise FileSystemError("project_name must be a non-empty string")
    normalized = unicodedata.normalize("NFKD", project_name)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")
    slug = re.sub(r"_+", "_", slug)
    if not slug:
        raise FileSystemError("Project name cannot produce a valid slug")
    if not re.match(r"^[a-z]", slug):
        slug = f"project_{slug}"
    return slug


def default_key_files() -> dict[str, str]:
    return {
        "readme": "README.md",
        "normalized_brief": "brief/normalized_brief.json",
        "positioning": "strategy/positioning.md",
        "annual_calendar": "calendar/annual_editorial_calendar.md",
        "facebook_strategy": "platforms/facebook_strategy.md",
        "linkedin_strategy": "platforms/linkedin_strategy.md",
    }


def default_indexes() -> dict[str, str]:
    return {
        "artifacts": "logs/artifacts.jsonl",
        "jobs": "logs/jobs.jsonl",
        "agent_runs": "logs/agent_runs.jsonl",
    }


def default_current_state() -> dict[str, Any]:
    return {
        "strategy_ready": False,
        "calendar_ready": False,
        "content_batches_available": 0,
        "last_job_id": "",
    }


def project_readme(project_name: str, description: str) -> str:
    description_block = description or "Projet cree par Crew_System."
    return (
        f"# {project_name}\n\n"
        f"{description_block}\n\n"
        "## Statut\n\n"
        "- status: active\n"
        "- strategy_ready: false\n"
        "- calendar_ready: false\n"
    )


def archive_path_for(artifact_id: str, original_path: Path) -> str:
    safe_artifact_id = re.sub(r"[^A-Za-z0-9_:-]+", "_", artifact_id)
    filename = f"{original_path.stem}_{safe_artifact_id}{original_path.suffix}"
    return f"archive/documents/{filename}"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def now_compact() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def _ensure_project_exists(project_root: Path) -> None:
    if not project_root.exists():
        raise FileSystemError(f"Project does not exist: {project_root}")


def _require_text(value: str, field_name: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ModelValidationError(f"{field_name} must be a non-empty string")


def _require_string_list(values: list[str], field_name: str) -> None:
    if not isinstance(values, list):
        raise ModelValidationError(f"{field_name} must be a list")
    for value in values:
        _require_text(value, field_name)
