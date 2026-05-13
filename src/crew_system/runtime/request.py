from __future__ import annotations

from dataclasses import dataclass

from crew_system.core.models import ChatRequest, Intent, ModelValidationError, NormalizedRequest
from crew_system.runtime.intent import normalize_user_message
from crew_system.runtime.project_resolver import ProjectResolution


class RequestNormalizationError(RuntimeError):
    """Raised when a request cannot become executable yet."""


@dataclass(slots=True)
class RequestNormalizer:
    def normalize(
        self,
        chat_request: ChatRequest,
        intent: Intent,
        project_resolution: ProjectResolution,
    ) -> NormalizedRequest:
        missing_information = merge_unique(
            intent.missing_information,
            project_resolution.missing_information,
        )
        assumptions = list(project_resolution.assumptions)

        if intent.project_required and project_resolution.project_ref is None:
            raise RequestNormalizationError(
                "Project is required before building a normalized executable request"
            )

        try:
            return NormalizedRequest(
                request_id=chat_request.request_id,
                normalized_message=normalize_user_message(chat_request.user_message),
                intent=intent,
                project_ref=project_resolution.project_ref,
                missing_information=missing_information,
                assumptions=assumptions,
            )
        except ModelValidationError as exc:
            raise RequestNormalizationError(str(exc)) from exc


def merge_unique(*groups: list[str]) -> list[str]:
    merged: list[str] = []
    for group in groups:
        for item in group:
            if item not in merged:
                merged.append(item)
    return merged
