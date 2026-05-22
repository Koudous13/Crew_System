from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from crew_system.filesystem.workspace import FileSystemError, WorkspaceEngine
from crew_system.llm import LLMAPIError, LLMConfigurationError
from crew_system.llm.gemini import GeminiJsonClient


CHAT_REPLY_SCHEMA: dict[str, Any] = {
    "title": "ConversationReply",
    "type": "object",
    "additionalProperties": False,
    "required": ["response", "suggested_actions", "confidence_score"],
    "properties": {
        "response": {"type": "string"},
        "suggested_actions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "confidence_score": {"type": "integer", "minimum": 1, "maximum": 10},
    },
}


@dataclass(slots=True)
class ConversationalAnswer:
    response: str
    provider: str = "none"
    suggested_actions: list[str] = field(default_factory=list)


def answer_conversationally(
    *,
    message: str,
    conversation_messages: list[dict[str, Any]],
    workspace: WorkspaceEngine,
    project_slug: str,
    provider: str | None,
    env: Mapping[str, str] | None = None,
) -> ConversationalAnswer | None:
    if not is_conversational_turn(message):
        return None

    context = build_conversation_context(
        workspace=workspace,
        project_slug=project_slug,
        conversation_messages=conversation_messages,
    )
    folded = fold_chat_text(message).strip(" .!?\t\r\n")
    if is_lightweight_social_turn(re.sub(r"\s+", " ", folded)):
        return ConversationalAnswer(
            response=fallback_conversation_response(message, context),
            provider="none",
        )

    provider_name = (provider or "auto").strip().lower()
    if provider_name in {"auto", "gemini"}:
        try:
            payload = GeminiJsonClient.from_env(env).generate_json(
                system_prompt=conversation_system_prompt(),
                input_payload={
                    "user_message": message.strip(),
                    "project_context": context,
                    "available_actions": [
                        "creer_ou_renforcer_base_strategique",
                        "creer_campaign_pack",
                        "creer_calendrier_annuel",
                        "generer_batch_contenus",
                        "proposer_visuels_ou_videos",
                        "reviser_livrable",
                        "analyser_performance",
                    ],
                },
                output_schema=CHAT_REPLY_SCHEMA,
            )
            response = str(payload.get("response", "")).strip()
            if response:
                return ConversationalAnswer(
                    response=response,
                    provider="gemini",
                    suggested_actions=[
                        str(action).strip()
                        for action in payload.get("suggested_actions", [])
                        if str(action).strip()
                    ],
                )
        except (LLMAPIError, LLMConfigurationError):
            pass

    return ConversationalAnswer(
        response=fallback_conversation_response(message, context),
        provider="none",
    )


def is_conversational_turn(message: str) -> bool:
    folded = fold_chat_text(message).strip(" .!?\t\r\n")
    folded = re.sub(r"\s+", " ", folded)
    if not folded:
        return False
    if is_lightweight_social_turn(folded):
        return True
    if is_explicit_orchestration_request(folded):
        return False
    if is_direct_question(folded):
        return True
    if is_feedback_or_confusion(folded):
        return True
    word_count = len(re.findall(r"[a-z0-9]+", folded))
    return word_count <= 8


def is_lightweight_social_turn(folded: str) -> bool:
    greeting = r"(salut|bonjour|bonsoir|hello|hey|coucou|yo)"
    if re.fullmatch(rf"{greeting}(\s+(ca va|comment ca va|tu vas bien|comment tu vas))?", folded):
        return True
    if re.fullmatch(r"(ca va|comment ca va|tu vas bien|comment tu vas)", folded):
        return True
    acknowledgements = {
        "ok",
        "okay",
        "d accord",
        "daccord",
        "merci",
        "merci beaucoup",
        "super",
        "nickel",
        "parfait",
        "top",
        "cool",
        "ca marche",
        "tres bien",
        "bien recu",
    }
    return folded in acknowledgements


def is_explicit_orchestration_request(folded: str) -> bool:
    work_objects = (
        r"(base strategique|campaign pack|calendrier|planning|posts?|publications?|contenus?|"
        r"batch|visuels?|images?|videos?|reels?|carrousels?|documents?|fichiers?|livrables?|"
        r"strategie|audit|analyse performance|performance|rapport|revision)"
    )
    production_verbs = (
        r"(cree|creer|genere|generer|redige|rediger|ecris|ecrire|produis|produire|"
        r"prepare|preparer|construis|batir|lance|executer|execute|mets en place|fais moi|fais-moi)"
    )
    if re.search(rf"\b{production_verbs}\b", folded) and re.search(rf"\b{work_objects}\b", folded):
        return True
    if re.search(r"\b(\d{1,4}|dix|vingt|trente|quarante|cinquante|soixante|soixante dix|cent)\b", folded) and re.search(
        r"\b(posts?|publications?|contenus?)\b",
        folded,
    ):
        return True
    audit_verbs = r"(audite|auditer|analyse|analyser|revise|reviser|corrige|corriger|ameliore|ameliorer)"
    if re.search(rf"\b{audit_verbs}\b", folded) and re.search(
        r"\b(projet|document|livrable|strategie|contenu|batch|performance)\b",
        folded,
    ):
        return True
    return False


