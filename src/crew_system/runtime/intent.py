from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from crew_system.core.models import (
    ChatRequest,
    Intent,
    IntentType,
    OutputExpectation,
    PeriodHint,
    PeriodType,
    Platform,
    RequestedAssets,
    RequestedVolume,
)


CONTENT_WORDS = {
    "post",
    "posts",
    "publication",
    "publications",
    "contenu",
    "contenus",
    "copy",
    "copies",
    "batch",
}

PROJECT_WORDS = {
    "idee",
    "saas",
    "offre",
    "business",
    "projet",
    "startup",
    "produit",
}

STRATEGY_WORDS = {
    "strategie",
    "strategique",
    "campaign pack",
    "base strategique",
    "positionnement",
    "diagnostic",
}


@dataclass(slots=True)
class RuleBasedIntentParser:
    """Deterministic first-pass parser for stable runtime tests."""

    def parse(self, chat_request: ChatRequest) -> Intent:
        normalized = normalize_user_message(chat_request.user_message)
        folded = fold_text(normalized)

        platforms = detect_platforms(folded)
        assets = detect_assets(folded)
        volume = detect_requested_volume(folded, platforms)
        period = detect_period(folded)
        project_hint = detect_project_hint(normalized, chat_request.active_project_hint)
        intent_type, confidence, ambiguity = detect_intent_type(folded, assets, volume, period)
        project_required = intent_requires_project(intent_type)

        missing_information = detect_missing_information(
            intent_type=intent_type,
            confidence_score=confidence,
            project_required=project_required,
            project_hint=project_hint,
            active_project_hint=chat_request.active_project_hint,
            platforms=platforms,
            volume=volume,
        )

        ambiguity_flags = list(ambiguity)
        if confidence < 7:
            append_unique(ambiguity_flags, "low_confidence")
        for item in missing_information:
            if item in {"project", "platform", "volume"}:
                append_unique(ambiguity_flags, f"missing_{item}")

        if intent_type is IntentType.UNKNOWN_OR_AMBIGUOUS and not ambiguity_flags:
            ambiguity_flags.append("unknown_request")

        return Intent(
            intent_type=intent_type,
            confidence_score=confidence,
            project_required=project_required,
            project_hint=project_hint,
            period_hint=period,
            platforms=platforms,
            requested_volume=volume,
            requested_assets=assets,
            output_expectation=detect_output_expectation(folded),
            missing_information=missing_information,
            ambiguity_flags=ambiguity_flags,
        )


def normalize_user_message(message: str) -> str:
    return re.sub(r"\s+", " ", message).strip()


def fold_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower()


def detect_platforms(folded_message: str) -> list[Platform]:
    platforms: list[Platform] = []
    if re.search(r"\b(facebook|fb)\b", folded_message):
        platforms.append(Platform.FACEBOOK)
    if re.search(r"\b(linkedin|linked in)\b", folded_message):
        platforms.append(Platform.LINKEDIN)
    return platforms


def detect_assets(folded_message: str) -> RequestedAssets:
    text_only = bool(re.search(r"\b(texte seul|text only|sans visuel|sans image)\b", folded_message))
    images = bool(
        re.search(
            r"\b(image|images|visuel|visuels|photo|photos|illustration|design|crea|creatif)\b",
            folded_message,
        )
    )
    videos = bool(re.search(r"\b(video|videos|reel|reels|short|shorts|script video)\b", folded_message))
    carousels = bool(re.search(r"\b(carousel|carousels|slide|slides)\b", folded_message))
    if text_only:
        images = False
        videos = False
        carousels = False
    return RequestedAssets(
        text=True,
        images=images or carousels,
        videos=videos,
        carousels=carousels,
    )


