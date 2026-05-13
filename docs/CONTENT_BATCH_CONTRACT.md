# Content Batch Contract - Crew_System

## 1. Role Du Document

Ce document definit comment Crew_System doit generer des lots de contenus a la demande.

Un Content Batch est un livrable produit apres la creation d'un projet, d'une strategie et d'un calendrier editorial.

Exemples :

- 70 publications Facebook pour une semaine precise ;
- 35 publications LinkedIn pour une semaine ;
- 20 scripts video courts pour un mois ;
- 50 hooks pour une campagne ;
- 12 carrousels LinkedIn ;
- 30 briefs visuels ;
- 1 mois complet de contenus Facebook + LinkedIn + videos ;
- une sequence growth avec posts, commentaires, DM et lead magnet.

Le Content Batch ne remplace pas le Campaign Pack.
Il s'appuie dessus.

Regle centrale :

> Un Content Batch n'est jamais une generation directe. C'est une production orchestree a partir de la memoire strategique du projet.

## 2. Difference Entre Campaign Pack Et Content Batch

Le Campaign Pack construit la base.

Il contient :

- strategie ;
- positionnement ;
- audience ;
- architecture d'influence ;
- calendrier editorial annuel ;
- strategie plateformes ;
- growth system ;
- direction creative ;
- contraintes ;
- fichiers de reference.

Le Content Batch produit une quantite precise de contenus.

Il contient :

- contenus finaux ;
- hooks ;
- CTA ;
- briefs visuels ;
- scripts video si demandes ;
- scoring par contenu ;
- mapping vers le calendrier ;
- justification strategique ;
- variantes ;
- fichiers exportes.

Formule :

```text
Campaign Pack = cerveau strategique durable
Content Batch = production massive controlee a partir du cerveau
```

## 3. Experience Utilisateur

L'utilisateur peut demander naturellement :

```text
Base-toi sur le projet coach_saas.
Genere les contenus Facebook de la semaine 4.
Je veux 70 publications.
Ajoute un visuel quand c'est utile.
Je ne veux pas encore de video.
```

Ou :

```text
Prends la strategie annuelle du projet immobilier_premium.
Genere tout le contenu LinkedIn du mois 2.
Je veux des posts, des carrousels et des scripts video courts.
```

Le systeme doit alors :

1. Identifier le projet.
2. Lire les documents strategiques.
3. Lire le calendrier annuel.
4. Localiser la periode demandee.
5. Construire un plan de production.
6. Selectionner les agents.
7. Generer les contenus.
8. Faire passer chaque contenu par critique.
9. Scorer chaque contenu.
10. Ajouter les visuels ou videos selon besoin.
11. Ecrire les fichiers.
12. Resumer le resultat dans le chat.

## 4. Principes Non Negociables

### 4.1 Lire Avant De Produire

Le systeme doit relire les fichiers du projet avant toute generation.

Interdit :

- produire a partir de la memoire conversationnelle seule ;
- ignorer le calendrier annuel ;
- ignorer le positionnement ;
- ignorer les contraintes ;
- ignorer les sorties precedentes si elles existent.

### 4.2 Un Contenu Est Une Decision Collective

Pour un contenu important, le systeme doit consulter plusieurs agents.

Minimum :

- Strategist ;
- Audience Psychologist ;
- Platform Native Agent ;
- Hook Master ;
- Copywriter ;
- Anti-Banality Agent.

Selon le besoin :

- Growth Hacker ;
- Influence Architect ;
- Creative Director ;
- Video Agent ;
- Risk Reviewer ;
- Experimentation Agent.

### 4.3 Quantite Sans Dilution

Produire 70 publications ne doit pas signifier produire 70 variations faibles.

Le batch doit organiser la quantite par :

- themes ;
- angles ;
- formats ;
- objectifs ;
- intensites ;
- phases de sequence ;
- mecanismes growth ;
- plateformes.

### 4.4 Visuels Quand Ils Servent

Un visuel n'est pas automatique.

Le systeme doit choisir :

- aucun visuel ;
- image simple ;
- carrousel ;
- infographie ;
- miniature ;
- template ;
- avant/apres ;
- preuve visuelle ;
- concept video.

Un visuel est requis seulement s'il augmente :

- l'arret du scroll ;
- la comprehension ;
- la preuve ;
- le partage ;
- la memorisation ;
- la conversion.

