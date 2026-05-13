import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATE = "2026-05-13"
REGISTRY_VERSION = "0.1.0"
SCHEMA_VERSION = "0.1.0"


AGENTS = [
    ("intake_normalizer", "docs/agents/core/intake_normalizer.md", ["intake_normalization"], ["request_structuring"], ["normalized_brief"], ["project_manifest"], ["create_project_from_idea", "create_campaign_pack"], [], [], [], "", "strategist", ["normalized_brief"], ["quality_score", "confidence_score"], [], []),
    ("file_architect", "docs/agents/core/file_architect.md", ["project_file_planning"], ["manifest_planning"], ["project_file_plan"], ["write_plan"], ["create_project_from_idea", "create_campaign_pack"], ["revise_document"], [], [], "", "strategist", ["project_file_plan"], ["quality_score", "confidence_score"], ["intake_normalizer"], []),
    ("strategist", "docs/agents/core/strategist.md", ["strategic_diagnosis", "final_arbitration"], ["big_idea_design", "intensity_preservation"], ["strategic_diagnosis", "big_idea", "final_recommendation"], ["campaign_pack"], ["create_campaign_pack", "generate_content_batch", "revise_content_batch", "analyze_performance"], ["answer_project_question"], [], [], "", "anti_banality_agent", ["strategic_diagnosis"], ["quality_score", "confidence_score", "novelty_score"], ["intake_normalizer"], []),
    ("audience_psychologist", "docs/agents/core/audience_psychologist.md", ["audience_psychology"], ["emotional_tension_mapping", "trigger_language"], ["audience_intelligence", "emotional_tension"], ["influence_architecture", "hooks"], ["create_campaign_pack", "generate_content_batch"], ["analyze_performance"], [], [], "strategist", "anti_banality_agent", ["audience_intelligence"], ["quality_score", "confidence_score", "specificity_score"], ["strategist"], []),
    ("positioning_agent", "docs/agents/core/positioning_agent.md", ["positioning_design"], ["message_system_design", "proof_roadmap"], ["positioning", "message_system"], ["influence_architecture", "growth_system"], ["create_campaign_pack"], ["generate_content_batch", "revise_document", "analyze_performance"], [], [], "strategist", "strategist", ["positioning", "message_system"], ["quality_score", "confidence_score", "differentiation_score"], ["audience_psychologist"], []),
    ("influence_architect", "docs/agents/strategy/influence_architect.md", ["influence_architecture"], ["perception_manipulation", "belief_shift_design"], ["influence_architecture"], ["growth_system", "hooks", "content_units"], ["create_campaign_pack", "generate_content_batch"], ["revise_content_batch", "analyze_performance"], [], [], "strategist", "risk_reviewer", ["influence_architecture"], ["quality_score", "confidence_score", "influence_strength_score"], ["positioning_agent"], ["creative_director", "video_agent"]),
    ("growth_hacker", "docs/agents/growth/growth_hacker.md", ["growth_loop_design"], ["conversion_path_design", "experimentation_design"], ["growth_system", "growth_integration", "experimentation_plan"], ["calendar", "content_batch"], ["create_campaign_pack"], ["generate_content_batch", "analyze_performance"], [], [], "strategist", "risk_reviewer", ["growth_system"], ["quality_score", "confidence_score", "growth_loop_clarity_score"], ["influence_architect"], ["facebook_native_agent", "linkedin_native_agent"]),
    ("facebook_native_agent", "docs/agents/platform/facebook_native_agent.md", ["platform_strategy_facebook"], ["facebook_conversation_design"], ["facebook_strategy", "facebook_posts"], ["content_units", "calendar"], [], ["create_campaign_pack", "generate_content_batch", "generate_annual_calendar"], ["facebook"], [], "copywriter", "anti_banality_agent", ["facebook_strategy", "facebook_content_directions"], ["quality_score", "confidence_score", "platform_fit_score"], ["influence_architect"], ["linkedin_native_agent", "growth_hacker"]),
    ("linkedin_native_agent", "docs/agents/platform/linkedin_native_agent.md", ["platform_strategy_linkedin"], ["linkedin_authority_design"], ["linkedin_strategy", "linkedin_posts"], ["content_units", "calendar"], [], ["create_campaign_pack", "generate_content_batch", "generate_annual_calendar"], ["linkedin"], [], "copywriter", "anti_banality_agent", ["linkedin_strategy", "linkedin_content_directions"], ["quality_score", "confidence_score", "platform_fit_score"], ["influence_architect"], ["facebook_native_agent", "growth_hacker"]),
    ("calendar_architect", "docs/agents/planning/calendar_architect.md", ["calendar_architecture"], ["editorial_sequence_design", "intensity_planning"], ["annual_editorial_calendar", "editorial_calendar"], ["content_batch_guidance"], ["generate_annual_calendar", "generate_content_batch"], ["create_campaign_pack", "revise_content_batch"], [], [], "strategist", "anti_banality_agent", ["annual_editorial_calendar"], ["quality_score", "confidence_score", "calendar_coherence_score"], ["growth_hacker", "facebook_native_agent", "linkedin_native_agent"], ["creative_director"]),
    ("hook_master", "docs/agents/content/hook_master.md", ["hook_generation"], ["hook_scoring"], ["hooks"], ["content_units", "video_scripts"], ["generate_content_batch"], ["revise_content_batch", "generate_video_batch"], [], [], "copywriter", "anti_banality_agent", ["hook_set"], ["quality_score", "confidence_score", "attention_strength_score"], ["calendar_architect", "audience_psychologist"], ["creative_director", "video_agent"]),
    ("copywriter", "docs/agents/content/copywriter.md", ["persuasive_copywriting"], ["cta_design"], ["content_units"], ["visual_briefs", "video_captions"], ["generate_content_batch"], ["revise_content_batch", "generate_video_batch"], [], [], "strategist", "anti_banality_agent", ["content_units"], ["quality_score", "confidence_score", "persuasion_score"], ["hook_master", "platform_agents"], ["creative_director", "video_agent"]),
    ("creative_director", "docs/agents/creative/creative_director.md", ["creative_direction"], ["visual_brief_design", "carousel_concept_design"], ["visual_direction", "visual_briefs", "carousel_concepts"], ["content_batch", "video_plan"], [], ["create_campaign_pack", "generate_content_batch", "generate_visual_batch"], [], [], "", "anti_banality_agent", ["creative_direction"], ["quality_score", "confidence_score", "visual_clarity_score"], ["platform_agents"], ["video_agent", "copywriter"]),
    ("video_agent", "docs/agents/video/video_agent.md", ["video_strategy"], ["video_script_design"], ["video_strategy", "video_scripts"], ["content_batch"], ["generate_video_batch"], ["create_campaign_pack", "generate_content_batch"], [], [], "copywriter", "risk_reviewer", ["video_plan"], ["quality_score", "confidence_score", "retention_score"], ["platform_agents"], ["creative_director"]),
    ("experimentation_agent", "docs/agents/experimentation/experimentation_agent.md", ["experimentation_design"], ["ab_test_design", "learning_loop_design"], ["experimentation_plan"], ["growth_system", "performance_report"], [], ["create_campaign_pack", "generate_content_batch", "analyze_performance"], [], [], "growth_hacker", "performance_analyst", ["experimentation_plan"], ["quality_score", "confidence_score", "measurability_score"], ["growth_hacker"], ["hook_master", "creative_director"]),
    ("anti_banality_agent", "docs/agents/quality/anti_banality_agent.md", ["anti_banality_review"], ["quality_review", "over_sanitization_detection"], ["quality_review", "required_improvements"], ["final_readiness"], ["create_campaign_pack", "generate_content_batch"], ["generate_annual_calendar", "generate_video_batch"], [], [], "strategist", "", ["quality_review"], ["quality_score", "confidence_score", "critique_precision_score"], ["content_or_strategy_generated"], ["risk_reviewer"]),
    ("risk_reviewer", "docs/agents/risk/risk_reviewer.md", ["risk_review"], ["claim_review", "safer_alternative_design"], ["risk_review"], ["final_readiness"], [], ["create_campaign_pack", "generate_content_batch", "revise_content_batch", "generate_video_batch"], [], ["claims_present", "high_aggression_level", "sensitive_topic", "reputation_risk"], "", "", ["risk_review"], ["quality_score", "confidence_score", "risk_detection_score"], ["content_or_strategy_generated"], ["anti_banality_agent"]),
    ("performance_analyst", "docs/agents/analysis/performance_analyst.md", ["performance_analysis"], ["learning_loop", "agent_feedback"], ["performance_report", "learning_loop"], ["growth_system", "calendar_revision"], ["analyze_performance"], ["revise_content_batch", "generate_annual_calendar"], [], [], "", "strategist", ["performance_report"], ["quality_score", "confidence_score", "insight_quality_score"], ["performance_data_available"], ["risk_reviewer", "anti_banality_agent"]),
]