def detect_requested_volume(folded_message: str, platforms: list[Platform]) -> RequestedVolume:
    per_platform: dict[str, int] = {}
    for match in re.finditer(
        r"\b(?P<count>\d{1,4})\s*(?:posts?|publications?|contenus?)?\s*(?P<platform>facebook|fb|linkedin|linked in)\b",
        folded_message,
    ):
        platform = normalize_platform_name(match.group("platform"))
        per_platform[platform] = int(match.group("count"))

    total = sum(per_platform.values())
    content_count_match = re.search(
        r"\b(?P<count>\d{1,4})\s*(?:posts?|publications?|contenus?|copies?|idees?)\b",
        folded_message,
    )
    if content_count_match:
        total = int(content_count_match.group("count"))

    french_number = detect_common_french_number(folded_message)
    if french_number and total == 0:
        total = french_number

    if total and not per_platform and len(platforms) == 1:
        per_platform[platforms[0].value] = total

    return RequestedVolume(total_items=total, per_platform=per_platform)


def detect_common_french_number(folded_message: str) -> int:
    values = {
        "dix": 10,
        "vingt": 20,
        "trente": 30,
        "quarante": 40,
        "cinquante": 50,
        "soixante": 60,
        "soixante dix": 70,
        "soixante-dix": 70,
        "cent": 100,
    }
    for token, count in values.items():
        if re.search(rf"\b{re.escape(token)}\b", folded_message):
            return count
    return 0


def detect_period(folded_message: str) -> PeriodHint:
    week_match = re.search(r"\b(semaine|week)\s*(?P<number>\d{1,2})?\b", folded_message)
    if week_match:
        number = week_match.group("number")
        value = f"semaine {number}" if number else "semaine"
        return PeriodHint(period_type=PeriodType.WEEK, value=value)

    month_match = re.search(r"\b(mois|month)\s*(?P<number>\d{1,2})?\b", folded_message)
    if month_match:
        number = month_match.group("number")
        value = f"mois {number}" if number else "mois"
        return PeriodHint(period_type=PeriodType.MONTH, value=value)

    if re.search(r"\b(trimestre|quarter)\b", folded_message):
        return PeriodHint(period_type=PeriodType.QUARTER, value="trimestre")

    if re.search(r"\b(1 an|un an|annee|annuel|annuelle|year)\b", folded_message):
        return PeriodHint(period_type=PeriodType.CUSTOM, value="1 an")

    return PeriodHint()


def detect_project_hint(message: str, active_project_hint: str = "") -> str:
    patterns = [
        r"\bprojet\s+(?P<name>[A-Za-z0-9 _-]{3,80})",
        r"\bdu projet\s+(?P<name>[A-Za-z0-9 _-]{3,80})",
        r"\bsur le projet\s+(?P<name>[A-Za-z0-9 _-]{3,80})",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, flags=re.IGNORECASE)
        if match:
            return clean_project_hint(match.group("name"))
    return active_project_hint.strip()


def clean_project_hint(value: str) -> str:
    cleaned = re.split(r"\b(pour|avec|et|sur|en|dans|:)\b", value.strip(), maxsplit=1, flags=re.IGNORECASE)[0]
    return cleaned.strip(" .,:;!?\"'")


