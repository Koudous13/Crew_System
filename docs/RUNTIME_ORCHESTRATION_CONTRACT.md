# Runtime Orchestration Contract - Crew_System

## 1. Role Du Document

Ce document definit le noyau operationnel de Crew_System.

Les autres documents definissent :

- la vision produit : `BACKGROUND_AGENT_OS_VISION.md` ;
- le standard des agents : `AGENT_BLUEPRINT.md` ;
- la base strategique : `CAMPAIGN_PACK_CONTRACT.md` ;
- les productions massives : `CONTENT_BATCH_CONTRACT.md`.

Ce fichier definit comment tout cela s'execute.

La structure durable des dossiers, manifests, outputs, logs, archives et conventions de fichiers est definie dans `PROJECT_FILE_SYSTEM_CONTRACT.md`.

Question centrale :

> Comment une demande de chat devient-elle un job fiable qui lit les bons fichiers, lance les bons agents, produit les bons livrables, ecrit les bons fichiers et peut reprendre proprement ?

Le runtime n'est pas un agent.
Le runtime est l'OS qui orchestre les agents.

## 2. Definition Du Runtime

Le runtime est la couche centrale qui transforme une intention utilisateur en execution controlee.

Pipeline mental :

```text
Chat Request
  -> Request Normalizer
  -> Intent Parser
  -> Project Resolver
  -> Scope Clarifier
  -> Context Loader
  -> Job Planner
  -> Agent Router
  -> Task Graph Builder
  -> Execution Engine
  -> Quality Gate Engine
  -> File Writer
  -> Run Logger
  -> Final Chat Response
```

Le runtime doit :

- comprendre ce que l'utilisateur veut ;
- determiner si un projet existe deja ;
- trouver les fichiers a lire ;
- refuser les generations dangereusement hors contexte ;
- planifier les agents a consulter ;
- construire un graphe de taches ;
- executer les taches dans le bon ordre ;
- parallelliser ce qui peut l'etre ;
- verifier les sorties ;
- proteger l'intensite utile des agents avant de demander une revision ;
- ecrire des fichiers sans ecraser n'importe quoi ;
- journaliser les decisions ;
- exposer l'avancement dans le chat ;
- reprendre apres erreur ou interruption.

## 3. Principes Non Negociables

### 3.1 Pas De Generation Directe Hors Contexte

Le systeme ne doit pas generer 70 posts, une strategie annuelle ou une revision importante sans charger le contexte projet.

Si le contexte strategique manque, il doit :

- le signaler ;
- demander les informations manquantes ;
- ou proposer de creer d'abord le Campaign Pack.

### 3.2 Chat En Facade, Jobs En Arriere-Plan

Le chat sert a communiquer avec l'utilisateur.

Les demandes lourdes doivent devenir des jobs :

- identifiables ;
- tracables ;
- resumables ;
- ecrits dans des fichiers ;
- consultables apres execution.

### 3.3 Les Agents Ne Decident Pas De Tout

Les agents produisent des contributions.
Le runtime decide :

- quels agents lancer ;
- dans quel ordre ;
- avec quel contexte ;
- sous quelles limites ;
- quels fichiers ecrire ;
- quand arreter ;
- quand demander une clarification.

### 3.4 Les Fichiers Sont La Memoire Durable

Le runtime doit considerer les fichiers projet comme la source de verite.

La conversation peut aider, mais elle ne doit pas remplacer :

- le brief normalise ;
- le positionnement ;
- le calendrier annuel ;
- les strategies plateforme ;
- les outputs precedents ;
- les logs de decisions.

### 3.5 Qualite Avant Volume

Un job massif ne doit pas produire du volume en ignorant les gates.

Le runtime doit pouvoir :

- rejeter une sortie d'agent ;
- demander une revision ;
- retirer un contenu faible ;
- arreter le job si le score global est trop bas ;
- expliquer ce qui manque.

Mais les gates ne doivent pas rendre les sorties sages par reflexe.
Une sortie intense, psychologiquement tranchee ou growth agressive doit etre revisee seulement si elle est fausse, incoherente, non prouvable, abusive, spammy ou non assumable.
Si elle est forte mais exploitable, le runtime doit demander un encadrement, pas une neutralisation.

### 3.6 Rien N'Est Approuve Sans Humain

Le runtime peut marquer un livrable comme :

- `draft` ;
- `ready_for_human_review` ;
- `needs_revision` ;
- `rejected`.

Il ne doit pas marquer comme `approved_by_human` sans action explicite de l'utilisateur.

## 4. Objets Fondamentaux Du Runtime

Le runtime manipule des objets stables.

