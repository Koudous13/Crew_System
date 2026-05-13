# Agent Blueprint - Standard GOAT Pour Crew_System

## 1. Intention Du Fichier

Ce fichier definit le modele a suivre pour creer chaque agent de Crew_System.

Un agent ne doit jamais etre un simple prompt avec un nom stylise.
Un agent est un composant strategique, testable, versionne et observable.

La question centrale :

> Si cet agent disparait, quelle capacite unique le systeme perd-il ?

Si la reponse n'est pas claire, l'agent ne merite pas d'exister.

## 2. Definition D'Un Bon Agent

Un bon agent est une unite de jugement specialisee.

Il doit avoir :

- une mission precise ;
- un territoire de responsabilite ;
- des entrees explicites ;
- des sorties structurees ;
- des criteres de qualite ;
- des limites ;
- des dependances connues ;
- une facon de collaborer avec les autres agents ;
- une memoire utile, pas envahissante ;
- une trace de ses decisions ;
- des tests permettant de savoir s'il progresse ou regresse.

Un mauvais agent :

- fait "un peu de tout" ;
- repete le travail d'un autre agent ;
- produit du texte libre impossible a exploiter ;
- n'a pas de definition de succes ;
- n'a pas de limites ;
- invente des informations ;
- confond intensite persuasive et absence de preuve ;
- donne une sortie jolie mais inutilisable.

## 3. Regle De Creation D'Un Agent

Avant de creer un agent, repondre a ces 7 questions :

1. Quelle decision ou production cet agent possede-t-il ?
2. Pourquoi un autre agent ne peut-il pas faire ce travail ?
3. De quelles informations a-t-il besoin pour travailler ?
4. Que doit-il produire exactement ?
5. Comment sait-on que sa sortie est excellente ?
6. A qui transmet-il son travail ?
7. Quelles erreurs doit-il absolument eviter ?

Si au moins 3 reponses sont floues, il faut renforcer le design avant d'implementer.

## 4. Standard Non Negociable

Crew_System ne doit pas accepter d'agents "prompt simple".

Un agent faible au debut devient une dette strategique :

- il produit des sorties floues ;
- il pollue les agents suivants ;
- il rend l'evaluation impossible ;
- il cache les erreurs derriere du texte elegant ;
- il donne l'impression que le systeme avance alors qu'il accumule du chaos.

Regle :

> Aucun agent n'entre dans Crew_System s'il n'est pas structure, testable, observable et orchestrable des sa premiere version.

On peut activer certaines capacites progressivement, mais la charpente doit etre complete des le depart.

## 4.1 Minimum Viable Agent Robuste

Un agent minimum acceptable doit posseder :

- une identite stable ;
- une mission forte ;
- un territoire de responsabilite ;
- une liste claire de ce qu'il ne fait pas ;
- un contrat d'entree ;
- un contrat de sortie ;
- un schema de sortie exploitable ;
- une methode de raisonnement ;
- des criteres de scoring ;
- des conditions de rejet ;
- des garde-fous ;
- une politique d'outils ;
- une politique de memoire, meme si la memoire est desactivee au debut ;
- un contrat de handoff avec les autres agents ;
- des modes d'execution ;
- des limites de cout, temps et iterations ;
- des traces d'observabilite ;
- des tests d'evaluation ;
- un versioning.

Si un de ces blocs manque, l'agent est incomplet.

## 4.2 Capacites Activables

Certaines capacites peuvent etre marquees comme `disabled` ou `planned`, mais elles doivent etre pensees des la conception.

Exemples :

- outils externes : desactives au debut, mais politique d'usage deja definie ;
- memoire long terme : desactivee au debut, mais schema de lecture/ecriture deja prevu ;
- benchmarks : premiers cas simples au debut, mais format d'evaluation deja present ;
- execution asynchrone : pas obligatoire au MVP, mais handoff et observabilite deja compatibles ;
- fallback model : pas branche au debut, mais comportement de degradation deja decrit.

La difference est importante :

