from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from crew_system.agents.runner import AgentOutput, SchemaValidationResult
from crew_system.core.models import (
    ContextSnapshot,
    GateDecision,
    GateResult,
    ModelValidationError,
    QualityReport,
    QualityScope,
    RuntimeModel,
    require_bool,
    require_model,
    require_non_empty,
    validate_score,
    validate_string_list,
)


SCHEMA_GATE = "schema_gate"
CONTEXT_GATE = "context_gate"
STRATEGIC_ALIGNMENT_GATE = "strategic_alignment_gate"
INTENSITY_PRESERVATION_GATE = "intensity_preservation_gate"
ANTI_BANALITY_GATE = "anti_banality_gate"
RISK_GATE = "risk_gate"
HANDOFF_GATE = "handoff_gate"

GENERIC_PATTERNS = [
    "boostez votre business",
    "engagez votre audience",
    "creez du contenu de qualite",
    "soyez authentique",
    "apportez de la valeur",
    "developpez votre presence",
    "passez au niveau superieur",
]

CLEAN_INTENSITY_TERMS = [
    "desir",
    "tension",
    "hook",
    "angle",
    "conversation",
    "preuve",
    "growth",
    "viral",
    "levier",
    "boucle",
    "friction",
    "curiosite",
    "psychologie",
    "influence",
]

FORBIDDEN_RISK_PATTERNS = [
    "faux temoignage",
    "faux tÃ©moignage",
    "faux avis",
    "fausse preuve",
    "fausse urgence",
    "faux compte",
    "faux comptes",
    "bot",
    "bots",
    "spam",
    "scraping agressif",
    "garantie de resultats",
    "garantie de rÃ©sultats",
    "revenu garanti",
    "resultat garanti",
    "rÃ©sultat garanti",
]

PRE_RISK_SAFETY_MARKERS = [
    "sans",
    "pas de",
    "pas du",
    "ne pas",
    "n'utilise pas",
    "eviter",
    "evite",
    "evitant",
    "refuser",
    "refus",
    "refuse",
    "refusons",
    "rejeter",
    "rejet",
    "interdire",
    "interdit",
    "proscrire",
    "aucun",
    "zero",
    "anti",
    "contre",
    "garde-fou",
    "garde-fous",
    "do_not_use",
    "controle",
    "qualite",
    "ethique",
    "integrite",
    "peur",
    "crainte",
    "risque",
    "perception de",
    "signalement de",
    "signalements de",
    "pratiques de",
    "tactiques de",
    "ressemble a",
    "associe aux",
    "hors",
    "no ",
    "never",
    "without",
    "avoid",
    "reject",
]

POST_RISK_SAFETY_MARKERS = [
    "a eviter",
    "est a eviter",
    "est evite",
    "est interdit",
    "interdit",
    "a refuser",
    "refuse",
    "non autorise",
    "non acceptable",
    "proscrire",
    "controle",
    "encadre",
    "a controler",
    "a encadrer",
    "a proscrire",
    "a refuser",
]

REVIEW_AGENT_IDS = {
    "anti_banality_agent",
    "risk_reviewer",
    "performance_analyst",
}


@dataclass(slots=True)
class QualityAssessment(RuntimeModel):
    report: QualityReport
    retry_allowed: bool
    required_action: str
    reasons: list[str] = field(default_factory=list)

    def validate(self) -> None:
        require_model(self.report, QualityReport, "QualityAssessment.report")
        require_bool(self.retry_allowed, "QualityAssessment.retry_allowed")
        require_non_empty(self.required_action, "QualityAssessment.required_action")
        validate_string_list(self.reasons, "QualityAssessment.reasons")