```yaml
runtime_objects:
  chat_request: "message utilisateur brut + contexte conversationnel"
  normalized_request: "demande clarifiee et structuree"
  intent: "type d'action a executer"
  project: "dossier et memoire durable"
  context_snapshot: "fichiers charges et points utiles"
  job: "execution traquee"
  task_graph: "ensemble de taches et dependances"
  agent_run: "execution d'un agent"
  artifact: "fichier ou sortie produite"
  quality_report: "scores et gates"
  final_response: "message court de fin dans le chat"
```

## 5. Request Envelope

Toute demande utilisateur doit etre transformee en enveloppe.

```yaml
chat_request:
  request_id: string
  conversation_id: string
  user_message: string
  received_at: string
  active_project_hint: string
  attachments: list[string]
  referenced_files: list[string]
  previous_job_id: string
  user_preferences:
    language: string
    tone: string
    depth: low | medium | high | extreme
  runtime_context:
    current_branch: string
    workspace_root: string
```

Regles :

- `request_id` doit etre unique.
- la demande brute doit etre conservee ;
- les pieces jointes doivent etre referencees ;
- les fichiers explicitement mentionnes par l'utilisateur ont priorite.

## 6. Intent Parser

Le role de l'Intent Parser est de comprendre l'action attendue.

Il ne doit pas seulement detecter des mots-cles.
Il doit classer la demande selon le contexte projet.

### 6.1 Intent Types

```yaml
intent_types:
  create_project_from_idea:
    description: "creer un nouveau projet depuis une idee SaaS, business ou offre"
  create_campaign_pack:
    description: "produire la base strategique persistante"
  generate_annual_calendar:
    description: "creer ou reviser le calendrier editorial annuel"
  generate_content_batch:
    description: "produire un lot de contenus a la demande"
  generate_video_batch:
    description: "produire des scripts ou concepts video"
  generate_visual_batch:
    description: "produire des briefs visuels ou concepts creatifs"
  revise_document:
    description: "modifier un document strategique existant"
  revise_content_batch:
    description: "modifier un batch existant"
  analyze_performance:
    description: "analyser resultats et proposer iteration"
  answer_project_question:
    description: "repondre en lisant les fichiers projet"
  list_projects:
    description: "lister les projets connus"
  show_job_status:
    description: "donner l'etat d'un job"
  archive_project_or_batch:
    description: "archiver un projet ou livrable"
  unknown_or_ambiguous:
    description: "demande insuffisamment claire"
```

### 6.2 Intent Output Schema

```yaml
intent_result:
  intent_type: string
  confidence_score: int
  project_required: boolean
  project_hint: string
  period_hint:
    type: week | month | quarter | custom | none
    value: string
  platforms: list[facebook | linkedin]
  requested_volume:
    total_items: int
    per_platform: object
  requested_assets:
    text: boolean
    images: boolean
    videos: boolean
    carousels: boolean
  output_expectation:
    files_required: boolean
    chat_only: boolean
    markdown: boolean
    json: boolean
  missing_information: list[string]
  ambiguity_flags: list[string]
```

### 6.3 Clarification Rules

Le runtime doit demander une clarification si :

- le projet vise est ambigu ;
- la periode est necessaire mais absente ;
- le volume est necessaire mais absent ;
- la plateforme est necessaire mais absente ;
- l'utilisateur demande un batch sans projet ;
- l'intention a un `confidence_score` sous 7.

Le runtime peut continuer sans clarification si :

- une hypothese raisonnable est possible ;
- l'impact est faible ;
- l'hypothese est notee dans les fichiers ;
- le confidence_score reste acceptable.

## 7. Project Resolver

Le Project Resolver identifie le dossier projet a utiliser ou a creer.

### 7.1 Resolution Modes

```yaml
project_resolution_modes:
  explicit:
    description: "l'utilisateur nomme clairement le projet"
  active_context:
    description: "le projet est celui de la conversation active"
  inferred:
    description: "le projet est deduit du message"
  new_project:
    description: "un nouveau projet doit etre cree"
  ambiguous:
    description: "plusieurs projets possibles"
  missing:
    description: "aucun projet disponible"
```

### 7.2 Project Descriptor

```yaml
project_descriptor:
  project_slug: string
  project_name: string
  root_path: string
  status: active | archived | draft
  created_at: string
  last_updated_at: string
  source_brief_path: string
  campaign_pack_path: string
  annual_calendar_path: string
  active_outputs_path: string
  project_manifest_path: string
```

### 7.3 Project Creation Rule

Un nouveau projet doit creer au minimum :

