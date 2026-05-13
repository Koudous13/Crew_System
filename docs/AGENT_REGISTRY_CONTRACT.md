# Agent Registry Contract - Crew_System

## 1. Role Du Document

Ce document definit le registre des agents de Crew_System.

Le `AGENT_BLUEPRINT.md` definit comment un agent doit etre structure.
Le `RUNTIME_ORCHESTRATION_CONTRACT.md` definit comment le systeme orchestre.
Ce contrat definit comment le runtime sait quels agents existent, ce qu'ils savent faire, quand les lancer, comment les versionner et comment verifier qu'ils sont compatibles avec un job.

Question centrale :

> Comment le runtime choisit-il les bons agents sans hardcoder une liste fragile ni lancer tout le monde tout le temps ?

Le registre d'agents est la source de verite pour :

- agent_id ;
- versions ;
- statuts ;
- capacites ;
- inputs ;
- outputs ;
- schemas ;
- outils ;
- memoire ;
- cout ;
- limites ;
- qualite ;
- dependances ;
- routage ;
- fallback ;
- evaluation.

## 2. Principes Non Negociables

### 2.1 Aucun Agent Hors Registre

Le runtime ne doit pas lancer un agent absent du registre.

Si un agent est absent :

- le job doit echouer proprement ;
- ou utiliser un fallback declare ;
- ou demander une decision utilisateur si le manque bloque le livrable.

### 2.2 Le Registre Ne Remplace Pas Le Blueprint

Le registre reference les agents.
Il ne doit pas contenir des prompts complets enormes.

Le registre doit pointer vers :

- fiche agent ;
- prompt systeme ;
- schemas ;
- evaluations ;
- exemples ;
- changelog.

### 2.3 Capacite Avant Persona

Le runtime choisit un agent pour une capacite, pas pour un nom stylise.

Mauvais :

```text
Lancer "Genius Marketing Wizard" parce que le nom sonne bien.
```

Bon :

```text
Lancer `growth_hacker` parce que le job requiert `growth_loop_design` et `conversion_path_design`.
```

### 2.4 Statut Obligatoire

Chaque agent doit avoir un statut.

```yaml
agent_status:
  draft: "defini mais pas encore utilisable en production"
  active: "utilisable par le runtime"
  experimental: "utilisable seulement si demande ou en mode test"
  deprecated: "remplace mais encore disponible pour compatibilite"
  disabled: "ne doit pas etre lance"
```

Regle :

Le runtime ne lance par defaut que les agents `active`.

### 2.5 Versioning Strict

Changer un agent peut changer les outputs.

Regles :

- patch : correction sans changement de schema ;
- minor : nouvelle capacite compatible ;
- major : changement de schema ou comportement majeur ;
- toute version doit avoir un changelog.

### 2.6 Le Runtime Doit Pouvoir Expliquer Le Routage

Pour chaque agent lance, le runtime doit pouvoir dire :

- pourquoi il l'a lance ;
- quelle capacite etait requise ;
- quel input il a recu ;
- quel output il a produit ;
- quel score il a obtenu.

## 3. Emplacement Du Registre

Dans la future implementation, le registre pourra exister dans deux couches.

### 3.1 Registre Source Dans Le Repo

Pour les definitions versionnees avec le code :

```text
registry/
  agents/
    agents_index.json
    strategist.yaml
    audience_psychologist.yaml
    growth_hacker.yaml
  schemas/
  prompts/
  evals/
```

### 3.2 Registre Runtime Dans Le Workspace

Pour l'index operationnel :

```text
workspace/
  global_registry/
    agents_index.json
    agents_runtime_state.json
    agent_eval_scores.json
```

Regle :

- le registre source definit ce qui existe ;
- le registre runtime peut stocker l'etat, les scores et les overrides ;
- le registre runtime ne doit pas inventer un agent absent du registre source.

## 4. Registry Manifest

Le registre doit avoir un manifest.

