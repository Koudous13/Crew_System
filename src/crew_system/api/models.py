from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from crew_system.filesystem.workspace import utc_now


@dataclass(slots=True)
class ApiConversation:
    conversation_id: str
    created_at: str
    updated_at: str
    project_slug: str = ""
    title: str = ""
    status: str = "active"

    def to_dict(self) -> dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "project_slug": self.project_slug,
            "title": self.title,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ApiConversation":
        return cls(
            conversation_id=str(data["conversation_id"]),
            created_at=str(data["created_at"]),
            updated_at=str(data["updated_at"]),
            project_slug=str(data.get("project_slug", "")),
            title=str(data.get("title", "")),
            status=str(data.get("status", "active")),
        )


@dataclass(slots=True)
class ApiMessage:
    message_id: str
    conversation_id: str
    role: str
    content: str
    created_at: str
    job_id: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "message_id": self.message_id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at,
            "job_id": self.job_id,
            "metadata": self.metadata,
        }

    @classmethod
    def build(
        cls,
        *,
        message_id: str,
        conversation_id: str,
        role: str,
        content: str,
        job_id: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> "ApiMessage":
        return cls(
            message_id=message_id,
            conversation_id=conversation_id,
            role=role,
            content=content,
            created_at=utc_now(),
            job_id=job_id,
            metadata=metadata or {},
        )