```text
projects/{project_slug}/
  README.md
  brief/
  strategy/
  calendar/
  platforms/
  creative/
  outputs/
  logs/
  reviews/
  manifest.json
```

Le slug doit etre :

- lisible ;
- stable ;
- en snake_case ;
- unique ;
- non base sur un nom vague comme `new_project`.

## 8. Scope Clarifier

Le Scope Clarifier decide si le runtime peut executer ou doit demander plus d'informations.

```yaml
scope_decision:
  can_execute: boolean
  needs_user_input: boolean
  reason: string
  assumptions: list[string]
  required_questions: list[string]
  safe_to_continue_level: low | medium | high
```

Regles :

- poser peu de questions ;
- ne pas bloquer pour des details mineurs ;
- bloquer si le livrable serait structurellement faux ;
- preferer des hypotheses explicites aux interruptions inutiles.

Exemples de blocage legitime :

- "Genere les posts de la semaine 4" sans projet identifiable ;
- "Fais 70 posts" sans plateforme ;
- "Base-toi sur le document" sans document disponible ;
- "Refais les posts 20 a 35" sans batch source.

## 9. Context Loader

Le Context Loader charge les fichiers necessaires avant execution.

Il doit eviter deux erreurs :

- charger trop peu et produire hors contexte ;
- charger trop et noyer les agents.

### 9.1 Context Loading Levels

```yaml
context_loading_levels:
  minimal:
    use_case: "question simple ou statut"
  standard:
    use_case: "revision limitee ou generation courte"
  deep:
    use_case: "campaign pack, calendrier annuel, content batch massif"
  forensic:
    use_case: "analyse d'erreur, audit, conflit de fichiers"
```

### 9.2 Context Package

```yaml
context_package:
  context_id: string
  project_slug: string
  loading_level: minimal | standard | deep | forensic
  loaded_files:
    - path: string
      role: string
      hash: string
      summary: string
  missing_files:
    - path: string
      impact: string
      required: boolean
  relevant_extracts:
    - source_path: string
      extract_label: string
      content_summary: string
  constraints: list[string]
  assumptions: list[string]
  confidence_score: int
```

### 9.3 Required Context By Intent

```yaml
required_context_by_intent:
  create_project_from_idea:
    required:
      - user brief
    optional:
      - attachments
      - examples
      - competitor notes
  create_campaign_pack:
    required:
      - normalized brief
    optional:
      - previous strategy docs
      - proof assets
  generate_annual_calendar:
    required:
      - normalized brief
      - strategic diagnosis
      - audience intelligence
      - positioning
      - growth system
      - platform strategies
    optional:
      - video strategy
      - visual direction
  generate_content_batch:
    required:
      - project README
      - normalized brief
      - positioning
      - audience intelligence
      - influence architecture
      - growth system
      - annual editorial calendar
      - relevant platform strategy
    optional:
      - visual direction
      - video strategy
      - previous batches
      - performance data
  revise_content_batch:
    required:
      - source batch
      - revision request
      - project strategy context
    optional:
      - quality review
      - user edits
  analyze_performance:
    required:
      - performance data
      - source content or batch
    optional:
      - campaign strategy
      - previous learnings
```

## 10. Job Planner

Le Job Planner transforme l'intention et le contexte en job executable.

### 10.1 Job Schema

```yaml
job:
  job_id: string
  request_id: string
  project_slug: string
  intent_type: string
  status: queued
  priority: normal | high
  execution_mode: foreground | background
  created_at: string
  updated_at: string
  requested_outputs: list[string]
  expected_artifacts: list[string]
  context_id: string
  task_graph_id: string
  quality_gates: list[string]
  budget:
    max_runtime_minutes: int
    max_agent_runs: int
    max_cost_tier: low | standard | high
  resume_policy:
    checkpoint_enabled: boolean
    retry_enabled: boolean
    max_retries: int
```

### 10.2 Job Types

```yaml
job_types:
  project_bootstrap_job:
    output: "dossier projet + brief normalise"
  campaign_pack_job:
    output: "base strategique persistante"
  annual_calendar_job:
    output: "calendrier editorial annuel"
  content_batch_job:
    output: "lot de contenus"
  revision_job:
    output: "nouvelle version d'un document ou batch"
  analysis_job:
    output: "rapport d'analyse et prochaine iteration"
  maintenance_job:
    output: "index, logs, migration, archive"
```

### 10.3 Execution Mode

```yaml
execution_modes:
  foreground:
    use_case: "question courte ou petite revision"
    chat_behavior: "reponse directe"
  background:
    use_case: "travail lourd"
    chat_behavior: "progress updates + fichiers finaux"
```

Regle :