### 4.5 Video Sur Demande Ou Opportunite Forte

La video doit etre produite si :

- l'utilisateur l'a demandee ;
- le calendrier annuel la prevoit ;
- le format est clairement plus fort en video ;
- le batch cible une campagne video.

Sinon, le systeme peut seulement proposer une opportunite video.

### 4.6 Pas De Contenu Hors Strategie

Chaque contenu doit etre rattache a :

- une semaine ou une periode ;
- un objectif ;
- un angle ;
- une tension emotionnelle ;
- un message systeme ;
- un format ;
- un CTA ;
- une raison d'exister.

## 5. Types De Content Batch

```yaml
content_batch_types:
  weekly_platform_batch:
    example: "70 posts Facebook pour la semaine 4"
  monthly_platform_batch:
    example: "1 mois de posts LinkedIn"
  cross_platform_weekly_batch:
    example: "Facebook + LinkedIn semaine 8"
  video_batch:
    example: "20 scripts video pour le mois 3"
  visual_batch:
    example: "30 briefs visuels pour la campagne Q2"
  hook_bank:
    example: "100 hooks pour le lancement"
  carousel_batch:
    example: "12 carrousels LinkedIn"
  growth_sequence_batch:
    example: "sequence post -> commentaire -> ressource -> DM"
  revision_batch:
    example: "ameliorer les 70 posts deja generes"
```

## 6. Inputs D'Un Content Batch

### 6.1 Inputs Obligatoires

```yaml
batch_request:
  project_slug: string
  batch_type: string
  platforms: list[facebook | linkedin]
  period:
    type: week | month | quarter | custom
    week_number: int
    month_number: int
    date_range: string
  volume:
    total_items: int
    per_platform: object
  content_formats: list[string]
  visual_policy: none | when_useful | required
  video_policy: none | when_useful | required
  output_format: markdown | json | both
```

### 6.2 Inputs Optionnels

```yaml
optional_batch_inputs:
  tone_adjustment: string
  aggression_level: low | medium | high
  premium_level: low | medium | high
  taboo_topics: list[string]
  mandatory_topics: list[string]
  assets_to_use: list[string]
  previous_batch_to_avoid: string
  content_to_revise: list[string]
  special_campaign_goal: string
  approval_requirements: list[string]
```

### 6.3 Comportement Si Input Manquant

Si le projet est ambigu :

- demander clarification.

Si le volume manque :

- proposer un volume coherent avec la periode.

Si la periode manque :

- demander la semaine ou le mois.

Si la strategie projet manque :

- refuser la generation directe et proposer de creer d'abord le Campaign Pack.

## 7. Context Loading Contract

Avant de generer, le systeme doit charger un contexte minimal.

```yaml
context_loading:
  required_files:
    - project README
    - normalized brief
    - strategic diagnosis
    - audience intelligence
    - positioning
    - influence architecture
    - growth system
    - annual editorial calendar
    - platform strategy
    - visual direction if visual_policy != none
    - video strategy if video_policy != none
    - risk review
  optional_files:
    - previous outputs
    - performance reports
    - user edits
    - brand examples
    - competitor references
```

Le systeme doit produire un `context_snapshot` avant generation.

```yaml
context_snapshot:
  project_slug: string
  loaded_files: list[string]
  missing_files: list[string]
  selected_period: string
  relevant_strategy_points: list[string]
  relevant_constraints: list[string]
  confidence_score: int
```

Regle :

Si les fichiers strategiques critiques manquent, la generation doit s'arreter.

## 8. Plan De Production

Avant les contenus, le systeme doit creer un plan de production.

```yaml
production_plan:
  batch_id: string
  project_slug: string
  target_period: string
  total_items: int
  platforms:
    facebook:
      total_items: int
      formats: list[string]
    linkedin:
      total_items: int
      formats: list[string]
  distribution:
    by_objective: object
    by_format: object
    by_emotional_trigger: object
    by_growth_mechanism: object
  agent_plan:
    agents_to_run: list[string]
    order: list[string]
    parallelizable_groups: list[list[string]]
  files_to_write: list[string]
```

Le plan doit eviter :

- trop de posts avec le meme hook ;
- trop de posts avec le meme CTA ;
- trop de contenus sur la meme douleur ;
- trop de contenus sans proof element ;
- trop de contenus sans variation de format.

## 9. Distribution Pour 70 Publications Facebook

Pour une demande type :