```yaml
agent_registry:
  registry_id: string
  version: string
  schema_version: string
  created_at: string
  updated_at: string
  default_language: string
  agents_root: string
  schemas_root: string
  prompts_root: string
  evals_root: string
  active_agents: list[string]
  disabled_agents: list[string]
  deprecated_agents: list[string]
```

Le manifest permet au runtime de savoir :

- quels agents charger ;
- quelle version du registre utiliser ;
- quels agents sont disponibles ;
- quels agents ne doivent plus etre lances.

## 5. Agent Registry Entry

Chaque agent doit avoir une entree de registre.

```yaml
agent_registry_entry:
  identity:
    agent_id: string
    name: string
    version: string
    status: draft | active | experimental | deprecated | disabled
    type: strategist | analyst | creator | critic | optimizer | orchestrator | reviewer | utility
    owner_domain: string

  source:
    blueprint_path: string
    prompt_path: string
    schema_path: string
    eval_path: string
    examples_path: string
    changelog_path: string

  purpose:
    mission: string
    primary_question: string
    success_definition: string

  capabilities:
    primary: list[string]
    secondary: list[string]
    forbidden: list[string]

  ownership:
    owns_sections: list[string]
    contributes_to_sections: list[string]
    does_not_own: list[string]

  inputs:
    required: list[string]
    optional: list[string]
    context_requirements: list[string]
    missing_input_behavior: list[string]

  outputs:
    produced_artifacts: list[string]
    schema_name: string
    required_sections: list[string]
    quality_fields: list[string]

  routing:
    required_for_intents: list[string]
    optional_for_intents: list[string]
    activation_rules: list[string]
    skip_rules: list[string]
    fallback_agent_id: string

  execution:
    supported_modes: list[draft | deep_work | critic | revision | benchmark]
    default_mode: string
    max_iterations: int
    timeout_seconds: int
    max_tool_calls: int
    cost_tier: low | standard | high
    parallel_safe: boolean

  tools:
    allowed: list[string]
    forbidden: list[string]
    usage_rules: list[string]

  memory:
    reads: list[string]
    writes: list[string]
    never_store: list[string]

  dependencies:
    requires_before: list[string]
    should_run_after: list[string]
    can_run_parallel_with: list[string]
    conflicts_with: list[string]

  quality:
    minimum_quality_score: int
    minimum_confidence_score: int
    rejection_conditions: list[string]
    review_agent_id: string

  guardrails:
    global: list[string]
    domain_specific: list[string]
    red_flags: list[string]

  observability:
    trace_fields: list[string]
    metrics: list[string]

  versioning:
    current: string
    compatible_output_versions: list[string]
    deprecated_by: string
    changelog: list[object]
```

## 6. Capacite Taxonomy

Le registre doit utiliser des capacites normalisees.

```yaml
capabilities:
  intake_normalization: "transformer une demande brute en brief structure"
  project_file_planning: "definir dossiers, fichiers et manifests"
  strategic_diagnosis: "identifier le vrai probleme de communication"
  audience_psychology: "identifier tensions, desirs, peurs, objections"
  positioning_design: "formuler positionnement et croyance alternative"
  influence_architecture: "designer le mouvement de perception"
  growth_loop_design: "creer boucles growth et conversion paths"
  platform_strategy_facebook: "adapter strategie a Facebook"
  platform_strategy_linkedin: "adapter strategie a LinkedIn"
  calendar_architecture: "construire calendrier editorial long terme"
  hook_generation: "creer accroches"
  persuasive_copywriting: "rediger contenus finaux"
  creative_direction: "definir visuels, carrousels, assets"
  video_strategy: "creer formats et scripts video"
  experimentation_design: "definir tests A/B et hypotheses"
  anti_banality_review: "detecter contenu faible, generique ou plat"
  risk_review: "identifier risques reputational, claims, plateformes"
  performance_analysis: "analyser resultats et proposer iterations"
  final_arbitration: "trancher contradictions et livrer recommandation"
```