- mauvais : "on ajoutera ca plus tard" ;
- bon : "c'est prevu dans le contrat, mais pas encore active".

## 4.3 Agent Skeleton Obligatoire

Chaque agent doit donc naitre avec ce squelette :

```yaml
agent:
  identity: required
  mission: required
  responsibility: required
  inputs: required
  outputs: required
  reasoning: required
  quality: required
  guardrails: required
  tools: required
  memory_policy: required
  collaboration: required
  execution: required
  observability: required
  evaluation: required
  versioning: required
```

Ce squelette n'est pas decoratif.
Il sert a eviter que les agents deviennent des personnages bavards au lieu de composants fiables.

## 4.4 Definition D'Un Agent GOAT

Un agent GOAT n'est pas un agent avec un prompt plus long.

C'est un agent qui sait :

- quoi decider ;
- quoi refuser ;
- quoi produire ;
- comment justifier sa production ;
- comment transmettre son travail ;
- comment etre critique ;
- comment etre mesure ;
- comment evoluer sans casser le workflow.

Le standard de Crew_System :

> Chaque agent doit etre concu comme s'il allait devenir critique pour la qualite finale du systeme.

## 5. Structure Standard D'Un Agent

Chaque agent doit suivre cette structure.

### 5.1 Identite

Champs obligatoires :

- `agent_id` : identifiant stable, en snake_case.
- `name` : nom humain clair.
- `version` : version semantique.
- `status` : draft, active, deprecated.
- `owner` : domaine responsable.
- `type` : strategist, analyst, creator, critic, optimizer, orchestrator.

Exemple :

```yaml
agent_id: audience_psychologist
name: Audience Psychologist
version: 0.1.0
status: draft
owner: strategy
type: analyst
```

### 5.2 Mission

La mission de l'agent doit etre une phrase active.

Mauvais :

> Aider a comprendre l'audience.

Bon :

> Identifier les tensions emotionnelles, croyances, objections et desirs qui rendent une campagne impossible a ignorer pour une audience precise.

Champs :

- `mission`
- `primary_question`
- `success_definition`

Exemple :

```yaml
mission: >
  Identifier les tensions emotionnelles, croyances, objections et desirs
  qui peuvent transformer une offre en message magnetique.
primary_question: >
  Quelle tension psychologique rend cette audience prete a ecouter ?
success_definition: >
  La sortie permet au Strategiste Principal de choisir un angle plus fort,
  plus specifique et plus actionnable.
```

### 5.3 Role, Goal, Backstory

Ces champs servent au moteur agentique.
Ils doivent etre courts, nets et non contradictoires.

`role` :
Ce que l'agent est dans le systeme.

`goal` :
Le resultat qu'il poursuit.

`backstory` :
Le contexte qui oriente son style de raisonnement.

Regle :

- le role donne l'identite ;
- le goal donne la direction ;
- la backstory donne la profondeur ;
- aucun des trois ne doit remplacer le contrat de sortie.

Exemple :

```yaml
role: Psychologue strategique de l'audience
goal: >
  Reveler les leviers emotionnels, sociaux et cognitifs qui peuvent
  rendre une campagne plus persuasive.
backstory: >
  Tu combines psychologie du consommateur, copywriting direct response,
  strategie de marque et analyse des conversations sociales.
```

## 6. Territoire De Responsabilite

Un agent doit savoir ce qu'il possede et ce qu'il ne possede pas.

Champs :

- `owns`
- `does_not_own`
- `decision_rights`
- `handoff_to`

Exemple :

```yaml
owns:
  - tensions emotionnelles
  - objections
  - desirs visibles et caches
  - langage naturel de l'audience
does_not_own:
  - calendrier editorial final
  - textes finaux de publication
  - scoring global de campagne
decision_rights:
  - peut recommander l'angle emotionnel dominant
  - peut signaler qu'une campagne manque de tension humaine
handoff_to:
  - strategist
  - positioning_agent
  - hook_master
```

## 7. Inputs

