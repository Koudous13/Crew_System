from __future__ import annotations

from dataclasses import dataclass

from crew_system.core.models import ContextSnapshot, IntentType, NormalizedRequest


@dataclass(frozen=True, slots=True)
class ClarificationPrompt:
    message: str
    missing_information: list[str]
    blocked_reasons: list[str]
    required_questions: list[str]
    suggested_user_reply: str
    next_actions: list[str]


CONTENT_INTENTS = {
    IntentType.GENERATE_CONTENT_BATCH,
    IntentType.GENERATE_VIDEO_BATCH,
    IntentType.GENERATE_VISUAL_BATCH,
    IntentType.REVISE_CONTENT_BATCH,
}


def build_clarification_prompt(
    request: NormalizedRequest,
    context: ContextSnapshot | None,
    blocked_reasons: list[str],
) -> ClarificationPrompt:
    blockers = dedupe(blocked_reasons)
    missing_information = missing_information_from(request, blockers)
    questions = required_questions_for(request, context, blockers, missing_information)
    suggested_reply = suggested_reply_for(request, blockers, missing_information)
    message = message_for(request, blockers)
    next_actions = [
        "Reponds point par point dans le chat.",
        "Si le projet est encore vide, commence par demander la base strategique complete.",
    ]
    return ClarificationPrompt(
        message=message,
        missing_information=missing_information,
        blocked_reasons=blockers,
        required_questions=questions,
        suggested_user_reply=suggested_reply,
        next_actions=next_actions,
    )


def missing_information_from(request: NormalizedRequest, blocked_reasons: list[str]) -> list[str]:
    missing = list(request.missing_information)
    for reason in blocked_reasons:
        if reason.startswith("missing_information:"):
            append_unique(missing, reason.split(":", 1)[1])
        elif reason == "missing_context_snapshot":
            append_unique(missing, "strategic_context")
        elif reason.startswith("missing_context:"):
            path = reason.split(":", 1)[1]
            if path == "brief/normalized_brief.json":
                append_unique(missing, "offer_brief")
            elif path.startswith("strategy/"):
                append_unique(missing, "strategy_pack")
            elif path.startswith("calendar/"):
                append_unique(missing, "annual_calendar")
            elif path.startswith("platforms/"):
                append_unique(missing, "platform_strategy")
            elif path.startswith("outputs/"):
                append_unique(missing, "source_batch")
            else:
                append_unique(missing, "project_context")
        elif reason == "unknown_or_ambiguous_intent":
            append_unique(missing, "clarification")
    return dedupe(missing)


def required_questions_for(
    request: NormalizedRequest,
    context: ContextSnapshot | None,
    blocked_reasons: list[str],
    missing_information: list[str],
) -> list[str]:
    questions: list[str] = []
    has_context_gap = context_has_gaps(context, blocked_reasons)

    if "project" in missing_information:
        append_unique(questions, "Quel projet dois-je utiliser exactement ? Donne le nom ou le slug du projet.")
    if "project_name" in missing_information:
        append_unique(questions, "Quel nom veux-tu donner a ce projet ?")
    if "platform" in missing_information:
        append_unique(questions, "Sur quelles plateformes dois-je travailler maintenant : Facebook, LinkedIn, ou les deux ?")
    if "volume" in missing_information:
        append_unique(questions, "Quel volume exact veux-tu produire et sur quelle periode ? Exemple : 70 posts Facebook sur 7 jours.")

    if has_context_gap:
        if request.intent.intent_type in CONTENT_INTENTS:
            append_unique(
                questions,
                "Le projet n'a pas encore une base strategique exploitable. Dois-je creer d'abord le campaign pack complet avant les contenus ?",
            )
        else:
            append_unique(
                questions,
                "Veux-tu que je construise d'abord la base strategique complete du projet ?",
            )
        append_unique(
            questions,
            "Quelle est l'offre exacte : produit, cible prioritaire, douleur forte et transformation promise ?",
        )
        append_unique(
            questions,
            "Quel angle dois-je privilegier : autorite, preuve, provocation maitrisee, education, histoire personnelle, ou un melange ?",
        )
        append_unique(
            questions,
            "Quelles contraintes dois-je respecter : promesse interdite, ton a eviter, preuves disponibles, sujets sensibles ?",
        )

    if "annual_calendar" in missing_information and request.intent.intent_type in CONTENT_INTENTS:
        append_unique(
            questions,
            "Dois-je construire le calendrier editorial annuel avant ce batch, ou produire seulement avec une hypothese de semaine ?",
        )
    if "platform_strategy" in missing_information:
        append_unique(
            questions,
            "Quelle strategie native dois-je appliquer pour chaque plateforme, ou veux-tu que je la definisse maintenant ?",
        )
    if "source_batch" in missing_information:
        append_unique(
            questions,
            "Quel batch ou quel fichier source dois-je utiliser comme base de revision ?",
        )
    if "clarification" in missing_information:
        append_unique(
            questions,
            "Quel livrable veux-tu vraiment maintenant : base strategique, calendrier annuel, batch de posts, scripts video, revision ou analyse ?",
        )

    if not questions:
        append_unique(
            questions,
            "Quelle decision ou quelle information dois-je utiliser pour continuer sans inventer une direction fragile ?",
        )
    return questions[:6]


def suggested_reply_for(
    request: NormalizedRequest,
    blocked_reasons: list[str],
    missing_information: list[str],
) -> str:
    lines: list[str] = []
    has_context_gap = any(
        reason == "missing_context_snapshot" or reason.startswith("missing_context:")
        for reason in blocked_reasons
    )

    if has_context_gap:
        lines.extend(
            [
                "Cree d'abord la base strategique complete pour ce projet.",
                "Offre : ",
                "Cible prioritaire : ",
                "Douleur forte : ",
                "Transformation promise : ",
                "Positionnement / ton : ",
                "Preuves disponibles : ",
                "Contraintes a respecter : ",
            ]
        )
        if request.intent.intent_type in CONTENT_INTENTS:
            lines.append(f"Ensuite, reprends ma demande initiale : {request.normalized_message}")
    else:
        lines.append("Voici les precisions pour continuer :")

    if "project" in missing_information:
        lines.append("Projet a utiliser : ")
    if "project_name" in missing_information:
        lines.append("Nom du projet : ")
    if "platform" in missing_information:
        lines.append("Plateformes : ")
    if "volume" in missing_information:
        lines.append("Volume et periode : ")
    if "clarification" in missing_information:
        lines.append("Livrable exact attendu : ")

    return "\n".join(dedupe(lines)).strip()


def message_for(request: NormalizedRequest, blocked_reasons: list[str]) -> str:
    if context_has_gaps(None, blocked_reasons):
        if request.intent.intent_type in CONTENT_INTENTS:
            return (
                "Je peux produire le batch, mais pas proprement encore : le projet n'a pas assez de base "
                "strategique. Reponds aux questions ci-dessous ou demande-moi de creer d'abord cette base."
            )
        return (
            "Il manque une base de contexte avant d'executer proprement. Reponds aux questions ci-dessous "
            "pour que je parte dans la bonne direction."
        )
    return "J'ai besoin de quelques precisions avant de continuer sans inventer une mauvaise direction."


def context_has_gaps(context: ContextSnapshot | None, blocked_reasons: list[str]) -> bool:
    if any(reason == "missing_context_snapshot" or reason.startswith("missing_context:") for reason in blocked_reasons):
        return True
    return bool(context and context.missing_files)


def dedupe(items: list[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        append_unique(result, item)
    return result


def append_unique(items: list[str], item: str) -> None:
    if item and item not in items:
        items.append(item)