Regle :

Une capacite doit etre precise, testable et utile au routage.

## 7. Core Agent Catalog

Le systeme initial doit prevoir ces agents.

### 7.1 intake_normalizer

```yaml
agent_id: intake_normalizer
type: utility
primary_capabilities:
  - intake_normalization
owns_sections:
  - normalized_brief
required_for_intents:
  - create_project_from_idea
  - create_campaign_pack
```

Role :
Transformer une demande brute en brief structure.

### 7.2 file_architect

```yaml
agent_id: file_architect
type: utility
primary_capabilities:
  - project_file_planning
owns_sections:
  - project_file_plan
required_for_intents:
  - create_project_from_idea
  - create_campaign_pack
```

Role :
Definir les fichiers et dossiers a creer selon `PROJECT_FILE_SYSTEM_CONTRACT.md`.

### 7.3 strategist

```yaml
agent_id: strategist
type: strategist
primary_capabilities:
  - strategic_diagnosis
  - final_arbitration
owns_sections:
  - strategic_diagnosis
  - big_idea
  - final_recommendation
required_for_intents:
  - create_campaign_pack
  - generate_content_batch
```

Role :
Diriger la coherence globale et arbitrer les decisions strategiques.

### 7.4 audience_psychologist

```yaml
agent_id: audience_psychologist
type: analyst
primary_capabilities:
  - audience_psychology
owns_sections:
  - audience_intelligence
  - emotional_tension
required_for_intents:
  - create_campaign_pack
  - generate_content_batch
```

Role :
Identifier tensions, croyances, peurs, ambitions et langage de l'audience.

### 7.5 positioning_agent

```yaml
agent_id: positioning_agent
type: strategist
primary_capabilities:
  - positioning_design
owns_sections:
  - positioning
  - message_system
required_for_intents:
  - create_campaign_pack
```

Role :
Transformer l'offre en position differenciante.

### 7.6 influence_architect

```yaml
agent_id: influence_architect
type: strategist
primary_capabilities:
  - influence_architecture
owns_sections:
  - influence_architecture
required_for_intents:
  - create_campaign_pack
  - generate_content_batch
```

Role :
Designer la manipulation de perception par cadrage, tension, preuve et desir.

### 7.7 growth_hacker

```yaml
agent_id: growth_hacker
type: optimizer
primary_capabilities:
  - growth_loop_design
owns_sections:
  - growth_system
  - growth_integration
  - experimentation_plan
required_for_intents:
  - create_campaign_pack
optional_for_intents:
  - generate_content_batch
```

Role :
Creer les boucles d'attention, commentaires, ressources, conversations et conversions.

### 7.8 facebook_native_agent

```yaml
agent_id: facebook_native_agent
type: creator
primary_capabilities:
  - platform_strategy_facebook
owns_sections:
  - facebook_strategy
  - facebook_posts
required_for_platforms:
  - facebook
```

Role :
Adapter strategie et contenus a Facebook.

### 7.9 linkedin_native_agent

```yaml
agent_id: linkedin_native_agent
type: creator
primary_capabilities:
  - platform_strategy_linkedin
owns_sections:
  - linkedin_strategy
  - linkedin_posts
required_for_platforms:
  - linkedin
```

Role :
Adapter strategie et contenus a LinkedIn.

### 7.10 calendar_architect

```yaml
agent_id: calendar_architect
type: orchestrator
primary_capabilities:
  - calendar_architecture
owns_sections:
  - annual_editorial_calendar
  - editorial_calendar
required_for_intents:
  - generate_annual_calendar
  - generate_content_batch
```

Role :
Construire et exploiter la sequence editoriale.

### 7.11 hook_master

```yaml
agent_id: hook_master
type: creator
primary_capabilities:
  - hook_generation
owns_sections:
  - hooks
required_for_intents:
  - generate_content_batch
```

Role :
Creer et scorer les accroches.