Un agent scalable ne doit pas deviner son contexte.
Il doit recevoir les donnees necessaires sous forme claire.

Types d'inputs :

- `business_context`
- `offer`
- `target_audience`
- `campaign_objective`
- `platform`
- `brand_voice`
- `constraints`
- `previous_outputs`
- `performance_data`
- `source_materials`

Chaque agent doit declarer :

- inputs obligatoires ;
- inputs optionnels ;
- comportement si un input manque.

Exemple :

```yaml
required_inputs:
  - business_context
  - offer
  - target_audience
  - campaign_objective
optional_inputs:
  - previous_posts
  - customer_reviews
  - competitor_examples
missing_input_behavior:
  - signaler les angles incertains
  - formuler les hypotheses explicitement
  - ne pas inventer de donnees factuelles
```

## 8. Outputs

Chaque sortie doit etre exploitable par un autre agent ou par l'utilisateur.

Regles :

- pas de sortie vague ;
- pas de prose inutile ;
- chaque section doit avoir un usage ;
- chaque hypothese doit etre marquee comme hypothese ;
- chaque recommandation doit avoir une raison.

Exemple de structure :

```yaml
output_schema:
  emotional_map:
    visible_pains: list[str]
    hidden_pains: list[str]
    ambitions: list[str]
    fears: list[str]
    objections: list[str]
    beliefs_to_shift: list[str]
    trigger_phrases: list[str]
  dominant_tension:
    label: str
    explanation: str
    intensity_score: int
    confidence_score: int
  recommended_angles:
    - angle: str
      emotion: str
      why_it_works: str
      risk: str
```

## 9. Qualite Et Scoring

Chaque agent doit evaluer sa propre sortie.

Le score ne doit pas etre decoratif.
Il doit aider a decider si la sortie peut passer a l'etape suivante.

Champs standard :

- `quality_score` : score global sur 10.
- `confidence_score` : confiance sur les hypotheses.
- `novelty_score` : originalite.
- `actionability_score` : facilite d'utilisation.
- `risk_score` : risque strategique ou reputational.

Regle :

- sous 6 : sortie a rejeter ;
- 6 a 7 : sortie faible, demander iteration ;
- 7 a 8 : utilisable mais ameliorable ;
- 8 a 9 : solide ;
- 9 a 10 : actif strategique majeur.

Exemple :

```yaml
self_evaluation:
  quality_score: 8
  confidence_score: 7
  novelty_score: 8
  actionability_score: 9
  risk_score: 3
  weakest_point: "Manque de donnees client reelles."
  next_improvement: "Ajouter des verbatims clients ou commentaires publics."
```

## 10. Raisonnement Attendu

Un agent ne doit pas seulement produire.
Il doit suivre une methode de raisonnement stable.

La methode doit etre explicite :

```yaml
reasoning_steps:
  - analyser l'objectif
  - isoler les tensions humaines
  - distinguer faits, hypotheses et interpretations
  - generer plusieurs angles
  - filtrer les angles faibles
  - choisir l'angle dominant
  - expliquer pourquoi cet angle peut fonctionner
```

Important :

Le raisonnement interne detaille n'a pas besoin d'etre expose integralement.
Mais la sortie doit contenir une justification courte et utile.

## 11. Garde-Fous Strategiques

Chaque agent doit avoir des limites propres a son domaine.

Pour Crew_System, les garde-fous generaux :

- ne pas inventer de preuves ;
- ne pas inventer de chiffres ;
- ne pas inventer de temoignages ;
- ne pas promettre un resultat garanti ;
- ne pas recommander de spam ;
- ne pas recommander de faux comptes ;
- ne pas recommander de collecte de donnees sans consentement ;
- ne pas confondre provocation et strategie ;
- ne pas produire un contenu qui detruit la confiance long terme.

Regle centrale :

> Intensite maximale, faussete minimale.

Chaque agent doit aussi avoir des garde-fous specifiques.

Exemple pour Growth Hacker :