```text
70 publications Facebook pour une semaine
```

Le systeme doit proposer une distribution, puis produire.

Distribution recommandee :

```yaml
facebook_70_distribution:
  emotional_story_posts: 10
  short_punch_posts: 10
  question_posts: 8
  proof_or_case_posts: 8
  objection_breaker_posts: 8
  educational_posts: 8
  growth_prompt_posts: 6
  visual_caption_posts: 6
  community_posts: 4
  recap_or_transition_posts: 2
```

Cette distribution peut changer selon :

- objectif de la semaine ;
- maturite de l'audience ;
- campagne en cours ;
- besoin de conversion ;
- niveau de preuve disponible.

Regle :

70 posts ne veut pas dire 10 posts par jour par defaut.
Le batch est une banque de contenus organisee que l'utilisateur peut utiliser, planifier, trier ou adapter.

## 10. Distribution Pour LinkedIn

LinkedIn doit etre moins "volume brut" et plus "densite strategique".

Exemple pour 35 posts LinkedIn :

```yaml
linkedin_35_distribution:
  contrarian_opinion: 5
  business_story: 5
  framework: 5
  mistake_or_lesson: 5
  case_or_proof: 4
  market_analysis: 4
  authority_post: 3
  conversion_post: 2
  discussion_prompt: 2
```

Regle :

LinkedIn doit proteger :

- autorite ;
- credibilite ;
- nuance ;
- progression professionnelle ;
- densite d'insight.

## 11. Content Unit Contract

Chaque contenu du batch doit suivre un contrat commun.

```yaml
content_unit:
  id: string
  batch_id: string
  project_slug: string
  platform: facebook | linkedin
  period_ref:
    week_number: int
    month_number: int
    calendar_theme: string
  strategic_ref:
    campaign_angle: string
    message_system_ref: string
    audience_segment: string
    emotional_trigger: string
    belief_shift: string
    growth_mechanism: string
  content:
    format: string
    hook: string
    body: string
    cta: string
    hashtags: list[string]
  creative:
    visual_needed: boolean
    visual_brief_id: string
    video_needed: boolean
    video_script_id: string
  quality:
    quality_score: int
    hook_score: int
    platform_fit_score: int
    strategic_fit_score: int
    novelty_score: int
    risk_score: int
  review:
    status: draft | needs_revision | ready_for_human_review | approved_by_human | rejected | archived
    why_it_should_work: string
    weakest_point: string
    required_improvement: string
```

## 12. Facebook Content Unit

```yaml
facebook_content_unit:
  id: string
  format: short_post | story | question | community_prompt | proof | objection_breaker | visual_caption | growth_prompt
  hook: string
  body: string
  cta: string
  emotional_trigger: string
  expected_reaction: string
  comment_mechanism: string
  dm_path: string
  visual_needed: boolean
  visual_brief: string
  score: int
```

Rules :

- ton humain ;
- emotion claire ;
- CTA conversationnel ;
- pas de jargon corporate ;
- pas de copie LinkedIn ;
- une idee principale par post ;
- longueur adaptee au format.

## 13. LinkedIn Content Unit

```yaml
linkedin_content_unit:
  id: string
  format: opinion | story | framework | case_study | lesson | analysis | contrarian | carousel_prompt
  hook: string
  body: string
  cta: string
  business_insight: string
  proof_element: string
  authority_signal: string
  saveability_reason: string
  visual_or_carousel_needed: boolean
  score: int
```

Rules :

- point de vue clair ;
- insight business ;
- structure lisible ;
- preuve ou raisonnement solide ;
- pas de promesse creuse ;
- CTA sobre ;
- pas de copie Facebook.

## 14. Video Script Unit

Si la video est demandee ou justifiee :

```yaml
video_script_unit:
  id: string
  linked_content_id: string
  platform: facebook | linkedin | cross_platform
  duration_target_seconds: int
  hook_3_seconds: string
  script:
    intro: string
    development: string
    payoff: string
    cta: string
  scenes:
    - scene_number: int
      visual: string
      narration: string
      on_screen_text: string
      retention_device: string
  subtitle_notes: string
  thumbnail_brief: string
  production_effort: low | medium | high
  quality_score: int
```

Rules :

- hook immediat ;
- une seule idee ;
- payoff clair ;
- sous-titres prevus ;
- miniature pensee ;
- effort de production indique.