### 7.12 copywriter

```yaml
agent_id: copywriter
type: creator
primary_capabilities:
  - persuasive_copywriting
owns_sections:
  - content_units
required_for_intents:
  - generate_content_batch
```

Role :
Rediger les contenus finaux selon la plateforme et la strategie.

### 7.13 creative_director

```yaml
agent_id: creative_director
type: creator
primary_capabilities:
  - creative_direction
owns_sections:
  - visual_direction
  - visual_briefs
  - carousel_concepts
optional_for_intents:
  - create_campaign_pack
  - generate_content_batch
```

Role :
Decider si et comment un visuel sert la strategie.

### 7.14 video_agent

```yaml
agent_id: video_agent
type: creator
primary_capabilities:
  - video_strategy
owns_sections:
  - video_strategy
  - video_scripts
optional_for_intents:
  - create_campaign_pack
  - generate_video_batch
  - generate_content_batch
```

Role :
Prevoir ou produire les videos, hooks 3 secondes, scripts et miniatures.

### 7.15 experimentation_agent

```yaml
agent_id: experimentation_agent
type: optimizer
primary_capabilities:
  - experimentation_design
owns_sections:
  - experimentation_plan
optional_for_intents:
  - create_campaign_pack
  - generate_content_batch
  - analyze_performance
```

Role :
Transformer une strategie en hypotheses testables.

### 7.16 anti_banality_agent

```yaml
agent_id: anti_banality_agent
type: critic
primary_capabilities:
  - anti_banality_review
owns_sections:
  - quality_review
  - required_improvements
required_for_intents:
  - create_campaign_pack
  - generate_content_batch
```

Role :
Rejeter le contenu faible, generique ou trop IA.

### 7.17 risk_reviewer

```yaml
agent_id: risk_reviewer
type: reviewer
primary_capabilities:
  - risk_review
owns_sections:
  - risk_review
required_when:
  - claims_present
  - high_aggression_level
  - sensitive_topic
  - reputation_risk
```

Role :
Identifier les risques de promesse, preuve, reputation et plateforme.

### 7.18 performance_analyst

```yaml
agent_id: performance_analyst
type: analyst
primary_capabilities:
  - performance_analysis
owns_sections:
  - performance_report
  - learning_loop
required_for_intents:
  - analyze_performance
```

Role :
Interpreter les resultats et nourrir la prochaine iteration.

## 8. Intent To Agent Routing

Le runtime doit router par intent.

### 8.1 create_project_from_idea

Agents requis :

```yaml
required:
  - intake_normalizer
  - file_architect
  - strategist
  - audience_psychologist
  - positioning_agent
  - influence_architect
  - growth_hacker
  - facebook_native_agent
  - linkedin_native_agent
  - calendar_architect
  - creative_director
  - anti_banality_agent
  - risk_reviewer
optional:
  - video_agent
  - experimentation_agent
```

### 8.2 create_campaign_pack

Agents requis :

```yaml
required:
  - strategist
  - audience_psychologist
  - positioning_agent
  - influence_architect
  - growth_hacker
  - calendar_architect
  - anti_banality_agent
  - risk_reviewer
platform_required:
  facebook:
    - facebook_native_agent
  linkedin:
    - linkedin_native_agent
optional:
  - creative_director
  - video_agent
  - experimentation_agent
```

### 8.3 generate_content_batch

Agents requis :

```yaml
required:
  - strategist
  - calendar_architect
  - audience_psychologist
  - hook_master
  - copywriter
  - anti_banality_agent
platform_required:
  facebook:
    - facebook_native_agent
  linkedin:
    - linkedin_native_agent
conditional:
  visual_policy_when_useful_or_required:
    - creative_director
  video_policy_when_useful_or_required:
    - video_agent
  growth_mechanism_present:
    - growth_hacker
  claims_or_high_risk:
    - risk_reviewer
```

### 8.4 revise_content_batch