```yaml
domain_guardrails:
  - proposer uniquement des boucles growth defendables
  - distinguer tactique agressive et tactique frauduleuse
  - indiquer le risque reputational de chaque idee
  - proposer une version safe lorsque l'idee est trop risquee
```

## 12. Outils

Un agent ne doit avoir acces qu'aux outils necessaires a sa mission.

Champs :

- `allowed_tools`
- `forbidden_tools`
- `tool_usage_rules`
- `failure_behavior`

Exemple :

```yaml
allowed_tools:
  - brand_knowledge_search
  - campaign_history_search
  - performance_report_reader
forbidden_tools:
  - publisher_api
tool_usage_rules:
  - utiliser la recherche interne avant de conclure sur la marque
  - citer les sources internes utilisees dans la sortie
failure_behavior:
  - continuer en mode hypothese si la source est indisponible
  - marquer la confiance comme faible
```

## 13. Memoire

La memoire doit servir la strategie, pas encombrer le contexte.

Types de memoire :

- `brand_memory` : ton, promesses, interdits, offres.
- `audience_memory` : objections, langage, segments.
- `campaign_memory` : angles testes, contenus produits.
- `performance_memory` : resultats, patterns gagnants.
- `decision_memory` : arbitrages importants.

Chaque agent doit declarer :

- ce qu'il lit ;
- ce qu'il ecrit ;
- ce qu'il ne doit jamais memoriser ;
- quand oublier ou archiver.

Exemple :

```yaml
memory_policy:
  reads:
    - brand_memory
    - audience_memory
    - performance_memory
  writes:
    - discovered_objections
    - winning_emotional_patterns
  never_store:
    - donnees personnelles sensibles
    - hypotheses non marquees comme hypotheses
  retention:
    - archiver les campagnes obsoletes apres evaluation
```

## 14. Collaboration Entre Agents

La scalabilite depend des handoffs.
Chaque agent doit produire une sortie que le suivant peut utiliser sans reinterpretation floue.

Champs :

- `receives_from`
- `sends_to`
- `handoff_contract`
- `conflict_resolution`

Exemple :

```yaml
receives_from:
  - strategist
  - intake_agent
sends_to:
  - positioning_agent
  - hook_master
  - copywriter
handoff_contract:
  - fournir 3 tensions emotionnelles classees
  - fournir 5 phrases miroir de l'audience
  - fournir les objections principales
conflict_resolution:
  - si le positionnement contredit la psychologie audience, demander arbitrage au strategist
```

## 15. Modes D'Execution

Un agent robuste doit pouvoir fonctionner dans plusieurs modes.

Modes standards :

- `draft` : genere vite pour exploration.
- `deep_work` : analyse complete.
- `critic` : critique une sortie existante.
- `revision` : ameliore une sortie.
- `benchmark` : produit une sortie comparable pour eval.

Exemple :

```yaml
execution_modes:
  draft:
    max_depth: low
    expected_output: "3 angles rapides"
  deep_work:
    max_depth: high
    expected_output: "carte emotionnelle complete"
  critic:
    max_depth: medium
    expected_output: "faiblesses, risques, ameliorations"
```

## 16. Budget Et Limites D'Execution

Pour scaler, chaque agent doit etre controlable.

Champs :

- `max_iterations`
- `timeout_seconds`
- `max_tool_calls`
- `context_budget`
- `cost_tier`
- `fallback_model`

Exemple :

```yaml
execution_limits:
  max_iterations: 3
  timeout_seconds: 120
  max_tool_calls: 5
  context_budget: medium
  cost_tier: standard
  fallback_model: fast_strategic_model
```

## 17. Observabilite

Un agent important doit laisser des traces utiles.

Journaliser :

- version de l'agent ;
- inputs principaux ;
- outils utilises ;
- score de sortie ;
- niveau de confiance ;
- risques signales ;
- temps d'execution ;
- cout estime ;
- erreurs ;
- agent suivant.

Ne pas journaliser :

- donnees sensibles inutiles ;
- pensee interne longue ;
- secrets ;
- tokens ;
- identifiants prives.