Tout job qui peut produire beaucoup de fichiers, lancer plusieurs agents ou durer longtemps doit etre `background`.

### 10.4 Job State Files

Chaque job doit avoir un etat persistant.

Structure recommandee :

```text
projects/{project_slug}/logs/jobs/{job_id}/
  job.json
  task_graph.json
  context_snapshot.json
  progress_events.jsonl
  checkpoints.jsonl
  final_response.md
```

Regles :

- `job.json` contient l'etat courant ;
- `task_graph.json` contient les taches et dependances ;
- `context_snapshot.json` fige ce qui a ete lu ;
- `progress_events.jsonl` alimente le chat ;
- `checkpoints.jsonl` permet la reprise ;
- `final_response.md` conserve le resume donne a l'utilisateur.

## 11. Agent Router

L'Agent Router choisit les agents a lancer.

Il doit respecter :

- `AGENT_BLUEPRINT.md` ;
- les contributions definies dans les contrats ;
- le type de livrable ;
- les fichiers disponibles ;
- les limites de cout et temps ;
- les agents deja executes dans le job.

### 11.1 Agent Selection Schema

```yaml
agent_selection:
  required_agents: list[string]
  optional_agents: list[string]
  skipped_agents:
    - agent_id: string
      reason: string
  reuse_previous_outputs:
    - agent_id: string
      source_artifact: string
      reason: string
  escalation_agents: list[string]
```

### 11.2 Selection Rules

Pour `campaign_pack_job`, agents minimum :

- intake_normalizer ;
- file_architect ;
- strategist ;
- audience_psychologist ;
- positioning_agent ;
- influence_architect ;
- growth_hacker ;
- facebook_native_agent ;
- linkedin_native_agent ;
- calendar_architect ;
- creative_director ;
- anti_banality_agent ;
- risk_reviewer.

Pour `content_batch_job`, agents minimum :

- strategist ;
- calendar_architect ;
- audience_psychologist ;
- platform_native_agent ;
- hook_master ;
- copywriter ;
- anti_banality_agent.

Ajouter selon besoin :

- growth_hacker si mecanisme d'amplification ;
- creative_director si visuels ;
- video_agent si videos ;
- risk_reviewer si promesses, claims, sujets sensibles ;
- experimentation_agent si A/B tests.

### 11.3 Reuse Rule

Le runtime ne doit pas relancer un agent si :

- une sortie recente et valide existe ;
- le contexte n'a pas change ;
- la sortie est suffisante pour le job ;
- le contrat de sortie est compatible.

Il doit relancer si :

- le brief a change ;
- la strategie a ete modifiee ;
- la periode est differente ;
- la qualite precedente etait faible ;
- l'utilisateur demande explicitement une nouvelle version.

### 11.4 Agent Registry Dependency

Le runtime ne doit pas connaitre les agents en dur dans toutes ses fonctions.

Il doit s'appuyer sur le registre d'agents defini dans `AGENT_REGISTRY_CONTRACT.md`.

Le registre devra fournir :

```yaml
agent_registry_entry:
  agent_id: string
  version: string
  status: active | deprecated | disabled
  capabilities: list[string]
  owned_sections: list[string]
  accepted_inputs: list[string]
  produced_outputs: list[string]
  execution_modes: list[string]
  cost_tier: low | standard | high
  quality_threshold: int
```

En attendant l'implementation complete, le runtime peut utiliser une configuration statique.
Mais cette configuration doit respecter `AGENT_REGISTRY_CONTRACT.md`.

## 12. Task Graph Builder

Le Task Graph Builder cree les dependances.

Un runtime robuste ne lance pas les agents en liste plate.
Il construit un graphe.

### 12.1 Task Node Schema

```yaml
task_node:
  task_id: string
  job_id: string
  type: agent_run | validation | file_write | transform | human_input
  owner: runtime | agent_id | user
  input_refs: list[string]
  output_refs: list[string]
  dependencies: list[string]
  status: pending | running | completed | failed | skipped
  retry_count: int
  timeout_seconds: int
```

### 12.2 Campaign Pack Graph

```text
normalize_brief
  -> file_plan
  -> strategic_diagnosis
  -> audience_intelligence
  -> positioning
  -> influence_architecture
  -> growth_system
  -> platform_strategies
  -> annual_calendar
  -> creative_strategy
  -> quality_review
  -> risk_review
  -> final_arbitration
  -> write_files
  -> final_chat_response
```

### 12.3 Content Batch Graph