def detect_intent_type(
    folded_message: str,
    assets: RequestedAssets,
    volume: RequestedVolume,
    period: PeriodHint,
) -> tuple[IntentType, int, list[str]]:
    ambiguity: list[str] = []
    words = set(re.findall(r"[a-z0-9]+", folded_message))
    has_content = bool(words & CONTENT_WORDS)
    has_project = bool(words & PROJECT_WORDS)
    has_strategy = any(token in folded_message for token in STRATEGY_WORDS)
    calendar_match = re.search(r"\b(calendrier|editorial|planning|annuel|annuelle)\b", folded_message)
    content_match = re.search(r"\b(posts?|publications?|contenus?|carrousels?|visuels?|textes?)\b", folded_message)
    has_calendar = bool(calendar_match)
    calendar_is_primary_object = bool(
        calendar_match
        and (
            not content_match
            or calendar_match.start() < content_match.start()
        )
        and re.search(
            r"\b(cree|creer|genere|generer|construis|batir|prepare|etablis|planifie|fais)\b.{0,80}\b(calendrier|planning|editorial|annuel|annuelle)\b",
            folded_message,
        )
    )
    has_revision = bool(re.search(r"\b(revise|reviser|corrige|corriger|modifie|modifier|refais|ameliorer)\b", folded_message))
    has_performance = bool(re.search(r"\b(performance|resultats|analytics|kpi|analyse|analyser|rapport)\b", folded_message))
    has_status = bool(re.search(r"\b(statut|status|etat|avancement)\b", folded_message))
    has_list = bool(re.search(r"\b(liste|lister|montre les projets|projets connus)\b", folded_message))
    has_question = folded_message.endswith("?") or bool(re.search(r"\b(comment|pourquoi|explique|dis moi)\b", folded_message))

    if has_list and "projet" in words:
        return IntentType.LIST_PROJECTS, 9, ambiguity

    if has_status and "job" in words:
        return IntentType.SHOW_JOB_STATUS, 9, ambiguity

    if calendar_is_primary_object:
        return IntentType.GENERATE_ANNUAL_CALENDAR, 9, ambiguity

    if has_performance:
        return IntentType.ANALYZE_PERFORMANCE, 9, ambiguity

    if has_revision and has_content:
        return IntentType.REVISE_CONTENT_BATCH, 9, ambiguity

    if has_content or volume.total_items > 0:
        return IntentType.GENERATE_CONTENT_BATCH, 9, ambiguity

    if has_calendar or period.period_type is PeriodType.CUSTOM:
        return IntentType.GENERATE_ANNUAL_CALENDAR, 8, ambiguity

    if assets.videos and not has_content:
        return IntentType.GENERATE_VIDEO_BATCH, 8, ambiguity

    if (assets.images or assets.carousels) and not has_content:
        return IntentType.GENERATE_VISUAL_BATCH, 8, ambiguity

    if has_strategy:
        return IntentType.CREATE_CAMPAIGN_PACK, 9, ambiguity

    if has_project and bool(re.search(r"\b(cree|creer|nouveau|nouvelle|idee|lancer)\b", folded_message)):
        return IntentType.CREATE_PROJECT_FROM_IDEA, 8, ambiguity

    if has_question:
        return IntentType.ANSWER_PROJECT_QUESTION, 7, ambiguity

    ambiguity.append("no_stable_intent_detected")
    return IntentType.UNKNOWN_OR_AMBIGUOUS, 4, ambiguity


def intent_requires_project(intent_type: IntentType) -> bool:
    return intent_type not in {
        IntentType.CREATE_PROJECT_FROM_IDEA,
        IntentType.LIST_PROJECTS,
        IntentType.UNKNOWN_OR_AMBIGUOUS,
    }


def detect_missing_information(
    *,
    intent_type: IntentType,
    confidence_score: int,
    project_required: bool,
    project_hint: str,
    active_project_hint: str,
    platforms: list[Platform],
    volume: RequestedVolume,
) -> list[str]:
    missing: list[str] = []
    if project_required and not (project_hint or active_project_hint):
        missing.append("project")
    if intent_type in {
        IntentType.GENERATE_CONTENT_BATCH,
        IntentType.GENERATE_VIDEO_BATCH,
        IntentType.GENERATE_VISUAL_BATCH,
    }:
        if not platforms:
            missing.append("platform")
    if intent_type is IntentType.GENERATE_CONTENT_BATCH and volume.total_items == 0:
        missing.append("volume")
    if confidence_score < 7:
        missing.append("clarification")
    return missing


def detect_output_expectation(folded_message: str) -> OutputExpectation:
    chat_only = bool(re.search(r"\b(reponds juste|chat seulement|sans fichier)\b", folded_message))
    files_required = not chat_only
    wants_json = bool(re.search(r"\b(json|schema|structure)\b", folded_message))
    return OutputExpectation(
        files_required=files_required,
        chat_only=chat_only,
        markdown=files_required or not wants_json,
        json=wants_json or files_required,
    )


def normalize_platform_name(value: str) -> str:
    if value in {"fb", "facebook"}:
        return Platform.FACEBOOK.value
    return Platform.LINKEDIN.value


def append_unique(items: list[str], item: str) -> None:
    if item not in items:
        items.append(item)