CAPABILITIES = {
    "intake_normalization": "transformer une demande brute en brief structure",
    "project_file_planning": "definir dossiers, fichiers et manifests",
    "strategic_diagnosis": "identifier le vrai probleme de communication",
    "audience_psychology": "identifier tensions, desirs, peurs, objections",
    "positioning_design": "formuler positionnement et croyance alternative",
    "influence_architecture": "designer le mouvement de perception",
    "growth_loop_design": "creer boucles growth et conversion paths",
    "platform_strategy_facebook": "adapter strategie a Facebook",
    "platform_strategy_linkedin": "adapter strategie a LinkedIn",
    "calendar_architecture": "construire calendrier editorial long terme",
    "hook_generation": "creer accroches",
    "persuasive_copywriting": "rediger contenus finaux",
    "creative_direction": "definir visuels, carrousels, assets",
    "video_strategy": "creer formats et scripts video",
    "experimentation_design": "definir tests A/B et hypotheses",
    "anti_banality_review": "detecter contenu faible, generique ou plat",
    "risk_review": "identifier risques reputation, claims, plateformes",
    "performance_analysis": "analyser resultats et proposer iterations",
    "final_arbitration": "trancher contradictions et livrer recommandation",
}


SCHEMA_KEYS = {
    "NormalizedBrief": ["normalized_brief"],
    "ProjectFilePlan": ["project_file_plan"],
    "StrategicDiagnosis": ["strategic_diagnosis"],
    "AudienceIntelligence": ["audience_intelligence"],
    "PositioningSystem": ["positioning", "message_system"],
    "InfluenceArchitecture": ["influence_architecture"],
    "GrowthSystem": ["growth_system"],
    "FacebookNativeStrategy": ["facebook_strategy", "facebook_content_directions"],
    "LinkedInNativeStrategy": ["linkedin_strategy", "linkedin_content_directions"],
    "AnnualEditorialCalendar": ["annual_editorial_calendar"],
    "HookSet": ["hook_set"],
    "ContentUnits": ["content_units"],
    "CreativeDirection": ["creative_direction"],
    "VideoPlan": ["video_plan"],
    "ExperimentationPlan": ["experimentation_plan"],
    "QualityReview": ["quality_review"],
    "RiskReview": ["risk_review"],
    "PerformanceReport": ["performance_report"],
}


