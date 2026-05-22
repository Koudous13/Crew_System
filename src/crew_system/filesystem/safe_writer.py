from __future__ import annotations

import hashlib
import os
import shutil
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import uuid4

from crew_system.core.models import ModelValidationError, RuntimeModel


class FileSystemError(RuntimeError):
    """Raised when a workspace file operation is unsafe or invalid."""


class WriteMode(str, Enum):
    CREATE = "create"
    APPEND = "append"
    OVERWRITE_WITH_VERSION = "overwrite_with_version"
    SKIP_IF_EXISTS = "skip_if_exists"


@dataclass(slots=True)
class SafeWriteResult(RuntimeModel):
    relative_path: str
    absolute_path: str
    mode: WriteMode
    written: bool
    skipped: bool
    content_hash: str = ""
    bytes_written: int = 0
    version_relative_path: str = ""

    def validate(self) -> None:
        if not self.relative_path:
            raise ModelValidationError("SafeWriteResult.relative_path is required")
        if not self.absolute_path:
            raise ModelValidationError("SafeWriteResult.absolute_path is required")
        if not isinstance(self.mode, WriteMode):
            raise ModelValidationError("SafeWriteResult.mode is invalid")
        if type(self.written) is not bool:
            raise ModelValidationError("SafeWriteResult.written must be a boolean")
        if type(self.skipped) is not bool:
            raise ModelValidationError("SafeWriteResult.skipped must be a boolean")


class SafeFileWriter:
    def __init__(self, root: str | Path, tmp_root: str | Path | None = None) -> None:
        self.root = Path(root).expanduser().resolve()
        self.tmp_root = Path(tmp_root).expanduser().resolve() if tmp_root else self.root / "tmp"

    def resolve(self, relative_path: str | Path) -> Path:
        relative = _clean_relative_path(relative_path)
        target = (self.root / relative).resolve()
        _ensure_inside(self.root, target)
        return target

    def write_text(
        self,
        relative_path: str | Path,
        content: str,
        *,
        job_id: str,
        mode: WriteMode = WriteMode.CREATE,
        encoding: str = "utf-8",
    ) -> SafeWriteResult:
        if not isinstance(content, str):
            raise FileSystemError("content must be text")

        target = self.resolve(relative_path)
        relative = _clean_relative_path(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)

        if mode is WriteMode.SKIP_IF_EXISTS and target.exists():
            return SafeWriteResult(
                relative_path=str(relative).replace("\\", "/"),
                absolute_path=str(target),
                mode=mode,
                written=False,
                skipped=True,
            )

        if mode is WriteMode.CREATE and target.exists():
            raise FileSystemError(f"Refusing to overwrite existing file: {target}")

        if mode is WriteMode.APPEND:
            payload = content.encode(encoding)
            existing_payload = target.read_bytes() if target.exists() else b""
            combined_payload = existing_payload + payload
            tmp_path = self._tmp_path(job_id, target.name)
            tmp_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path.write_bytes(combined_payload)
            os.replace(tmp_path, target)
            read_back = target.read_bytes()
            if read_back != combined_payload:
                raise FileSystemError(f"Atomic append verification failed for {target}")
            return SafeWriteResult(
                relative_path=str(relative).replace("\\", "/"),
                absolute_path=str(target),
                mode=mode,
                written=True,
                skipped=False,
                content_hash=hashlib.sha256(combined_payload).hexdigest(),
                bytes_written=len(payload),
            )

        version_relative_path = ""
        if mode is WriteMode.OVERWRITE_WITH_VERSION and target.exists():
            version_path = self._copy_existing_to_version(target)
            version_relative_path = _relative_to(self.root, version_path)

        payload = content.encode(encoding)
        tmp_path = self._tmp_path(job_id, target.name)
        tmp_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path.write_bytes(payload)

        os.replace(tmp_path, target)
        read_back = target.read_bytes()
        if read_back != payload:
            raise FileSystemError(f"Atomic write verification failed for {target}")

        return SafeWriteResult(
            relative_path=str(relative).replace("\\", "/"),
            absolute_path=str(target),
            mode=mode,
            written=True,
            skipped=False,
            content_hash=hashlib.sha256(payload).hexdigest(),
            bytes_written=len(payload),
            version_relative_path=version_relative_path,
        )

    def write_json(
        self,
        relative_path: str | Path,
        data: dict[str, Any],
        *,
        job_id: str,
        mode: WriteMode = WriteMode.CREATE,
    ) -> SafeWriteResult:
        import json

        content = json.dumps(data, indent=2, sort_keys=True) + "\n"
        return self.write_text(relative_path, content, job_id=job_id, mode=mode)

    def append_jsonl(
        self,
        relative_path: str | Path,
        data: dict[str, Any],
        *,
        job_id: str,
    ) -> SafeWriteResult:
        import json

        content = json.dumps(data, sort_keys=True) + "\n"
        return self.write_text(
            relative_path,
            content,
            job_id=job_id,
            mode=WriteMode.APPEND,
        )

    def _tmp_path(self, job_id: str, filename: str) -> Path:
        safe_job_id = "".join(char if char.isalnum() or char in "_-" else "_" for char in job_id)
        safe_filename = "".join(
            char if char.isalnum() or char in "._-" else "_" for char in filename
        )
        return self.tmp_root / safe_job_id / f"{uuid4().hex}_{safe_filename}.tmp"

    def _copy_existing_to_version(self, target: Path) -> Path:
        versions_dir = target.parent / "versions"
        versions_dir.mkdir(parents=True, exist_ok=True)
        index = 1
        while True:
            version_name = f"{target.stem}_v{index:03d}{target.suffix}"
            version_path = versions_dir / version_name
            if not version_path.exists():
                shutil.copy2(target, version_path)
                return version_path
            index += 1


def _clean_relative_path(relative_path: str | Path) -> Path:
    candidate = Path(relative_path)
    if candidate.is_absolute():
        raise FileSystemError(f"Absolute paths are not allowed: {candidate}")

    parts = candidate.parts
    if not parts:
        raise FileSystemError("Empty relative path is not allowed")

    forbidden = {"", ".", ".."}
    if any(part in forbidden for part in parts):
        raise FileSystemError(f"Unsafe relative path: {candidate}")

    return candidate


def _ensure_inside(root: Path, target: Path) -> None:
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise FileSystemError(f"Path escapes root: {target}") from exc


def _relative_to(root: Path, target: Path) -> str:
    return str(target.relative_to(root)).replace("\\", "/")
