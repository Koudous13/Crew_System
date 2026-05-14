import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from crew_system.agents import AgentOutput, SchemaValidationResult
from crew_system.core.models import ContextSnapshot, GateDecision
from crew_system.quality import QualityGateEngine


class QualityGateEngineTest(unittest.TestCase):
    def test_accepts_strong_clean_growth_output_without_flattening(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=AgentOutput(
                agent_id="growth_hacker",
                schema_name="GrowthSystem",
                payload={
                    "growth_system": {
                        "summary": (
                            "Pour les coachs premium sur Facebook, utiliser un hook de tension, "
                            "une boucle de conversation, une preuve explicite et un levier de "
                            "curiosite qui transforme les commentaires en leads."
                        )
                    }
                },
                quality_score=8,
                confidence_score=8,
                weakest_point="necessite exemples de posts",
                next_improvement="brancher calendrier semaine 4",
            ),
            schema_validation=SchemaValidationResult(valid=True, schema_name="GrowthSystem"),
            context=sample_context(),
        )

        self.assertEqual(assessment.report.decision, GateDecision.ACCEPT)
        self.assertFalse(assessment.retry_allowed)
        self.assertEqual(assessment.required_action, "continue")

    def test_revises_generic_output_instead_of_accepting_banality(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=AgentOutput(
                agent_id="copywriter",
                schema_name="ContentUnits",
                payload={"content_units": {"post": "Soyez authentique et apportez de la valeur."}},
                quality_score=7,
                confidence_score=7,
                weakest_point="trop court",
                next_improvement="ajouter angles",
            ),
            schema_validation=SchemaValidationResult(valid=True, schema_name="ContentUnits"),
            context=sample_context(),
        )

        self.assertEqual(assessment.report.decision, GateDecision.REVISE)
        self.assertTrue(assessment.retry_allowed)
        self.assertEqual(assessment.required_action, "revise")
        self.assertTrue(any("anti_banality_gate" in reason for reason in assessment.reasons))

    def test_rejects_invalid_schema_but_allows_retry(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=None,
            schema_validation=SchemaValidationResult(
                valid=False,
                schema_name="GrowthSystem",
                errors=["$.growth_system is required"],
            ),
            context=sample_context(),
        )

        self.assertEqual(assessment.report.decision, GateDecision.REJECT)
        self.assertTrue(assessment.retry_allowed)
        self.assertEqual(assessment.required_action, "retry_or_stop")

    def test_escalates_critical_risk_without_banning_clean_intensity(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=AgentOutput(
                agent_id="growth_hacker",
                schema_name="GrowthSystem",
                payload={
                    "growth_system": {
                        "summary": (
                            "Creer une boucle virale avec de faux temoignages, fausse urgence "
                            "et spam de commentaires pour simuler la preuve sociale."
                        )
                    }
                },
                quality_score=8,
                confidence_score=8,
                weakest_point="risque",
                next_improvement="encadrer",
            ),
            schema_validation=SchemaValidationResult(valid=True, schema_name="GrowthSystem"),
            context=sample_context(),
        )

        self.assertEqual(assessment.report.decision, GateDecision.ESCALATE)
        self.assertFalse(assessment.retry_allowed)
        self.assertEqual(assessment.required_action, "ask_user")

    def test_risk_reviewer_can_name_risks_without_being_marked_as_proposing_them(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=AgentOutput(
                agent_id="risk_reviewer",
                schema_name="RiskReview",
                payload={
                    "risk_review": {
                        "summary": (
                            "Refuser les faux temoignages, la fausse urgence et le spam. "
                            "Conserver la tension propre: preuve disponible, CTA commentaire volontaire."
                        )
                    }
                },
                quality_score=8,
                confidence_score=8,
                weakest_point="besoin exemples finaux",
                next_improvement="relire les posts",
            ),
            schema_validation=SchemaValidationResult(valid=True, schema_name="RiskReview"),
            context=sample_context(),
        )

        self.assertEqual(assessment.report.decision, GateDecision.ACCEPT)
        self.assertEqual(assessment.required_action, "continue")

    def test_accepts_risky_terms_when_they_are_explicitly_refused(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=AgentOutput(
                agent_id="growth_hacker",
                schema_name="GrowthSystem",
                payload={
                    "growth_system": {
                        "summary": (
                            "Pour coachs premium sur Facebook, construire une boucle de conversation "
                            "avec preuve disponible, hook de tension, angle de curiosite et commentaires "
                            "volontaires vers leads. Spam est interdit; sans faux temoignage, pas de "
                            "fausse urgence, aucun scraping agressif. No spam or unsolicited outreach. "
                            "Mesurer les commentaires pertinents hors spam et les signalements de spam. "
                            "do_not_use: fausse urgence."
                        )
                    }
                },
                quality_score=8,
                confidence_score=8,
                weakest_point="necessite variantes visuelles",
                next_improvement="tester trois hooks",
            ),
            schema_validation=SchemaValidationResult(valid=True, schema_name="GrowthSystem"),
            context=sample_context(),
        )

        self.assertEqual(assessment.report.decision, GateDecision.ACCEPT)
        self.assertEqual(assessment.required_action, "continue")

    def test_risk_gate_ignores_safe_json_guardrail_keys(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=AgentOutput(
                agent_id="facebook_native_agent",
                schema_name="FacebookNativeStrategy",
                payload={
                    "facebook_strategy": {
                        "summary": (
                            "Pour coachs premium sur Facebook, utiliser hook de tension, preuve "
                            "disponible, boucle de conversation et levier de curiosite vers leads."
                        ),
                        "ethical_safeguards": {
                            "no_spam": "Les interactions restent volontaires et qualifiees.",
                            "no_fake_urgency": "La rarete vient de l'alignement, pas d'un compte a rebours artificiel.",
                        },
                    }
                },
                quality_score=8,
                confidence_score=8,
                weakest_point="necessite calendrier",
                next_improvement="decliner en posts",
            ),
            schema_validation=SchemaValidationResult(valid=True, schema_name="FacebookNativeStrategy"),
            context=sample_context(),
        )

        self.assertEqual(assessment.report.decision, GateDecision.ACCEPT)

    def test_risk_gate_allows_risk_terms_when_describing_rejection_or_fear(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=AgentOutput(
                agent_id="audience_psychologist",
                schema_name="AudienceIntelligence",
                payload={
                    "audience_intelligence": {
                        "summary": (
                            "Pour coachs premium sur Facebook, exploiter une tension utile: "
                            "peur d'etre associe aux pratiques de spam, rejet des faux "
                            "temoignages, desir de preuve disponible et boucle de conversation "
                            "vers des leads qualifies."
                        )
                    }
                },
                quality_score=8,
                confidence_score=8,
                weakest_point="besoin interviews",
                next_improvement="valider verbatims",
            ),
            schema_validation=SchemaValidationResult(valid=True, schema_name="AudienceIntelligence"),
            context=sample_context(),
        )

        self.assertEqual(assessment.report.decision, GateDecision.ACCEPT)

    def test_context_missing_blocks_instead_of_silent_success(self) -> None:
        assessment = QualityGateEngine().evaluate_agent_output(
            job_id="job_1",
            output=AgentOutput(
                agent_id="strategist",
                schema_name="StrategicDiagnosis",
                payload={"strategic_diagnosis": {"summary": "coachs premium facebook"}},
                quality_score=8,
                confidence_score=8,
                weakest_point="context",
                next_improvement="load files",
            ),
            schema_validation=SchemaValidationResult(valid=True, schema_name="StrategicDiagnosis"),
            context=ContextSnapshot(
                job_id="job_1",
                project_slug="coach_saas",
                created_at="2026-05-14T10:00:00Z",
                missing_files=["strategy/positioning.md"],
            ),
        )

        self.assertEqual(assessment.report.decision, GateDecision.ESCALATE)
        self.assertFalse(assessment.retry_allowed)
        self.assertEqual(assessment.required_action, "ask_user")


def sample_context() -> ContextSnapshot:
    return ContextSnapshot(
        job_id="job_1",
        project_slug="coach_saas",
        created_at="2026-05-14T10:00:00Z",
        useful_points=[
            "Audience: coachs premium",
            "Canal: Facebook",
            "Objectif: conversations qualifiees et leads",
        ],
    )


if __name__ == "__main__":
    unittest.main()