INTENT_ROUTING = {
    "create_project_from_idea": {
        "required": ["intake_normalizer", "file_architect", "strategist", "audience_psychologist", "positioning_agent", "influence_architect", "growth_hacker", "facebook_native_agent", "linkedin_native_agent", "calendar_architect", "creative_director", "anti_banality_agent", "risk_reviewer"],
        "optional": ["video_agent", "experimentation_agent"],
    },
    "create_campaign_pack": {
        "required": ["strategist", "audience_psychologist", "positioning_agent", "influence_architect", "growth_hacker", "calendar_architect", "anti_banality_agent", "risk_reviewer"],
        "platform_required": {"facebook": ["facebook_native_agent"], "linkedin": ["linkedin_native_agent"]},
        "optional": ["creative_director", "video_agent", "experimentation_agent"],
    },
    "generate_annual_calendar": {
        "required": ["strategist", "audience_psychologist", "positioning_agent", "influence_architect", "growth_hacker", "calendar_architect"],
        "platform_required": {"facebook": ["facebook_native_agent"], "linkedin": ["linkedin_native_agent"]},
        "optional": ["creative_director", "video_agent", "anti_banality_agent"],
    },
    "generate_content_batch": {
        "required": ["strategist", "calendar_architect", "audience_psychologist", "hook_master", "copywriter", "anti_banality_agent"],
        "platform_required": {"facebook": ["facebook_native_agent"], "linkedin": ["linkedin_native_agent"]},
        "conditional": {
            "visual_policy_when_useful_or_required": ["creative_director"],
            "video_policy_when_useful_or_required": ["video_agent"],
            "growth_mechanism_present": ["growth_hacker"],
            "claims_or_high_risk": ["risk_reviewer"],
        },
    },
    "generate_video_batch": {
        "required": ["video_agent", "hook_master", "copywriter", "anti_banality_agent"],
        "platform_required": {"facebook": ["facebook_native_agent"], "linkedin": ["linkedin_native_agent"]},
        "optional": ["creative_director", "risk_reviewer", "experimentation_agent"],
    },
    "generate_visual_batch": {
        "required": ["creative_director", "anti_banality_agent"],
        "platform_required": {"facebook": ["facebook_native_agent"], "linkedin": ["linkedin_native_agent"]},
        "optional": ["risk_reviewer"],
    },
    "revise_content_batch": {
        "required": ["strategist", "copywriter", "anti_banality_agent"],
        "conditional": {"hooks_changed": ["hook_master"], "visuals_changed": ["creative_director"], "risk_changed": ["risk_reviewer"]},
    },
    "analyze_performance": {
        "required": ["performance_analyst", "strategist", "experimentation_agent"],
        "optional": ["growth_hacker", "audience_psychologist"],
    },
}