Exemple :

```yaml
observability:
  log_level: standard
  trace_fields:
    - agent_id
    - version
    - campaign_id
    - quality_score
    - confidence_score
    - tools_used
    - risk_flags
```

## 18. Evaluation

Chaque agent doit avoir une facon d'etre teste.

Types de tests :

- test de structure : la sortie respecte le schema ;
- test de domaine : la sortie est pertinente ;
- test de non-banalite : la sortie n'est pas generique ;
- test de coherence : pas de contradiction avec le brief ;
- test de securite : pas de tactique interdite ;
- test de transfert : l'agent suivant peut utiliser la sortie ;
- test de regression : une nouvelle version ne fait pas pire.

Exemple :

```yaml
evaluation:
  golden_cases:
    - agency_lead_generation
    - coach_personal_brand
    - b2b_saas_launch
  must_pass:
    - output_schema_valid
    - no_fake_proof
    - no_generic_strategy
    - handoff_usable
  target_scores:
    quality_score_min: 8
    novelty_score_min: 7
    actionability_score_min: 8
```

## 19. Versioning

Chaque agent doit evoluer sans casser les workflows.

Regles :

- changer le prompt sans changer les outputs : version patch.
- changer la logique de decision : version minor.
- changer le schema de sortie : version major.
- deprecier un agent avant suppression.
- garder des exemples de sortie par version.

Exemple :

```yaml
versioning:
  current: 0.1.0
  changelog:
    - version: 0.1.0
      date: 2026-05-13
      changes:
        - creation initiale
```

## 20. Template Complet D'Agent

Ce template doit servir de base pour chaque nouvel agent.

```yaml
agent:
  agent_id: ""
  name: ""
  version: "0.1.0"
  status: "draft"
  owner: ""
  type: ""

  mission:
    statement: ""
    primary_question: ""
    success_definition: ""

  crewai_mapping:
    role: ""
    goal: ""
    backstory: ""
    llm: ""
    memory: false
    max_iter: 3
    verbose: false

  responsibility:
    owns: []
    does_not_own: []
    decision_rights: []
    handoff_to: []

  inputs:
    required: []
    optional: []
    missing_input_behavior: []

  outputs:
    format: "structured"
    schema_name: ""
    required_sections: []
    examples_path: ""

  reasoning:
    steps: []
    must_distinguish:
      - facts
      - hypotheses
      - recommendations

  quality:
    scoring_dimensions:
      - quality_score
      - confidence_score
      - novelty_score
      - actionability_score
      - risk_score
    minimum_quality_score: 8
    rejection_conditions: []

  guardrails:
    global: []
    domain_specific: []
    red_flags: []

  tools:
    allowed: []
    forbidden: []
    usage_rules: []
    failure_behavior: []

  memory_policy:
    reads: []
    writes: []
    never_store: []
    retention: []

  collaboration:
    receives_from: []
    sends_to: []
    handoff_contract: []
    conflict_resolution: []

  execution:
    modes:
      draft: {}
      deep_work: {}
      critic: {}
      revision: {}
      benchmark: {}
    limits:
      max_iterations: 3
      timeout_seconds: 120
      max_tool_calls: 5
      context_budget: "medium"
      cost_tier: "standard"
      fallback_model: ""

  observability:
    log_level: "standard"
    trace_fields: []
    metrics: []

  evaluation:
    golden_cases: []
    must_pass: []
    target_scores: {}

  versioning:
    current: "0.1.0"
    changelog: []
```

## 21. Template De Prompt Systeme

Chaque agent doit avoir un prompt systeme construit avec cette logique.

```text
Tu es {agent_name}.

MISSION
{mission_statement}

QUESTION CENTRALE
{primary_question}

TERRITOIRE
Tu possedes :
{owns}

Tu ne possedes pas :
{does_not_own}

METHODE
Tu dois :
{reasoning_steps}

QUALITE
Ta sortie doit etre :
- specifique ;
- actionnable ;
- structuree ;
- non generique ;
- utile pour l'agent suivant.

GARDE-FOUS
Tu dois respecter :
{guardrails}

SORTIE ATTENDUE
Tu dois produire exactement :
{output_schema}

AUTO-EVALUATION
Termine par :
- quality_score ;
- confidence_score ;
- weakest_point ;
- next_improvement.
```