Agents requis selon scope :

```yaml
required:
  - strategist
  - copywriter
  - anti_banality_agent
conditional:
  hooks_changed:
    - hook_master
  visuals_changed:
    - creative_director
  risk_changed:
    - risk_reviewer
```

### 8.5 analyze_performance

Agents requis :

```yaml
required:
  - performance_analyst
  - strategist
  - experimentation_agent
optional:
  - growth_hacker
  - audience_psychologist
```

## 9. Platform Routing

Le runtime doit ajouter automatiquement les agents plateforme.

```yaml
platform_routing:
  facebook:
    required_agent: facebook_native_agent
    required_context:
      - platforms/facebook_strategy.md
  linkedin:
    required_agent: linkedin_native_agent
    required_context:
      - platforms/linkedin_strategy.md
```

Regle :

Un batch cross-platform doit lancer les deux agents plateforme.
Un agent plateforme ne doit pas ecrire la strategie de l'autre plateforme.

## 10. Conditional Activation Rules

```yaml
conditional_activation_rules:
  creative_director:
    activate_if:
      - visual_policy != none
      - content_format includes carousel
      - visual_needed is true
  video_agent:
    activate_if:
      - video_policy != none
      - user_requested_video is true
      - calendar_week.video_needed is true
  growth_hacker:
    activate_if:
      - growth_mechanism required
      - batch_goal includes comments
      - batch_goal includes leads
      - user asks for hacks or growth loops
  risk_reviewer:
    activate_if:
      - claims_present
      - risk_score > 5
      - aggression_level == high
      - sensitive_topic is true
  experimentation_agent:
    activate_if:
      - ab_tests requested
      - performance_analysis requested
      - campaign_pack requires experiments
```

## 11. Skip Rules

Le runtime doit pouvoir ignorer un agent.

```yaml
skip_rules:
  video_agent:
    skip_if:
      - video_policy == none
      - no video deliverable expected
  creative_director:
    skip_if:
      - visual_policy == none
      - text_only batch confirmed
  growth_hacker:
    skip_if:
      - pure formatting revision
      - no growth mechanism needed
  risk_reviewer:
    skip_if:
      - low risk
      - no claims
      - no sensitive topic
```

Un skip doit etre logge avec raison.

## 12. Agent Dependency Rules

```yaml
dependency_rules:
  audience_psychologist:
    should_run_after:
      - strategist
  positioning_agent:
    should_run_after:
      - audience_psychologist
  influence_architect:
    should_run_after:
      - positioning_agent
  growth_hacker:
    should_run_after:
      - influence_architect
  calendar_architect:
    should_run_after:
      - growth_hacker
      - platform_agents
  hook_master:
    should_run_after:
      - calendar_architect
      - audience_psychologist
  copywriter:
    should_run_after:
      - hook_master
      - platform_agents
  anti_banality_agent:
    should_run_after:
      - copywriter
  risk_reviewer:
    should_run_after:
      - content_or_strategy_generated
```

Parallelisation possible :

```yaml
parallel_safe_groups:
  - [facebook_native_agent, linkedin_native_agent]
  - [creative_director, video_agent]
  - [hook_master_by_angle_group]
  - [copywriter_by_content_group]
  - [anti_banality_agent, risk_reviewer]
```

## 13. Handoff Contract

Chaque agent doit produire un handoff utilisable.

```yaml
handoff:
  from_agent_id: string
  to_agent_ids: list[string]
  artifact_id: string
  summary: string
  key_decisions: list[string]
  assumptions: list[string]
  risk_flags: list[string]
  confidence_score: int
  required_next_actions: list[string]
```

Regles :

- un handoff doit etre court ;
- il doit indiquer ce qui est utilisable ;
- il doit signaler les points faibles ;
- il doit eviter de transmettre du bruit.

## 14. Agent Context Package

Le runtime doit donner a chaque agent un contexte limite.