```text
resolve_project
  -> load_context
  -> select_period
  -> production_plan
  -> agent_strategy_refresh
  -> generate_hooks
  -> generate_content_units
  -> generate_visual_briefs
  -> generate_video_scripts
  -> anti_banality_review
  -> risk_review
  -> diversity_check
  -> write_batch_files
  -> final_chat_response
```

### 12.4 Parallelization Rules

Peuvent etre paralleles :

- Facebook strategy et LinkedIn strategy apres positionnement ;
- visual direction et video strategy apres influence architecture ;
- hook generation par angle ;
- content units par groupe de formats ;
- risk scan et duplicate scan apres generation.

Ne doivent pas etre paralleles :

- positionnement avant audience ;
- annual calendar avant big idea ;
- file write final avant quality gates ;
- final response avant write confirmation.

## 13. Execution Engine

L'Execution Engine execute le graphe.

Responsabilites :

- lancer les tasks ;
- respecter les dependances ;
- appliquer les timeouts ;
- capturer les erreurs ;
- enregistrer les checkpoints ;
- mettre a jour le job status ;
- envoyer les progress events ;
- arreter proprement si necessaire.

### 13.1 Job Lifecycle

```yaml
job_lifecycle:
  queued
  accepted
  normalizing_request
  resolving_project
  clarifying_scope
  loading_context
  planning_job
  building_task_graph
  running_agents
  validating_outputs
  writing_files
  preparing_final_response
  completed
  waiting_for_user
  paused
  failed
  cancelled
```

### 13.2 Progress Events

```yaml
progress_event:
  event_id: string
  job_id: string
  status: string
  message: string
  percent_estimate: int
  current_phase: string
  active_agents: list[string]
  artifacts_created: list[string]
  timestamp: string
```

Le chat doit pouvoir afficher des messages comme :

```text
Je relis le calendrier annuel et la strategie Facebook.
J'ai lance Hook Master, Growth Hacker et Facebook Native.
Je suis en revue Anti-Banality sur les contenus generes.
J'ecris le batch final dans outputs/batches/.
```

## 14. Agent Run Contract

Chaque execution d'agent doit etre traquee.

```yaml
agent_run:
  agent_run_id: string
  job_id: string
  agent_id: string
  agent_version: string
  task_id: string
  input_artifacts: list[string]
  output_artifacts: list[string]
  execution_mode: draft | deep_work | critic | revision | benchmark
  started_at: string
  completed_at: string
  status: completed | failed | skipped
  quality_score: int
  confidence_score: int
  risk_flags: list[string]
  error: string
```

Regles :

- chaque agent doit recevoir un contexte limite et utile ;
- chaque agent doit produire selon son schema ;
- chaque sortie doit etre validee ;
- chaque agent doit indiquer confiance et point faible ;
- une sortie invalide ne doit pas passer silencieusement.

## 15. Quality Gate Engine

Le runtime doit appliquer les gates.

### 15.1 Gate Schema

```yaml
quality_gate:
  gate_id: string
  job_id: string
  name: string
  applies_to: job | artifact | agent_output | content_unit
  status: passed | failed | warning
  score: int
  failure_reason: string
  required_action: continue | revise | ask_user | stop
```

### 15.2 Runtime Gates

```yaml
runtime_quality_gates:
  context_gate:
    purpose: "verifier que les fichiers necessaires sont charges"
  schema_gate:
    purpose: "verifier la structure des outputs"
  strategic_alignment_gate:
    purpose: "verifier coherence avec positionnement et calendrier"
  intensity_preservation_gate:
    purpose: "verifier que les revisions ne neutralisent pas psychologie, influence ou growth"
  anti_banality_gate:
    purpose: "rejeter les sorties generiques"
  diversity_gate:
    purpose: "eviter repetition dans les batches"
  risk_gate:
    purpose: "detecter promesses, preuves faibles, tactiques interdites"
  file_integrity_gate:
    purpose: "verifier ecriture et chemins"
  final_readiness_gate:
    purpose: "decider si livrable pret pour revue humaine"
```

### 15.3 Failure Policy

Si un gate echoue :

- sortie locale faible : revision automatique ;
- sortie forte mais risquee : revision ciblee pour encadrer sans lisser ;
- contexte manquant : demander utilisateur ou arreter ;
- risque eleve : envoyer au Risk Reviewer ;
- schema invalide : reexecuter ou transformer ;
- ecriture impossible : arreter et ne pas annoncer succes ;
- score global sous seuil : produire rapport `needs_revision`.

## 16. File Writer

Le File Writer est responsable de toutes les ecritures.

Les agents ne doivent pas ecrire directement les fichiers finaux sans passer par le runtime.

### 16.1 Write Plan

Avant d'ecrire, le runtime doit produire :