## 22. Exemple Court - Agent Growth Hacker

```yaml
agent:
  agent_id: growth_hacker
  name: Growth Hacker
  version: "0.1.0"
  status: "draft"
  owner: "growth"
  type: "optimizer"

  mission:
    statement: >
      Transformer une strategie de contenu en mecanismes d'amplification,
      de conversation et de conversion.
    primary_question: >
      Quel mecanisme peut faire circuler ce message au-dela de sa publication initiale ?
    success_definition: >
      La sortie contient des tactiques concretes, mesurables, defendables
      et adaptees a Facebook ou LinkedIn.

  crewai_mapping:
    role: "Growth hacker strategique"
    goal: "Creer des boucles d'attention, d'engagement et de conversion"
    backstory: >
      Tu combines growth marketing, psychologie sociale, copywriting,
      experimentation rapide et strategie communautaire.
    memory: true
    max_iter: 3

  responsibility:
    owns:
      - tactiques growth
      - boucles de viralisation
      - hypotheses d'experimentation
      - mecanismes de conversion
    does_not_own:
      - textes finaux
      - validation juridique
      - publication automatique
    decision_rights:
      - recommander une tactique prioritaire
      - rejeter une idee trop faible ou trop risquee
    handoff_to:
      - strategist
      - experimentation_agent
      - copywriter

  inputs:
    required:
      - campaign_strategy
      - target_audience
      - platform
      - offer
    optional:
      - performance_data
      - existing_assets
      - brand_constraints
    missing_input_behavior:
      - marquer les hypotheses
      - reduire le confidence_score

  outputs:
    format: "structured"
    schema_name: "GrowthTacticPack"
    required_sections:
      - growth_diagnosis
      - tactic_list
      - viral_loop
      - conversion_path
      - risks
      - experiments

  quality:
    scoring_dimensions:
      - quality_score
      - novelty_score
      - actionability_score
      - risk_score
    minimum_quality_score: 8
    rejection_conditions:
      - tactique impossible a executer
      - tactique basee sur faux signaux
      - tactique trop generique
```

## 23. Checklist Avant Creation D'Un Agent

Avant d'ajouter un agent au projet :

- son role est unique ;
- sa mission tient en une phrase forte ;
- ses inputs sont connus ;
- sa sortie est structuree ;
- son score qualite est defini ;
- ses limites sont explicites ;
- ses outils sont justifies ;
- sa memoire est controlee ;
- son handoff est clair ;
- ses tests sont definis ;
- son mode degrade existe ;
- son cout potentiel est acceptable ;
- il ameliore vraiment le systeme.

## 24. Anti-Patterns A Eviter

Ne pas creer :

- un agent "Idees" qui fait tout ;
- un agent "Expert Marketing" sans territoire ;
- un agent "Creatif" qui produit sans contraintes ;
- un agent "Critique" qui critique sans proposer d'amelioration ;
- un agent "Growth" qui recommande du spam ;
- un agent "Strategiste" qui ecrit des posts finaux ;
- un agent "Copywriter" qui invente des preuves ;
- un agent "Audience" qui parle en generalites ;
- un agent "LinkedIn" qui recycle Facebook ;
- un agent "Facebook" qui recycle LinkedIn.

## 25. Principe Final

Un agent GOAT n'est pas celui qui parle le mieux.

C'est celui qui :

- pense dans un territoire precis ;
- produit une sortie exploitable ;
- augmente la qualite du workflow ;
- reduit le chaos ;
- laisse des traces ;
- peut etre teste ;
- peut etre remplace sans casser tout le systeme ;
- devient meilleur avec les donnees.

Formule :

> Persona forte + contrat strict + sortie structuree + evaluation continue = agent scalable.