class QualityGateEngine:
    def evaluate_agent_output(
        self,
        *,
        job_id: str,
        output: AgentOutput | None,
        schema_validation: SchemaValidationResult,
        context: ContextSnapshot | None,
    ) -> QualityAssessment:
        gates = [
            self.schema_gate(schema_validation),
            self.context_gate(context),
            self.strategic_alignment_gate(output, context),
            self.intensity_preservation_gate(output),
            self.anti_banality_gate(output),
            self.risk_gate(output),
            self.handoff_gate(output),
        ]
        decision = aggregate_decision(gates)
        overall_score = aggregate_score(gates)
        confidence_score = output.confidence_score if output else 0
        target_id = output.agent_id if output else schema_validation.schema_name
        report = QualityReport(
            quality_report_id=f"qr_{job_id}_{safe_target_id(target_id)}",
            job_id=job_id,
            applies_to=QualityScope.AGENT_OUTPUT,
            target_id=target_id,
            decision=decision,
            overall_score=overall_score,
            confidence_score=confidence_score,
            gate_results=gates,
            revision_notes=revision_notes_for(gates),
        )
        return QualityAssessment(
            report=report,
            retry_allowed=retry_allowed_for(decision, gates),
            required_action=required_action_for(decision, gates),
            reasons=decision_reasons(gates),
        )

    def schema_gate(self, schema_validation: SchemaValidationResult) -> GateResult:
        if schema_validation.valid:
            return pass_gate(SCHEMA_GATE, 10, "output matches registered schema")
        return fail_gate(
            SCHEMA_GATE,
            GateDecision.REJECT,
            0,
            schema_validation.errors or ["schema validation failed"],
        )

    def context_gate(self, context: ContextSnapshot | None) -> GateResult:
        if context is None:
            return fail_gate(CONTEXT_GATE, GateDecision.ESCALATE, 0, ["context snapshot is missing"])
        if context.missing_files:
            return fail_gate(
                CONTEXT_GATE,
                GateDecision.ESCALATE,
                2,
                [f"missing required context: {path}" for path in context.missing_files],
            )
        return pass_gate(CONTEXT_GATE, 9, "required context is available")

    def strategic_alignment_gate(
        self,
        output: AgentOutput | None,
        context: ContextSnapshot | None,
    ) -> GateResult:
        if output is None:
            return fail_gate(
                STRATEGIC_ALIGNMENT_GATE,
                GateDecision.REJECT,
                0,
                ["no output to evaluate"],
            )
        output_text = fold(payload_text(output.payload))
        context_text = fold(" ".join(context.useful_points) if context else "")
        if not context_text:
            return pass_gate(STRATEGIC_ALIGNMENT_GATE, 7, "no detailed context points to compare")
        context_terms = meaningful_terms(context_text)
        matches = [term for term in context_terms if term in output_text]
        if matches:
            return pass_gate(
                STRATEGIC_ALIGNMENT_GATE,
                min(10, 7 + len(matches)),
                "output reuses strategic context: " + ", ".join(matches[:5]),
            )
        if output.agent_id in REVIEW_AGENT_IDS:
            return pass_gate(
                STRATEGIC_ALIGNMENT_GATE,
                7,
                "review agent can evaluate outputs without repeating every strategic term",
            )
        return fail_gate(
            STRATEGIC_ALIGNMENT_GATE,
            GateDecision.REVISE,
            4,
            ["output does not clearly use loaded strategy context"],
        )

    def intensity_preservation_gate(self, output: AgentOutput | None) -> GateResult:
        if output is None:
            return fail_gate(INTENSITY_PRESERVATION_GATE, GateDecision.REJECT, 0, ["no output"])
        text = fold(payload_text(output.payload))
        intensity_hits = [term for term in CLEAN_INTENSITY_TERMS if term in text]
        flattening_hits = [
            term
            for term in ["ne pas influencer", "eviter toute tension", "toujours rester neutre", "pas de persuasion"]
            if term in text
        ]
        if flattening_hits:
            return fail_gate(
                INTENSITY_PRESERVATION_GATE,
                GateDecision.REVISE,
                4,
                ["output appears to neutralize strategic intensity: " + ", ".join(flattening_hits)],
            )
        if output.agent_id in REVIEW_AGENT_IDS:
            return pass_gate(
                INTENSITY_PRESERVATION_GATE,
                8,
                "review agent does not need to add intensity; it only must avoid flattening valid intensity",
            )
        if intensity_hits:
            return pass_gate(
                INTENSITY_PRESERVATION_GATE,
                min(10, 7 + len(intensity_hits)),
                "clean intensity preserved: " + ", ".join(intensity_hits[:6]),
            )
        return fail_gate(
            INTENSITY_PRESERVATION_GATE,
            GateDecision.REVISE,
            5,
            ["output lacks persuasive tension, hooks or growth mechanics"],
        )

    def anti_banality_gate(self, output: AgentOutput | None) -> GateResult:
        if output is None:
            return fail_gate(ANTI_BANALITY_GATE, GateDecision.REJECT, 0, ["no output"])
        text = fold(payload_text(output.payload))
        generic_hits = [pattern for pattern in GENERIC_PATTERNS if pattern in text]
        specific_terms = meaningful_terms(text)
        if generic_hits:
            return fail_gate(
                ANTI_BANALITY_GATE,
                GateDecision.REVISE,
                4,
                ["generic wording detected: " + ", ".join(generic_hits[:3])],
            )
        if len(set(specific_terms)) < 6:
            return fail_gate(
                ANTI_BANALITY_GATE,
                GateDecision.REVISE,
                5,
                ["not enough concrete strategic details"],
            )
        return pass_gate(ANTI_BANALITY_GATE, min(10, 6 + len(set(specific_terms)) // 4), "output is specific enough")

    def risk_gate(self, output: AgentOutput | None) -> GateResult:
        if output is None:
            return fail_gate(RISK_GATE, GateDecision.REJECT, 0, ["no output"])
        text = fold(payload_text(output.payload))
        critical_hits = unsafe_risk_hits(text)
        if output.agent_id == "risk_reviewer" and critical_hits:
            return pass_gate(
                RISK_GATE,
                8,
                "risk reviewer identified critical risk language for control: " + ", ".join(critical_hits[:5]),
            )
        if critical_hits:
            return fail_gate(
                RISK_GATE,
                GateDecision.ESCALATE,
                2,
                ["critical risk detected: " + ", ".join(critical_hits[:5])],
            )
        risk_flags = [flag for flag in output.risk_flags if flag.strip()]
        if risk_flags:
            return pass_gate(RISK_GATE, 7, "risk flags present for later review: " + ", ".join(risk_flags[:5]))
        return pass_gate(RISK_GATE, 9, "no critical deception, spam or false-proof risk detected")

    def handoff_gate(self, output: AgentOutput | None) -> GateResult:
        if output is None:
            return fail_gate(HANDOFF_GATE, GateDecision.REJECT, 0, ["no output"])
        if output.quality_score < 6 or output.confidence_score < 6:
            return fail_gate(
                HANDOFF_GATE,
                GateDecision.REVISE,
                min(output.quality_score, output.confidence_score),
                ["agent self-evaluation is too low for handoff"],
            )
        if not output.weakest_point or not output.next_improvement:
            return fail_gate(
                HANDOFF_GATE,
                GateDecision.REVISE,
                6,
                ["agent must expose weakest point and next improvement"],
            )
        return pass_gate(HANDOFF_GATE, min(10, (output.quality_score + output.confidence_score) // 2), "agent provided usable handoff metadata")


def pass_gate(name: str, score: int, reason: str) -> GateResult:
    return GateResult(
        gate_name=name,
        passed=True,
        decision=GateDecision.ACCEPT,
        score=score,
        reasons=[reason],
    )


def fail_gate(name: str, decision: GateDecision, score: int, reasons: list[str]) -> GateResult:
    return GateResult(
        gate_name=name,
        passed=False,
        decision=decision,
        score=score,
        reasons=reasons,
    )


def aggregate_decision(gates: list[GateResult]) -> GateDecision:
    failed = [gate for gate in gates if not gate.passed]
    if not failed:
        return GateDecision.ACCEPT
    if any(gate.decision is GateDecision.REJECT for gate in failed):
        return GateDecision.REJECT
    if any(gate.decision is GateDecision.ESCALATE for gate in failed):
        return GateDecision.ESCALATE
    return GateDecision.REVISE


def aggregate_score(gates: list[GateResult]) -> int:
    scores = [gate.score for gate in gates if gate.score is not None]
    if not scores:
        raise ModelValidationError("Quality gates must produce scores")
    return max(0, min(10, round(sum(scores) / len(scores))))


def retry_allowed_for(decision: GateDecision, gates: list[GateResult]) -> bool:
    if decision is GateDecision.ACCEPT:
        return False
    failed_names = {gate.gate_name for gate in gates if not gate.passed}
    if SCHEMA_GATE in failed_names:
        return True
    if CONTEXT_GATE in failed_names:
        return False
    if RISK_GATE in failed_names and decision is GateDecision.ESCALATE:
        return False
    return decision is GateDecision.REVISE


def required_action_for(decision: GateDecision, gates: list[GateResult]) -> str:
    failed_names = {gate.gate_name for gate in gates if not gate.passed}
    if decision is GateDecision.ACCEPT:
        return "continue"
    if CONTEXT_GATE in failed_names:
        return "ask_user"
    if decision is GateDecision.ESCALATE:
        return "ask_user"
    if decision is GateDecision.REJECT:
        return "retry_or_stop"
    return "revise"


def revision_notes_for(gates: list[GateResult]) -> list[str]:
    notes: list[str] = []
    for gate in gates:
        if not gate.passed:
            notes.extend(f"{gate.gate_name}: {reason}" for reason in gate.reasons)
    return notes


def decision_reasons(gates: list[GateResult]) -> list[str]:
    return [f"{gate.gate_name}: {reason}" for gate in gates for reason in gate.reasons if not gate.passed]


def safe_target_id(value: str) -> str:
    lowered = fold(value).replace("-", "_")
    cleaned = re.sub(r"[^a-z0-9_:]+", "_", lowered).strip("_")
    return cleaned or "agent_output"


def payload_text(value: Any) -> str:
    if isinstance(value, dict):
        parts: list[str] = []
        for key, item in value.items():
            parts.append(str(key))
            parts.append(payload_text(item))
        return " ".join(parts)
    if isinstance(value, list):
        return " ".join(payload_text(item) for item in value)
    return str(value)


def fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower()


def meaningful_terms(text: str) -> list[str]:
    stopwords = {
        "avec",
        "dans",
        "pour",
        "une",
        "des",
        "les",
        "sur",
        "qui",
        "que",
        "est",
        "plus",
        "sans",
        "etre",
        "leur",
        "leurs",
        "vous",
        "nous",
        "votre",
        "notre",
        "agent",
        "schema",
        "output",
    }
    terms = re.findall(r"[a-z0-9]{4,}", text)
    return [term for term in terms if term not in stopwords]


def unsafe_risk_hits(text: str) -> list[str]:
    hits: list[str] = []
    for pattern in FORBIDDEN_RISK_PATTERNS:
        expression = re.compile(rf"(?<![a-z0-9_]){re.escape(fold(pattern))}(?![a-z0-9_])")
        for match in expression.finditer(text):
            previous_text = text[max(0, match.start() - 80) : match.start()]
            next_text = text[match.end() : match.end() + 80]
            if risk_is_safely_framed(previous_text, next_text):
                continue
            hits.append(fold(pattern))
            break
    return hits


def risk_is_safely_framed(previous_text: str, next_text: str) -> bool:
    return any(marker in previous_text for marker in PRE_RISK_SAFETY_MARKERS) or any(
        marker in next_text for marker in POST_RISK_SAFETY_MARKERS
    )