```yaml
write_plan:
  job_id: string
  project_slug: string
  files:
    - path: string
      artifact_type: markdown | json | log | manifest
      write_mode: create | append | overwrite_with_version | skip_if_exists
      source_task_id: string
      validation_required: boolean
```

### 16.2 File Write Rules

Regles :

- ne pas ecraser un fichier important sans version ;
- ecrire Markdown pour lecture humaine ;
- ecrire JSON pour exploitation machine ;
- utiliser des chemins stables ;
- creer les dossiers manquants ;
- verifier l'ecriture apres coup ;
- journaliser tous les fichiers ecrits ;
- conserver l'ancien fichier si revision majeure.

### 16.3 Atomic Write Pattern

Le futur code doit suivre ce pattern :

```text
1. ecrire dans fichier temporaire
2. valider contenu
3. renommer vers chemin final
4. mettre a jour manifest
5. logger l'artifact
```

## 17. Artifact Registry

Chaque fichier produit doit etre declare.

```yaml
artifact:
  artifact_id: string
  job_id: string
  project_slug: string
  path: string
  type: campaign_pack | content_batch | strategy_doc | calendar | visual_brief | video_script | log | manifest
  format: markdown | json | jsonl
  version: string
  hash: string
  created_at: string
  source_task_ids: list[string]
  status: draft | needs_revision | ready_for_human_review | approved_by_human | rejected | archived
```

L'Artifact Registry sert a :

- retrouver les outputs ;
- eviter les doublons ;
- savoir quoi relire ;
- permettre les revisions ;
- auditer une generation.

## 18. Run Logger

Le runtime doit logger sans transformer le systeme en boite noire.

### 18.1 Logs Obligatoires

```text
projects/{project_slug}/logs/
  jobs.jsonl
  agent_runs.jsonl
  decisions.md
  artifacts.jsonl
  errors.jsonl
```

### 18.2 Job Log Schema

```yaml
job_log:
  job_id: string
  request_id: string
  intent_type: string
  project_slug: string
  status: string
  started_at: string
  completed_at: string
  agents_used: list[string]
  artifacts_created: list[string]
  quality_score: int
  error: string
```

### 18.3 Decision Log

`decisions.md` doit garder les arbitrages importants :

- pourquoi tel projet a ete choisi ;
- pourquoi tel agent a ete lance ;
- pourquoi un contenu a ete rejete ;
- pourquoi une hypothese a ete retenue ;
- pourquoi un fichier a ete versionne ;
- pourquoi le job a demande une clarification.

Ne pas logger :

- tokens ;
- secrets ;
- credentials ;
- informations sensibles inutiles ;
- raisonnement interne long.

## 19. Error Handling

Le runtime doit gerer les erreurs comme des cas normaux.

### 19.1 Error Types

```yaml
runtime_error_types:
  intent_ambiguous
  project_not_found
  missing_required_context
  schema_validation_failed
  agent_run_failed
  quality_gate_failed
  file_write_failed
  output_conflict
  timeout
  cost_budget_exceeded
  user_input_required
  unsupported_request
```

### 19.2 Error Response Schema

```yaml
runtime_error:
  error_id: string
  job_id: string
  type: string
  severity: low | medium | high | blocking
  message_for_user: string
  technical_summary: string
  recoverable: boolean
  suggested_next_action: string
```

### 19.3 Retry Policy

Retries autorises :

- agent failure temporaire ;
- schema invalide mais reparable ;
- timeout local limite ;
- conflit de fichier resolvable par versioning.

Retries interdits :

- projet introuvable ;
- demande ambigue ;
- contexte strategique absent ;
- permission ou chemin impossible ;
- risque critique non resolu.

## 20. Resume And Checkpoints

Un job long doit pouvoir reprendre.

### 20.1 Checkpoint Schema

```yaml
checkpoint:
  checkpoint_id: string
  job_id: string
  phase: string
  completed_tasks: list[string]
  pending_tasks: list[string]
  artifacts_written: list[string]
  context_hash: string
  can_resume: boolean
  resume_reason: string
```

### 20.2 Resume Rules

Le runtime peut reprendre si :

- le contexte n'a pas change ;
- les artifacts intermediaires sont valides ;
- les fichiers source existent encore ;
- le job n'a pas ete annule par l'utilisateur.

Le runtime doit replanifier si :

- un document strategique a ete modifie ;
- un batch source a change ;
- un agent critique a change de version ;
- une dependance n'est plus valide.

## 21. Concurrency And Locks

Crew_System doit eviter les collisions de fichiers.

Regles :