## 15. Visual Brief Unit

```yaml
visual_brief_unit:
  id: string
  linked_content_id: string
  platform: facebook | linkedin | cross_platform
  visual_type: image | carousel | infographic | quote_card | before_after | thumbnail | template
  strategic_role: string
  concept: string
  text_overlay: string
  composition: string
  mood: string
  production_notes: string
  must_include: list[string]
  avoid: list[string]
  quality_score: int
```

Rules :

- le visuel sert le message ;
- pas de decoration gratuite ;
- texte court ;
- concept realisable ;
- coherence avec la marque ;
- utilite claire pour l'utilisateur.

## 16. Agent Consultation Matrix

Le systeme doit choisir les agents selon le type de contenu.

```yaml
agent_consultation_matrix:
  every_batch:
    - strategist
    - calendar_architect
    - anti_banality_agent
  every_content:
    - audience_psychologist
    - platform_native_agent
    - hook_master
    - copywriter
  growth_content:
    - growth_hacker
    - influence_architect
  visual_content:
    - creative_director
  video_content:
    - video_agent
    - creative_director
  high_risk_content:
    - risk_reviewer
  final_batch_review:
    - strategist
    - anti_banality_agent
```

Regle :

Le systeme peut grouper les consultations pour scaler.
Il n'a pas besoin de relancer tous les agents completement pour chaque post, mais chaque contenu doit heriter des decisions de ces agents.

## 17. Per-Content Generation Chain

Pour chaque contenu :

```text
1. Lire le theme de periode
2. Choisir l'objectif du contenu
3. Choisir l'audience ou le segment
4. Choisir la tension emotionnelle
5. Choisir l'angle
6. Choisir le mecanisme growth si utile
7. Generer hooks
8. Selectionner hook
9. Rediger contenu
10. Decider visuel ou video
11. Critiquer
12. Ameliorer
13. Scorer
14. Ajouter au batch
```

## 18. Variation System

Un batch massif doit eviter la monotonie.

Variations obligatoires :

- hook type ;
- longueur ;
- emotion ;
- angle ;
- CTA ;
- format ;
- intensite ;
- niveau de preuve ;
- role dans la sequence.

```yaml
variation_targets:
  hook_types:
    - contradiction
    - confession
    - diagnostic
    - status
    - fear
    - desire
    - proof
    - curiosity
  cta_types:
    - comment
    - save
    - share
    - dm
    - question
    - diagnostic
    - resource
  intensity_levels:
    - soft
    - medium
    - aggressive
```

## 19. Growth Integration

Chaque batch doit contenir des mecanismes growth si l'objectif le permet.

Mecanismes possibles :

- commentaire mot-cle ;
- ressource utile ;
- mini-diagnostic ;
- template ;
- challenge ;
- serie recurrente ;
- question communautaire ;
- appel a temoignages ;
- collaboration ;
- post reponse a objections ;
- boucle contenu -> commentaire -> ressource -> conversation.

Schema :

```yaml
growth_integration:
  batch_growth_goal: string
  primary_mechanism: string
  content_ids_using_mechanism: list[string]
  required_assets: list[string]
  expected_user_behavior: string
  measurement: list[string]
  risk_level: low | medium | high
```

## 20. Manipulation De Perception

Chaque batch doit expliciter le mouvement de perception.

```yaml
perception_manipulation:
  old_belief: string
  new_belief: string
  emotional_path:
    - attention
    - tension
    - identification
    - proof
    - desire
    - action
  repeated_phrases: list[string]
  forbidden_distortions: list[string]
```

Regle :

Le systeme peut manipuler la perception par cadrage, contraste, tension, preuve, repetition et desir.
Il ne doit pas manipuler par faux temoignage, fausse preuve, fausse urgence ou promesse impossible.

## 21. Quality Gates

### Gate 1 - Context Gate

Le batch ne demarre pas si :

- projet introuvable ;
- calendrier annuel absent ;
- positionnement absent ;
- audience non definie ;
- plateforme non definie.

### Gate 2 - Production Plan Gate

Le batch ne produit pas si :

- distribution incoherente ;
- volume impossible ;
- formats non alignes ;
- besoin video/visuel flou ;
- agents requis non selectionnes.

### Gate 3 - Content Gate

Chaque contenu doit avoir :

- objectif ;
- angle ;
- hook ;
- corps ;
- CTA ;
- justification ;
- score ;
- statut.