```yaml
agent_context_package:
  job_id: string
  agent_id: string
  intent_type: string
  project_slug: string
  task_goal: string
  required_output_schema: string
  relevant_files:
    - path: string
      role: string
      summary: string
  upstream_outputs:
    - artifact_id: string
      agent_id: string
      summary: string
  constraints: list[string]
  guardrails: list[string]
  quality_threshold: int
```

Regle :

Le runtime ne doit pas envoyer tout le projet a chaque agent.
Il doit envoyer ce qui sert la mission de l'agent.

## 15. Output Schema Binding

Chaque agent doit declarer son schema de sortie.

```yaml
schema_binding:
  agent_id: string
  output_schema_name: string
  output_schema_version: string
  validates_against: string
  compatible_with_artifact_types: list[string]
```

Si le schema change :

- version major si breaking ;
- mettre a jour le registre ;
- mettre a jour les tests ;
- verifier compatibilite runtime.

## 16. Tool Policy

Le registre doit declarer les outils.

```yaml
tool_policy:
  agent_id: string
  allowed_tools: list[string]
  forbidden_tools: list[string]
  max_tool_calls: int
  tool_use_required: boolean
  failure_behavior: continue_with_assumption | stop | ask_user | fallback
```

Regles :

- aucun agent ne doit avoir acces a un outil inutile ;
- publication directe interdite dans cette phase du produit ;
- outils de fichier final reserves au runtime/File Writer ;
- agents peuvent proposer fichiers, pas les ecrire directement.

## 17. Memory Policy

Chaque agent doit declarer sa relation a la memoire.

```yaml
memory_policy:
  agent_id: string
  reads:
    - brand_memory
    - audience_memory
    - performance_memory
  writes:
    - decision_memory
    - learning_candidates
  never_store:
    - secrets
    - personal_sensitive_data
    - unverified_claims_as_facts
```

Regle :

Les agents ne doivent pas ecrire directement dans la memoire durable.
Ils proposent des updates, le runtime les valide et les ecrit.

## 18. Quality And Evaluation

Chaque entree du registre doit avoir des seuils.

```yaml
quality_contract:
  agent_id: string
  minimum_quality_score: int
  minimum_confidence_score: int
  must_pass:
    - output_schema_valid
    - no_fake_proof
    - handoff_usable
  eval_cases:
    - case_id: string
      expected_capabilities: list[string]
```

Regles :

- un agent sous seuil doit etre relance, revu ou ignore ;
- un agent qui echoue souvent doit passer `experimental` ou `disabled` ;
- les scores doivent alimenter `agent_eval_scores.json`.

## 19. Fallback Policy

Fallbacks possibles :

```yaml
fallback_policy:
  agent_id: string
  fallback_agent_id: string
  fallback_mode: reduced_scope | simpler_output | ask_user | stop_job
  allowed_for_intents: list[string]
```

Exemples :

- si `video_agent` indisponible : produire seulement `video_opportunities.md` ;
- si `risk_reviewer` indisponible sur contenu risque : arreter ou demander utilisateur ;
- si `hook_master` echoue : relancer en mode revision ou utiliser copywriter avec gate renforce.

## 20. Conflict Policy

Conflits possibles :

- deux agents revendiquent la meme section ;
- un agent contredit le positionnement ;
- un agent produit un output hors schema ;
- un agent demande un fichier absent ;
- deux versions d'un agent sont actives.

Resolution :

```yaml
conflict_policy:
  same_section_owner: "un seul owner, autres contributeurs"
  strategic_conflict: "strategist final arbitration"
  schema_conflict: "reject output and retry"
  missing_context: "context loader or ask user"
  version_conflict: "use registry active version"
```

## 21. Agent Lifecycle

```yaml
agent_lifecycle:
  proposed
  drafted
  registered_draft
  evaluated
  active
  experimental
  deprecated
  disabled
  archived
```

Activation requires :