- un seul job peut ecrire dans le meme fichier final a la fois ;
- plusieurs jobs peuvent lire le meme projet ;
- un job de revision doit verrouiller le batch source ;
- un job de creation projet doit verrouiller le slug ;
- un job annule doit liberer ses locks.

```yaml
lock:
  lock_id: string
  scope: project | artifact | batch | job
  target: string
  owner_job_id: string
  acquired_at: string
  expires_at: string
```

## 22. Human Interaction During Jobs

Le runtime doit savoir quand interrompre et demander.

Cas `waiting_for_user` :

- projet ambigu ;
- validation demandee avant overwrite ;
- risque eleve ;
- manque d'information critique ;
- choix de direction necessaire ;
- depassement de budget.

Le message au chat doit etre court et actionnable :

```text
J'ai besoin d'un choix avant de continuer : dois-je utiliser le projet coach_saas ou coach_app_v2 ?
```

### 22.1 User Control Commands

Pendant un job, l'utilisateur doit pouvoir demander :

```text
status
pause
resume
cancel
show files
show errors
continue with assumption
change scope
```

Le runtime doit interpreter ces demandes comme des controles du job actif si le contexte le permet.

```yaml
job_control_command:
  command: status | pause | resume | cancel | show_files | show_errors | continue | change_scope
  target_job_id: string
  allowed: boolean
  reason_if_denied: string
```

Regles :

- `status` ne modifie rien ;
- `pause` doit finir la tache atomique en cours si possible ;
- `cancel` ne doit pas supprimer les fichiers deja ecrits sans demande explicite ;
- `change_scope` doit declencher une replanification ;
- `resume` doit verifier les checkpoints.

## 23. Final Chat Response

La reponse finale ne doit pas recopier tout le livrable.

Elle doit dire :

- ce qui a ete fait ;
- ou sont les fichiers ;
- quels scores ou alertes comptent ;
- quelle est la prochaine action utile ;
- si quelque chose n'a pas pu etre fait.

Schema :

```yaml
final_chat_response:
  job_id: string
  status: completed | failed | needs_user_input
  summary: string
  key_artifacts:
    - label: string
      path: string
  quality_summary: string
  warnings: list[string]
  next_recommended_action: string
```

## 24. Memory Model

Le runtime doit distinguer plusieurs memoires.

```yaml
memory_layers:
  conversation_memory:
    role: "aide a comprendre la discussion actuelle"
    source_of_truth: false
  project_file_memory:
    role: "source durable de strategie et outputs"
    source_of_truth: true
  job_memory:
    role: "etat temporaire d'une execution"
    source_of_truth: false
  agent_memory:
    role: "preferences ou patterns propres a un agent"
    source_of_truth: conditional
  performance_memory:
    role: "resultats observes et apprentissages"
    source_of_truth: true_when_verified
```

Regle :

Si la conversation contredit les fichiers projet, le runtime doit signaler le conflit et demander ou enregistrer une revision.

## 25. Data Validation

Tout output structure doit etre valide.

Validation minimale :

- schema present ;
- champs obligatoires ;
- scores entre 0 et 10 ;
- paths valides ;
- ids stables ;
- status autorises ;
- references existantes ;
- hypotheses marquees ;
- aucun artifact attendu manquant.

Le runtime doit produire un rapport si validation echoue.

## 26. Cost And Budget Control

Le runtime doit controler le cout et l'effort.

```yaml
budget_policy:
  tiers:
    low:
      use_case: "petite question ou revision"
    standard:
      use_case: "document ou batch modere"
    high:
      use_case: "campaign pack complet ou batch massif"
  controls:
    - max_agent_runs
    - max_iterations_per_agent
    - max_runtime_minutes
    - context_size_limit
    - fallback_model
```

Si le job risque de depasser le budget :

- reduire le scope ;
- grouper les agents ;
- reutiliser les sorties existantes ;
- demander validation utilisateur ;
- proposer une execution en deux phases.

## 27. Runtime Guardrails

Le runtime doit appliquer les guardrails globaux.

Interdits :

- inventer des preuves ;
- inventer des resultats ;
- ecrire des faux temoignages ;
- recommander faux comptes ou engagement artificiel ;
- produire un livrable qui pretend etre approuve ;
- ignorer un risque critique ;
- ecraser un fichier important sans version ;
- annoncer un fichier cree sans verifier l'ecriture.

Autorise :

- cadrage offensif ;
- manipulation de perception ;
- polarisation controlee ;
- growth loops defendables ;
- critique intense ;
- hooks agressifs si alignes et non trompeurs.

## 28. Runtime Observability

Le runtime doit mesurer :

