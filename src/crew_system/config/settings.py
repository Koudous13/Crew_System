from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from crew_system.core.paths import find_repo_root, resolve_under_root

ENV_REPO_ROOT = "CREW_SYSTEM_REPO_ROOT"
ENV_WORKSPACE_ROOT = "CREW_SYSTEM_WORKSPACE"
DEFAULT_WORKSPACE_DIRNAME = "workspace"


@dataclass(frozen=True)
class CrewSystemSettings:
    repo_root: Path
    workspace_root: Path
    docs_root: Path
    registry_root: Path

    @classmethod
    def discover(
        cls,
        start: str | Path | None = None,
        env: Mapping[str, str] | None = None,
    ) -> "CrewSystemSettings":
        env_map = os.environ if env is None else env
        explicit_repo_root = env_map.get(ENV_REPO_ROOT)
        repo_root = find_repo_root(explicit_repo_root or start)

        workspace_value = env_map.get(ENV_WORKSPACE_ROOT, DEFAULT_WORKSPACE_DIRNAME)
        workspace_root = resolve_under_root(repo_root, workspace_value)

        return cls(
            repo_root=repo_root,
            workspace_root=workspace_root,
            docs_root=repo_root / "docs",
            registry_root=repo_root / "registry",
        )

    def as_dict(self) -> dict[str, str]:
        return {
            "repo_root": str(self.repo_root),
            "workspace_root": str(self.workspace_root),
            "docs_root": str(self.docs_root),
            "registry_root": str(self.registry_root),
        }

    def required_foundation_paths(self) -> dict[str, Path]:
        return {
            "docs_root": self.docs_root,
            "registry_root": self.registry_root,
            "registry_manifest": self.registry_root / "manifest.yaml",
            "implementation_plan": self.docs_root / "SYSTEM_IMPLEMENTATION_PLAN.md",
            "agent_machine_registry": self.docs_root / "AGENT_MACHINE_REGISTRY.md",
        }