### Gate 4 - Batch Diversity Gate

Le batch doit verifier :

- pas trop de repetitions ;
- angles varies ;
- CTA varies ;
- formats varies ;
- intensites variees ;
- pas de duplication cachee.

### Gate 5 - Final Review Gate

Avant export :

- score global minimum 8 ;
- contenus sous 7 retires ou revises ;
- risques signales ;
- fichiers ecrits ;
- resume final pret.

## 22. Scoring

Chaque contenu est score.

```yaml
content_scoring:
  quality_score: int
  hook_score: int
  strategic_fit_score: int
  audience_fit_score: int
  platform_fit_score: int
  emotional_power_score: int
  growth_potential_score: int
  originality_score: int
  clarity_score: int
  risk_score: int
```

Regles :

- score sous 7 : contenu rejete ou revise ;
- 7 a 8 : utilisable mais faible ;
- 8 a 9 : solide ;
- 9 a 10 : prioritaire dans le batch.

Batch scoring :

```yaml
batch_scoring:
  global_score: int
  average_content_score: float
  diversity_score: int
  strategy_alignment_score: int
  platform_fit_score: int
  growth_strength_score: int
  production_readiness_score: int
```

## 23. Duplicate And Banalite Control

Le systeme doit detecter :

- hooks trop proches ;
- posts qui disent la meme chose ;
- CTA repetes ;
- phrases generiques ;
- promesses vagues ;
- contenus qui sonnent IA ;
- contenus sans tension ;
- contenus sans raison d'exister.

```yaml
duplicate_control:
  similar_hook_threshold: float
  repeated_cta_limit: int
  repeated_angle_limit: int
  generic_phrase_blacklist: list[string]
  action_if_detected: revise | remove | merge
```

## 24. Risk Review

Risques a verifier :

- promesse excessive ;
- preuve absente ;
- chiffre non source ;
- bad buzz possible ;
- polarisation trop destructrice ;
- confusion avec une publication officielle ;
- CTA trop agressif ;
- contenu sensible ;
- croissance obtenue par bruit plutot que valeur.

Le systeme doit produire :

```yaml
risk_review:
  batch_risk_level: low | medium | high
  content_risks:
    - content_id: string
      risk: string
      mitigation: string
  rejected_items: list[string]
```

## 25. Output Files

Chaque Content Batch doit produire des fichiers propres.

Structure recommandee :

```text
projects/
  {project_slug}/
    outputs/
      batches/
        {batch_id}/
          README.md
          content_batch.md
          content_batch.json
          visual_briefs.md
          video_scripts.md
          quality_review.md
          production_plan.json
          agent_run_summary.md
```

Regles :

- `README.md` resume le batch ;
- `content_batch.md` est lisible par humain ;
- `content_batch.json` est exploitable par machine ;
- les visuels sont separes si nombreux ;
- les videos sont separees si nombreuses ;
- les scores sont conserves ;
- le batch doit avoir un id stable.

## 26. Markdown Output Standard

```markdown
# Content Batch - {batch_name}

## 1. Resume
## 2. Contexte Charge
## 3. Plan De Production
## 4. Strategie De La Periode
## 5. Distribution Des Contenus
## 6. Contenus
## 7. Briefs Visuels
## 8. Scripts Video
## 9. Mecanismes Growth
## 10. Scoring
## 11. Risques
## 12. Recommandations D'Utilisation
```

Pour les 70 posts, la section contenus doit etre groupee par :

- objectif ;
- format ;
- jour suggere ;
- intensite ;
- ou mecanisme growth.

## 27. JSON Output Standard

```yaml
content_batch:
  metadata: {}
  request: {}
  context_snapshot: {}
  production_plan: {}
  period_strategy: {}
  perception_manipulation: {}
  items: []
  visual_briefs: []
  video_scripts: []
  growth_integration: {}
  quality_review: {}
  risk_review: {}
  file_outputs: []
```

Regles :

- tous les contenus ont un `id` ;
- tous les contenus referencent le `batch_id` ;
- les scores sont des entiers de 0 a 10 ;
- les statuts sont explicites ;
- les hypotheses sont marquees ;
- les liens vers les visuels/videos sont stables.

## 28. Background Job Lifecycle

Un batch massif doit etre un job.

Le lifecycle technique du job doit suivre `RUNTIME_ORCHESTRATION_CONTRACT.md`.