CONDITIONAL_RULES = {
    "creative_director": ["visual_policy != none", "content_format includes carousel", "visual_needed is true", "user requested images or carousels"],
    "video_agent": ["video_policy != none", "user_requested_video is true", "calendar_week.video_needed is true"],
    "growth_hacker": ["growth_mechanism required", "batch_goal includes comments", "batch_goal includes leads", "user asks for hacks or growth loops"],
    "risk_reviewer": ["claims_present", "risk_score > 5", "aggression_level == high", "sensitive_topic is true"],
    "experimentation_agent": ["ab_tests requested", "performance_analysis requested", "campaign_pack requires experiments"],
    "anti_banality_agent": ["artifact intended for final delivery", "batch or campaign pack needs final quality gate"],
}


SKIP_RULES = {
    "video_agent": ["video_policy == none", "no video deliverable expected"],
    "creative_director": ["visual_policy == none", "text_only batch confirmed"],
    "growth_hacker": ["pure formatting revision", "no growth mechanism needed"],
    "risk_reviewer": ["low risk", "no claims", "no sensitive topic"],
    "performance_analyst": ["no performance data available"],
}


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write_text(path, text):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text.rstrip() + "\n", encoding="ascii", newline="\n")


def write_json(path, data):
    write_text(path, json.dumps(data, indent=2, ensure_ascii=True))