- nombre de jobs ;
- temps moyen par job ;
- taux d'erreur ;
- taux de reprise ;
- agents les plus utilises ;
- quality scores moyens ;
- fichiers produits ;
- revisions demandees ;
- gates les plus souvent echoues ;
- cout estime par job.

Ces metriques serviront plus tard a ameliorer :

- agents ;
- prompts ;
- workflows ;
- schemas ;
- UX chat.

## 29. Example Scenario - Creation D'Un Projet SaaS

Demande :

```text
J'ai une idee de SaaS pour aider les coachs sportifs a suivre leurs clients.
Je veux une strategie Facebook et LinkedIn sur 1 an.
```

Runtime :

```text
1. intent = create_project_from_idea
2. project_slug = coach_saas
3. create project folders
4. normalize brief
5. plan campaign_pack_job
6. route agents
7. build task graph
8. run strategy agents
9. run calendar architect
10. run quality and risk gates
11. write files
12. respond with artifact paths
```

Fichiers attendus :

```text
projects/coach_saas/
  brief/normalized_brief.json
  strategy/strategic_diagnosis.md
  strategy/audience_intelligence.md
  strategy/positioning.md
  calendar/annual_editorial_calendar.md
  platforms/facebook_strategy.md
  platforms/linkedin_strategy.md
  logs/jobs.jsonl
```

## 30. Example Scenario - 70 Posts Facebook

Demande :

```text
Base-toi sur coach_saas.
Genere 70 posts Facebook pour la semaine 4.
Ajoute des visuels quand c'est utile.
```

Runtime :

```text
1. intent = generate_content_batch
2. resolve project = coach_saas
3. load deep context
4. locate week 4 in annual calendar
5. create production plan
6. route agents
7. generate content groups
8. run anti-banalite and diversity checks
9. create visual briefs
10. score all content units
11. write batch files
12. respond with paths and summary
```

Fichiers attendus :

```text
projects/coach_saas/outputs/batches/week_04_facebook_70/
  README.md
  content_batch.md
  content_batch.json
  visual_briefs.md
  quality_review.md
  production_plan.json
  agent_run_summary.md
```

## 31. Example Scenario - Revision

Demande :

```text
Refais les posts 20 a 35 en plus agressif.
Garde la strategie, change seulement les hooks et CTA.
```

Runtime :

```text
1. intent = revise_content_batch
2. resolve source batch
3. load source batch + strategy context
4. identify content ids 20-35
5. preserve unchanged items
6. run Hook Master + Copywriter + Anti-Banality
7. validate risk and diversity
8. write revision version
9. summarize changes
```

## 32. Implementation Boundary

Ce document ne force pas encore une technologie precise.

Mais le futur code doit probablement contenir :

```text
src/crew_system/runtime/
  orchestrator.py
  request_normalizer.py
  intent_parser.py
  project_resolver.py
  scope_clarifier.py
  context_loader.py
  job_planner.py
  agent_router.py
  task_graph.py
  execution_engine.py
  quality_gate_engine.py
  file_writer.py
  artifact_registry.py
  run_logger.py
  recovery.py
```

Le code peut evoluer, mais il doit respecter les responsabilites de ce contrat.

## 33. Anti-Patterns

Ne pas construire :

- un orchestrateur qui appelle tous les agents tout le temps ;
- un chatbot qui oublie les fichiers projet ;
- un systeme qui genere avant de lire ;
- un file writer disperse dans tous les agents ;
- un job sans id ;
- un batch sans quality gates ;
- une revision qui ecrase l'original ;
- une reponse finale qui annonce des fichiers non crees ;
- un runtime qui cache les erreurs ;
- un graphe de taches impossible a reprendre ;
- une architecture ou la conversation devient la seule memoire.

## 34. Definition De Done

Le runtime est correctement defini quand il sait :

- classifier une demande ;
- resoudre ou creer un projet ;
- demander clarification quand necessaire ;
- charger les bons fichiers ;
- creer un job ;
- selectionner les agents ;
- construire un graphe de taches ;
- executer avec statuts ;
- appliquer les quality gates ;
- ecrire les fichiers proprement ;
- logger les decisions ;
- reprendre apres interruption ;
- expliquer l'avancement dans le chat ;
- produire une reponse finale utile.

## 35. Principe Final

Crew_System ne doit pas etre une collection d'agents.

Crew_System doit etre un systeme d'exploitation agentique :

```text
Chat en facade
  + Runtime orchestration
  + Memoire fichier
  + Agents specialises
  + Jobs resumables
  + Quality gates
  + Logs auditables
  = Strategic Communication OS vivant
```

Formule :

> Le runtime transforme l'intelligence des agents en systeme fiable.