Les phases metier specifiques a un Content Batch sont :

```yaml
batch_job_phases:
  loading_context
  selecting_period
  planning_batch
  running_strategy_agents
  generating_content
  generating_visual_briefs
  generating_video_scripts
  reviewing_quality
  reviewing_risk
  writing_files
```

Le chat doit pouvoir afficher :

```text
Je relis le projet.
Je construis le plan des 70 posts.
Je genere les hooks.
Je fais passer les contenus par Anti-Banality.
J'ecris les fichiers finaux.
```

## 29. Revision Contract

L'utilisateur peut demander :

```text
Refais les posts 12 a 25 en plus agressif.
Garde la strategie mais change les hooks.
Ajoute des visuels aux posts les plus forts.
Retire les posts trop similaires.
```

Le systeme doit :

- lire le batch existant ;
- identifier les items concernes ;
- conserver les ids ou creer des ids de revision ;
- expliquer ce qui change ;
- ecrire une nouvelle version.

```yaml
revision:
  source_batch_id: string
  revision_id: string
  changed_items: list[string]
  unchanged_items: list[string]
  change_reason: string
  output_version: string
```

## 30. Human Review Status

Chaque contenu doit avoir un statut.

```yaml
review_status:
  draft: "sortie initiale"
  needs_revision: "doit etre retravaille"
  ready_for_human_review: "pret a etre relu par utilisateur"
  approved_by_human: "valide manuellement"
  rejected: "refuse"
  archived: "conserve mais non utilise"
```

Regle :

Le systeme ne doit pas considerer un contenu comme publie ou approuve sans action humaine.

## 31. Example Mini Batch

```yaml
content_batch:
  metadata:
    batch_id: "batch_coach_saas_w04_fb_70"
    project_slug: "coach_saas"
    batch_type: "weekly_platform_batch"
    platform: "facebook"
    total_items: 70
    status: "ready_for_human_review"

  context_snapshot:
    selected_period: "week_04"
    loaded_files:
      - "strategy/positioning.md"
      - "strategy/audience_intelligence.md"
      - "calendar/annual_editorial_calendar.md"
      - "platforms/facebook_strategy.md"
    confidence_score: 8

  production_plan:
    distribution:
      emotional_story_posts: 10
      short_punch_posts: 10
      question_posts: 8
      proof_or_case_posts: 8
      objection_breaker_posts: 8
      educational_posts: 8
      growth_prompt_posts: 6
      visual_caption_posts: 6
      community_posts: 4
      recap_or_transition_posts: 2

  items:
    - id: "fb_w04_001"
      platform: "facebook"
      format: "growth_prompt"
      hook: "Vos clients ne quittent pas toujours votre coaching. Parfois, ils quittent votre silence."
      body: "..."
      cta: "Commentez SUIVI si vous voulez la grille d'auto-diagnostic."
      visual_needed: true
      visual_brief_id: "vis_fb_w04_001"
      quality_score: 9
```

## 32. Conditions De Rejet

Un Content Batch doit etre rejete si :

- il n'a pas relu les fichiers strategiques ;
- il ignore le calendrier annuel ;
- il produit des contenus sans objectifs ;
- il repete trop les memes hooks ;
- il copie Facebook vers LinkedIn ;
- il ne score pas les contenus ;
- il ne detecte pas les doublons ;
- il ne signale pas les risques ;
- il ajoute des visuels decoratifs sans role ;
- il genere des videos sans structure ;
- il ne produit pas de fichiers exploitables ;
- il ne donne pas de resume final clair.

## 33. Definition De Done

Un Content Batch est termine quand :

- le projet est identifie ;
- le contexte est charge ;
- la periode est localisee ;
- le plan de production est cree ;
- les agents requis sont consultes ;
- chaque contenu a un objectif ;
- chaque contenu est rattache a la strategie ;
- chaque contenu est score ;
- les visuels utiles sont briefes ;
- les videos demandees sont scriptes ;
- les doublons sont reduits ;
- les risques sont signales ;
- les fichiers Markdown et JSON sont ecrits ;
- le chat donne un resume clair a l'utilisateur.

## 34. Principe Final

Le Content Batch est la preuve que Crew_System peut transformer sa memoire strategique en production massive sans devenir generique.

Formule :

> Documents projet + calendrier annuel + agents specialises + critique stricte + fichiers propres = contenu massif coherent.