def scalar(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    return json.dumps(str(value), ensure_ascii=True)


def to_yaml(obj, indent=0):
    sp = " " * indent
    if isinstance(obj, dict):
        out = []
        for key, value in obj.items():
            if isinstance(value, list) and not value:
                out.append(f"{sp}{key}: []")
                continue
            if isinstance(value, (dict, list)):
                out.append(f"{sp}{key}:")
                out.extend(to_yaml(value, indent + 2))
            else:
                out.append(f"{sp}{key}: {scalar(value)}")
        return out
    if isinstance(obj, list):
        if not obj:
            return [sp + "[]"]
        out = []
        for item in obj:
            if isinstance(item, (dict, list)):
                out.append(sp + "-")
                out.extend(to_yaml(item, indent + 2))
            else:
                out.append(f"{sp}- {scalar(item)}")
        return out
    return [sp + scalar(obj)]


def write_yaml(path, data):
    write_text(path, "\n".join(to_yaml(data)))


def extract_identity(text, key):
    match = re.search(r"^" + re.escape(key) + r":\s*(.+)$", text, re.M)
    return match.group(1).strip().strip('"') if match else ""


def extract_block_list(text, key):
    match = re.search(r"^" + re.escape(key) + r":\s*\n((?:\s+- .+\n)+)", text, re.M)
    if not match:
        return []
    return [line.strip()[2:].strip() for line in match.group(1).splitlines() if line.strip().startswith("- ")]


def section(text, start, end):
    match = re.search(start, text, re.S)
    if not match:
        return ""
    tail = text[match.end():]
    stop = re.search(end, tail, re.S)
    return tail[:stop.start()] if stop else tail


def clean(text):
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    return re.sub(r"\s+", " ", text).strip()


def extract_mission(text):
    body = section(text, r"## 2\. Mission\s*", r"\n## 3\.")
    question = ""
    q = re.search(r">\s*(.+)", body)
    if q:
        question = q.group(1).strip()
    statement = clean(body.split("Question centrale")[0])
    success = ""
    s = re.search(r"Definition du succes\s*:\s*(.*)", body, re.S)
    if s:
        success = clean(s.group(1))
    return statement, question, success


def extract_schema_name(text):
    match = re.search(r"Nom du schema\s*:\s*\n\s*```text\s*\n([^\n]+)", text, re.S)
    return match.group(1).strip() if match else ""


def extract_prompt(text):
    body = section(text, r"## 12\. Prompt Systeme Draft\s*", r"\n## 13\.")
    match = re.search(r"```text\s*\n(.*?)\n```", body, re.S)
    return match.group(1).strip() if match else ""


def extract_execution(text):
    modes = extract_block_list(text, "supported_modes")

    def one(name, default=""):
        match = re.search(r"^\s*" + re.escape(name) + r":\s*(.+)$", text, re.M)
        return match.group(1).strip().strip('"') if match else default

    def number(name, default):
        value = one(name, "")
        return int(value) if value.isdigit() else default

    return {
        "supported_modes": modes,
        "default_mode": one("default_mode", "deep_work"),
        "max_iterations": number("max_iterations", 3),
        "timeout_seconds": number("timeout_seconds", 150),
        "max_tool_calls": number("max_tool_calls", 8),
        "context_budget": one("context_budget", "medium"),
        "cost_tier": one("cost_tier", "standard"),
        "parallel_safe": one("parallel_safe", "false").lower() == "true",
    }


def build_agent(row):
    agent_id, path, primary, secondary, owns, contributes, required_for, optional_for, platforms, required_when, fallback, reviewer, required_sections, quality_fields, after, parallel = row
    text = read(path)
    mission, question, success = extract_mission(text)
    schema_name = extract_schema_name(text)
    return {
        "identity": {
            "agent_id": agent_id,
            "name": extract_identity(text, "name") or agent_id,
            "version": extract_identity(text, "version") or "0.1.0",
            "status": extract_identity(text, "status") or "draft",
            "type": extract_identity(text, "type"),
            "owner_domain": extract_identity(text, "owner_domain"),
        },
        "source": {
            "blueprint_path": path,
            "prompt_path": f"registry/prompts/{agent_id}.system.txt",
            "schema_path": f"registry/schemas/{schema_name}.schema.json",
            "eval_path": f"registry/evals/{agent_id}.eval.yaml",
            "examples_path": "",
            "changelog_path": path,
        },
        "purpose": {
            "mission": mission,
            "primary_question": question,
            "success_definition": success,
        },
        "capabilities": {
            "primary": primary,
            "secondary": secondary,
            "forbidden": ["direct_publishing", "fake_proof_generation", "fake_engagement_generation"],
        },
        "ownership": {
            "owns_sections": owns,
            "contributes_to_sections": contributes,
            "does_not_own": ["publication_directe", "validation_humaine_finale"],
        },
        "inputs": {
            "required": extract_block_list(text, "required_inputs"),
            "optional": extract_block_list(text, "optional_inputs"),
            "context_requirements": ["context_snapshot", "project_manifest_if_available"],
            "missing_input_behavior": ["mark_assumptions", "lower_confidence_score", "ask_user_if_blocking"],
        },
        "outputs": {
            "produced_artifacts": required_sections,
            "schema_name": schema_name,
            "required_sections": required_sections,
            "quality_fields": quality_fields,
        },
        "routing": {
            "required_for_intents": required_for,
            "optional_for_intents": optional_for,
            "required_for_platforms": platforms,
            "required_when": required_when,
            "activation_rules": CONDITIONAL_RULES.get(agent_id, []),
            "skip_rules": SKIP_RULES.get(agent_id, []),
            "fallback_agent_id": fallback,
        },
        "execution": extract_execution(text),
        "tools": {
            "allowed": extract_block_list(text, "allowed_tools"),
            "forbidden": extract_block_list(text, "forbidden_tools"),
            "usage_rules": ["follow_agent_blueprint", "do_not_write_final_files_directly", "do_not_publish_directly"],
        },
        "memory": {
            "reads": extract_block_list(text, "reads"),
            "writes": extract_block_list(text, "writes"),
            "never_store": extract_block_list(text, "never_store"),
        },
        "dependencies": {
            "requires_before": [],
            "should_run_after": after,
            "can_run_parallel_with": parallel,
            "conflicts_with": [],
        },
        "quality": {
            "minimum_quality_score": 8,
            "minimum_confidence_score": 7,
            "rejection_conditions": ["output_schema_invalid", "handoff_unusable", "fake_proof_or_fake_signal"],
            "review_agent_id": reviewer,
        },
        "guardrails": {
            "global": ["no_fake_proof", "no_fake_numbers", "no_fake_testimonials", "no_spam", "no_direct_publishing", "preserve_clean_intensity"],
            "domain_specific": ["respect_source_spec", "mark_hypotheses", "preserve_offensive_clean_version_when_valid"],
            "red_flags": ["unsupported_claims", "sensitive_personal_data", "platform_abuse", "over_sanitized_output"],
        },
        "observability": {
            "trace_fields": extract_block_list(text, "trace_fields") or ["agent_id", "version", "job_id", "project_slug", "quality_score", "confidence_score"],
            "metrics": extract_block_list(text, "metrics") or ["runs_count", "revision_rate", "quality_score_average"],
        },
        "versioning": {
            "current": extract_identity(text, "current") or "0.1.0",
            "compatible_output_versions": extract_block_list(text, "compatible_output_versions"),
            "deprecated_by": "",
            "changelog": [{"version": "0.1.0", "date": DATE, "changes": ["registry_entry_created_from_human_spec"]}],
        },
        "_prompt": extract_prompt(text),
        "_schema_name": schema_name,
        "_eval_focus": "verifier que l agent respecte son territoire, son schema et ses garde-fous",
    }


def build_schema(schema_name, keys, agent_id):
    props = {key: {"type": "object", "additionalProperties": True} for key in keys}
    props["self_evaluation"] = {
        "type": "object",
        "additionalProperties": True,
        "properties": {
            "quality_score": {"type": "integer", "minimum": 0, "maximum": 10},
            "confidence_score": {"type": "integer", "minimum": 0, "maximum": 10},
            "weakest_point": {"type": "string"},
            "next_improvement": {"type": "string"},
        },
    }
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": f"https://crew-system.local/schemas/{schema_name}.schema.json",
        "title": schema_name,
        "type": "object",
        "additionalProperties": True,
        "required": keys,
        "properties": props,
        "x-agent-id": agent_id,
        "x-status": "draft",
        "x-notes": "Minimal runtime binding schema. Human source spec remains authoritative until strict schemas are implemented.",
    }


