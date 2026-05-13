from __future__ import annotations

from pathlib import Path


def find_repo_root(start: str | Path | None = None) -> Path:
    candidate = Path(start or Path.cwd()).expanduser().resolve()
    if candidate.is_file():
        candidate = candidate.parent

    for path in (candidate, *candidate.parents):
        if is_repo_root(path):
            return path

    raise RuntimeError(f"Could not find Crew_System repo root from {candidate}")


def is_repo_root(path: Path) -> bool:
    return (
        (path / ".git").exists()
        and (path / "docs").is_dir()
        and (path / "registry").is_dir()
    )


def resolve_under_root(root: Path, value: str | Path) -> Path:
    candidate = Path(value).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    return (root / candidate).resolve()