def is_direct_question(folded: str) -> bool:
    return folded.endswith("?") or bool(
        re.search(
            r"\b(comment|pourquoi|explique|dis moi|dis-moi|c est quoi|c'est quoi|"
            r"que peux tu|que peux-tu|qu est ce que|qu'est-ce que|est ce que|est-ce que|"
            r"quelle est|quelles sont|quoi faire|c quoi)\b",
            folded,
        )
    )


def is_feedback_or_confusion(folded: str) -> bool:
    return bool(
        re.search(
            r"\b(pas conversationnel|pas naturelle|pas naturel|je ne comprends pas|"
            r"tu n as pas compris|tu n'as pas compris|bizarre|nul|bug|erreur|"
            r"ca ne va pas|ca marche pas|probleme|souci|wtf|connerie|conneries)\b",
            folded,
        )
    )


def build_conversation_context(
    *,
    workspace: WorkspaceEngine,
    project_slug: str,
    conversation_messages: list[dict[str, Any]],
) -> dict[str, Any]:
    project_context: dict[str, Any] = {
        "project_slug": project_slug,
        "project_name": project_slug,
        "description": "",
        "key_files": [],
        "recent_messages": recent_messages(conversation_messages),
    }
    try:
        manifest = workspace.load_project_manifest(project_slug)
        project_context["project_name"] = manifest.project_name
        project_context["description"] = manifest.description
    except FileSystemError:
        return project_context

    project_root = workspace.project_path(project_slug)
    for relative_path in conversation_context_files():
        summary = read_project_file_summary(project_root, relative_path)
        if summary:
            project_context["key_files"].append({"path": relative_path, "summary": summary})
    return project_context


def conversation_context_files() -> list[str]:
    return [
        "README.md",
        "brief/normalized_brief.json",
        "outputs/campaign_packs/campaign_pack.md",
        "strategy/strategic_diagnosis.md",
        "strategy/positioning.md",
        "strategy/growth_system.md",
        "calendar/annual_editorial_calendar.md",
        "platforms/facebook_strategy.md",
        "platforms/linkedin_strategy.md",
    ]


def read_project_file_summary(project_root: Path, relative_path: str, limit: int = 900) -> str:
    path = (project_root / relative_path).resolve()
    try:
        path.relative_to(project_root.resolve())
    except ValueError:
        return ""
    if not path.exists() or path.is_dir():
        return ""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    if relative_path.endswith(".json"):
        text = summarize_json_text(text)
    else:
        lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("---")]
        text = " | ".join(lines[:10])
    return trim_text(text, limit)


def summarize_json_text(text: str) -> str:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return text
    if isinstance(payload, dict):
        items = []
        for key, value in list(payload.items())[:12]:
            if isinstance(value, (dict, list)):
                items.append(str(key))
            else:
                items.append(f"{key}: {value}")
        return " | ".join(items)
    return text


def recent_messages(messages: list[dict[str, Any]], limit: int = 8) -> list[dict[str, str]]:
    selected = messages[-limit:]
    return [
        {
            "role": str(message.get("role", "")),
            "content": trim_text(str(message.get("content", "")), 500),
        }
        for message in selected
        if str(message.get("content", "")).strip()
    ]


def conversation_system_prompt() -> str:
    return (
        "Tu es Crew_System, le copilote agentique de Koudous. Tu parles en français naturel, "
        "direct, calme et intelligent. Ton rôle ici est conversationnel : comprendre, expliquer, "
        "clarifier, orienter et proposer la prochaine meilleure action. Tu ne dois pas prétendre "
        "avoir lancé un job, des agents ou écrit des fichiers. Si l'utilisateur veut produire un "
        "livrable, propose la formulation claire à envoyer ou la question manquante. Réponds comme "
        "un vrai assistant de travail, pas comme un log technique. Ne mentionne jamais JSON, API, "
        "provider, modèle ou backend. Si l'utilisateur critique le système, reconnais le problème "
        "et explique concrètement comment il devrait se comporter."
    )


def fallback_conversation_response(message: str, context: dict[str, Any]) -> str:
    folded = fold_chat_text(message)
    project_name = str(context.get("project_name") or "ce projet")
    if is_lightweight_social_turn(folded.strip(" .!?\t\r\n")):
        return (
            f"Salut Koudous. Je suis prêt pour {project_name}. "
            "On peut discuter, clarifier une idée, préparer une demande propre ou lancer un vrai atelier quand tu me le demandes clairement."
        )
    if "conversation" in folded or "pas compris" in folded:
        return (
            "Tu as raison : le chat doit d'abord discuter avec toi, comprendre ton intention et poser les bonnes questions. "
            "Les agents doivent se lancer seulement quand tu demandes un livrable, un audit ou une production."
        )
    if "quoi" in folded or "comment" in folded or "pourquoi" in folded:
        return (
            f"Pour {project_name}, je peux te répondre directement ici, puis lancer les agents seulement si on passe à une production. "
            "Dis-moi ce que tu veux comprendre ou choisis une demande du parcours."
        )
    return (
        "Je te suis. Pour rester propre, je ne lance pas d'atelier sur ce message. "
        "Tu peux me poser une question, ou me demander explicitement de créer un calendrier, un batch de contenus, une révision ou une analyse."
    )


def trim_text(value: str, limit: int) -> str:
    value = " ".join(value.split())
    if len(value) <= limit:
        return value
    return value[: limit - 3].rstrip() + "..."


def fold_chat_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower()