def main():
    entries = []
    for row in AGENTS:
        entries.append(build_agent(row))

    write_text("registry/README.md", """# Agent Machine Registry - Crew_System

Ce dossier contient la premiere couche machine du registre agentique.

Il transforme les specs humaines dans `docs/agents/` en fichiers chargeables par le futur runtime.

Structure :

```text
registry/
  manifest.yaml
  agents/
    agents_index.json
    *.yaml
  prompts/
    *.system.txt
  schemas/
    *.schema.json
  routing/
    capabilities.yaml
    dependencies.yaml
    intents.yaml
    quality_gates.yaml
  evals/
    *.eval.yaml
```

Statut actuel : `draft`.

Les agents sont declares et routables, mais ils ne doivent pas etre consideres comme `active` tant que le loader runtime, les validateurs de schema et les evals executables ne sont pas implementes.
""")

    write_yaml("registry/manifest.yaml", {
        "agent_registry": {
            "registry_id": "crew_system_agent_registry",
            "version": REGISTRY_VERSION,
            "schema_version": SCHEMA_VERSION,
            "created_at": DATE,
            "updated_at": DATE,
            "default_language": "fr",
            "agents_root": "registry/agents",
            "schemas_root": "registry/schemas",
            "prompts_root": "registry/prompts",
            "evals_root": "registry/evals",
            "routing_root": "registry/routing",
            "active_agents": [],
            "draft_agents": [entry["identity"]["agent_id"] for entry in entries],
            "disabled_agents": [],
            "deprecated_agents": [],
            "notes": "All agents remain draft until runtime loader, schema validators, and executable evals exist.",
        }
    })

    write_json("registry/agents/agents_index.json", {
        "registry_id": "crew_system_agent_registry",
        "version": REGISTRY_VERSION,
        "agents": [
            {
                "agent_id": entry["identity"]["agent_id"],
                "name": entry["identity"]["name"],
                "status": entry["identity"]["status"],
                "type": entry["identity"]["type"],
                "owner_domain": entry["identity"]["owner_domain"],
                "capabilities": entry["capabilities"]["primary"],
                "schema_name": entry["outputs"]["schema_name"],
                "entry_path": f"registry/agents/{entry['identity']['agent_id']}.yaml",
                "prompt_path": entry["source"]["prompt_path"],
                "schema_path": entry["source"]["schema_path"],
                "eval_path": entry["source"]["eval_path"],
            }
            for entry in entries
        ],
    })

    for entry in entries:
        agent_id = entry["identity"]["agent_id"]
        schema_name = entry.pop("_schema_name")
        prompt = entry.pop("_prompt")
        entry.pop("_eval_focus")
        write_yaml(f"registry/agents/{agent_id}.yaml", {"agent_registry_entry": entry})
        write_text(f"registry/prompts/{agent_id}.system.txt", prompt or f"Tu es {entry['identity']['name']}.\n\nProduis une sortie conforme au schema {schema_name}.")
        schema_keys = SCHEMA_KEYS.get(schema_name, entry["outputs"]["required_sections"])
        write_json(f"registry/schemas/{schema_name}.schema.json", build_schema(schema_name, schema_keys, agent_id))
        write_yaml(f"registry/evals/{agent_id}.eval.yaml", {
            "agent_eval": {
                "agent_id": agent_id,
                "version": entry["identity"]["version"],
                "status": "draft",
                "source_spec": entry["source"]["blueprint_path"],
                "target_schema": schema_name,
                "must_pass": ["output_schema_valid", "quality_score_present", "confidence_score_present", "handoff_usable", "no_fake_proof", "no_direct_publishing"],
                "target_scores": {"quality_score_min": 8, "confidence_score_min": 7},
                "cases": [
                    {"case_id": f"{agent_id}_golden_001", "type": "golden", "description": "verifier la capacite principale et le respect du schema", "expected_capabilities": entry["capabilities"]["primary"]},
                    {"case_id": f"{agent_id}_risk_001", "type": "safety", "description": "detecter preuves inventees, faux signaux, spam ou sortie non exploitable", "expected_capabilities": ["risk_awareness", "schema_discipline"]},
                ],
            }
        })

    write_yaml("registry/routing/capabilities.yaml", {"capability_taxonomy": CAPABILITIES})
    write_yaml("registry/routing/intents.yaml", {
        "intent_routing": INTENT_ROUTING,
        "platform_routing": {
            "facebook": {"required_agent": "facebook_native_agent", "required_context": ["platforms/facebook_strategy.md"]},
            "linkedin": {"required_agent": "linkedin_native_agent", "required_context": ["platforms/linkedin_strategy.md"]},
        },
        "conditional_activation_rules": CONDITIONAL_RULES,
        "skip_rules": SKIP_RULES,
    })
    write_yaml("registry/routing/dependencies.yaml", {
        "dependency_rules": {
            entry["identity"]["agent_id"]: {"should_run_after": entry["dependencies"]["should_run_after"]}
            for entry in entries
            if entry["dependencies"]["should_run_after"]
        },
        "parallel_safe_groups": [
            ["facebook_native_agent", "linkedin_native_agent"],
            ["creative_director", "video_agent"],
            ["hook_master_by_angle_group"],
            ["copywriter_by_content_group"],
            ["anti_banality_agent", "risk_reviewer"],
        ],
        "conflict_policy": {
            "same_section_owner": "un seul owner, autres contributeurs",
            "strategic_conflict": "strategist final arbitration while preserving clean intensity",
            "schema_conflict": "reject output and retry",
            "missing_context": "context loader or ask user",
            "version_conflict": "use registry active version",
        },
    })
    write_yaml("registry/routing/quality_gates.yaml", {
        "quality_gates": {
            "schema_gate": {"purpose": "verifier que la sortie respecte le schema lie a l agent", "required": True},
            "context_gate": {"purpose": "verifier que les inputs requis sont disponibles ou marques comme hypotheses", "required": True},
            "strategic_alignment_gate": {"purpose": "verifier coherence avec positionnement et calendrier", "required": True},
            "intensity_preservation_gate": {"purpose": "verifier que les revisions ne neutralisent pas psychologie, influence ou growth", "required": True},
            "anti_banality_gate": {"purpose": "rejeter les sorties generiques ou trop lissees", "required": True},
            "risk_gate": {"purpose": "detecter faux claims, preuves faibles, tactiques interdites et risques non assumes", "required": True},
            "handoff_gate": {"purpose": "verifier que la sortie peut etre utilisee par l agent suivant", "required": True},
        },
        "minimum_scores": {"quality_score": 8, "confidence_score": 7},
        "failure_policy": {
            "schema_invalid": "retry_or_revise",
            "context_missing": "ask_user_or_stop",
            "output_generic": "revise_with_anti_banality_agent",
            "output_over_sanitized": "restore_clean_intensity",
            "risk_high": "send_to_risk_reviewer",
            "fake_proof_or_fake_signal": "reject_output",
        },
    })

    print(f"generated_agents={len(entries)}")


if __name__ == "__main__":
    main()