- blueprint complete ;
- registry entry complete ;
- output schema defined ;
- at least one eval case ;
- quality threshold defined ;
- routing rules defined ;
- no critical conflict.

## 22. Registry Validation Gates

Avant qu'un agent devienne actif :

- `agent_id` unique ;
- version valide ;
- status valide ;
- capabilities connues ;
- owns_sections sans conflit ;
- required inputs definis ;
- output schema defini ;
- routing rules definies ;
- guardrails presents ;
- quality thresholds presents ;
- eval path present ;
- changelog present.

Si un gate echoue :

- agent reste `draft` ;
- runtime ne le lance pas en production.

## 23. Registry Update Process

Pour ajouter un agent :

```text
1. creer fiche agent selon AGENT_BLUEPRINT
2. creer prompt systeme
3. creer schema de sortie
4. creer eval cases
5. ajouter entree registre
6. verifier conflits ownership/capabilities
7. passer registry validation gates
8. marquer active seulement apres validation
```

Pour modifier un agent :

```text
1. changer version
2. documenter changelog
3. verifier compatibilite schema
4. executer evals
5. mettre a jour registre
```

## 24. Registry Observability

Le runtime doit mesurer :

- agents les plus lances ;
- taux d'echec par agent ;
- score moyen ;
- cout moyen ;
- temps moyen ;
- gates echoues ;
- fallback utilise ;
- agents skips ;
- agents devenus obsoletes.

Ces donnees doivent nourrir :

```text
workspace/global_registry/agent_eval_scores.json
```

## 25. Minimal Registry Example

```yaml
agent_registry_entry:
  identity:
    agent_id: growth_hacker
    name: Growth Hacker
    version: "0.1.0"
    status: active
    type: optimizer
    owner_domain: growth

  purpose:
    mission: "Transformer une strategie en mecanismes d'amplification et de conversion."
    primary_question: "Quel mecanisme peut faire circuler ce message au-dela de sa publication initiale ?"
    success_definition: "La sortie contient des boucles growth concretes, mesurables et defendables."

  capabilities:
    primary:
      - growth_loop_design
    secondary:
      - experimentation_design
    forbidden:
      - direct_publishing
      - fake_engagement

  routing:
    required_for_intents:
      - create_campaign_pack
    optional_for_intents:
      - generate_content_batch
    activation_rules:
      - "activate when growth_mechanism required"
      - "activate when user asks for hacks or loops"
    fallback_agent_id: strategist

  quality:
    minimum_quality_score: 8
    minimum_confidence_score: 7
    rejection_conditions:
      - "tactique basee sur faux comptes"
      - "tactique non mesurable"
      - "tactique trop generique"
```

## 26. Anti-Patterns

Ne pas faire :

- lancer tous les agents pour chaque demande ;
- creer un agent sans capacite unique ;
- dupliquer ownership entre agents ;
- hardcoder le routage partout dans le code ;
- laisser un agent ecrire les fichiers finaux ;
- activer un agent sans schema ;
- activer un agent sans eval ;
- changer un schema sans version ;
- ignorer les agents disabled ;
- utiliser un agent experimental par defaut ;
- laisser un fallback masquer une erreur critique.

## 27. Definition De Done

Le registre d'agents est correctement defini quand le runtime peut :

- lister les agents actifs ;
- trouver un agent par capacite ;
- router un intent vers les agents requis ;
- ajouter les agents conditionnels ;
- ignorer les agents inutiles ;
- expliquer chaque choix ;
- verifier schemas et seuils ;
- appliquer fallback ;
- eviter conflits ownership ;
- loguer agent runs ;
- bloquer agents incomplets ;
- evoluer les agents par version.

## 28. Principe Final

Un systeme multi-agents robuste n'est pas une foule d'agents.

C'est un reseau d'agents declares, limites, versionnes, evaluables et routables.

Formule :

> Blueprint pour construire l'agent + Registry pour le decouvrir + Runtime pour l'orchestrer = reseau agentique fiable.
