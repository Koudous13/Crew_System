# Campaign Pack Contract - Crew_System

## 1. Role Du Document

Ce document definit le livrable strategique que Crew_System doit produire et maintenir dans les fichiers d'un projet.

Le systeme ne doit pas seulement "generer du contenu".
Il doit produire une base strategique persistante, exploitable, testee, scoree et reutilisable par les futures demandes de l'utilisateur.

Ce fichier sert de contrat entre :

- les agents ;
- les workflows ;
- les schemas de donnees ;
- les prompts ;
- les tests ;
- les futurs exports Markdown, JSON ou dashboard.

Question centrale :

> A quoi ressemble une campagne GOAT produite par Crew_System ?

Si un agent produit quelque chose qui ne peut pas entrer dans ce contrat, sa sortie est incomplete ou hors-scope.

Important :

Le Campaign Pack initial n'a pas pour but principal de produire tous les contenus prets a publier.
Son premier role est de creer la base strategique et le calendrier editorial annuel sur lesquels le systeme pourra ensuite s'appuyer pour produire des semaines, mois ou campagnes de contenus.

## 2. Definition D'Un Campaign Pack

Un Campaign Pack est un dossier strategique complet qui transforme un brief business en systeme de communication durable.

Il contient :

- le diagnostic ;
- l'audience ;
- la tension emotionnelle ;
- le positionnement ;
- la big idea ;
- les angles ;
- les messages ;
- les contenus Facebook ;
- les contenus LinkedIn ;
- les hooks ;
- les scripts video ;
- les concepts visuels ;
- les tactiques growth ;
- le calendrier editorial annuel ;
- les tests ;
- le calendrier ;
- les scores ;
- les risques ;
- les prochaines iterations.

Le Campaign Pack n'est pas :

- un simple calendrier de posts ;
- une liste d'idees ;
- une collection de textes non relies ;
- une sortie IA jolie mais vague ;
- un document de publication automatique ;
- un substitut a la validation humaine.

Le Campaign Pack est :

- une strategie argumentee ;
- une architecture d'influence ;
- un systeme de messages ;
- une memoire projet ;
- un calendrier editorial long terme ;
- un plan d'experimentation ;
- un actif reutilisable.

## 3. Principes Non Negociables

Chaque Campaign Pack doit respecter ces principes.

### 3.1 Strategie Avant Contenu

Le contenu ne vient jamais en premier.

Ordre obligatoire :

1. Comprendre l'objectif business.
2. Comprendre l'audience.
3. Trouver la tension.
4. Formuler le positionnement.
5. Choisir la big idea.
6. Construire les angles.
7. Produire les contenus.
8. Designer les mecanismes growth.
9. Tester.
10. Iterer.

### 3.2 Une Campagne Doit Changer Une Perception

Une campagne faible dit :

> Voici notre offre.

Une campagne forte installe :

> Vous regardiez le probleme de la mauvaise facon. Voici la lecture qui rend notre offre evidente.

Chaque Campaign Pack doit definir la perception a modifier.

### 3.3 Native Platform Thinking

Facebook et LinkedIn ne doivent pas recevoir le meme contenu copie-colle.

Le systeme doit produire :

- une big idea commune ;
- une adaptation native Facebook ;
- une adaptation native LinkedIn ;
- des CTA differents si necessaire ;
- des formats differents si necessaire.

### 3.4 Preuve Avant Promesse Forte

Plus la promesse est forte, plus la preuve doit etre forte.

Toute promesse doit etre rattachee a :

- un exemple ;
- une observation ;
- un cas client ;
- une demonstration ;
- une experience ;
- un chiffre source ;
- une preuve sociale verifiable ;
- ou etre marquee comme hypothese.

### 3.5 Growth Sans Bruit

Le growth hacking n'est pas le spam.

Une tactique growth doit creer :

- plus d'attention qualifiee ;
- plus de conversation ;
- plus de partage ;
- plus de memorisation ;
- plus de conversion ;
- ou plus d'apprentissage.

Si une tactique cree seulement du bruit, elle est rejetee.

### 3.6 Validation Humaine Obligatoire

Le Campaign Pack est fait pour proposer, pas pour publier automatiquement.

Chaque contenu doit pouvoir etre :

- relu ;
- modifie ;
- valide ;
- refuse ;
- archive ;
- recycle.

## 4. Inputs Du Campaign Pack

Le systeme doit recevoir un brief clair.

### 4.1 Inputs Obligatoires

```yaml
required_inputs:
  business_name: string
  business_context: string
  offer: string
  target_audience: string
  campaign_objective: string
  platforms:
    - facebook
    - linkedin
  desired_action: string
  brand_voice: string
  constraints: list[string]
```

### 4.2 Inputs Fortement Recommandes

```yaml
recommended_inputs:
  current_positioning: string
  competitors: list[string]
  previous_posts: list[string]
  best_performing_content: list[string]
  worst_performing_content: list[string]
  customer_reviews: list[string]
  proof_assets: list[string]
  product_details: string
  price_or_offer_structure: string
  target_market_context: string
  founder_story: string
```

### 4.3 Inputs Optionnels

```yaml
optional_inputs:
  campaign_duration_days: int
  content_volume_target: int
  visual_assets_available: list[string]
  video_assets_available: list[string]
  forbidden_topics: list[string]
  mandatory_claims: list[string]
  legal_constraints: list[string]
  performance_data: object
  community_feedback: list[string]
```

### 4.4 Comportement Si Input Manquant

Si une information manque, le systeme doit :

- le signaler ;
- formuler une hypothese explicite ;
- baisser le confidence_score ;
- eviter les preuves inventees ;
- produire une version utilisable mais marquee comme incomplete.

Exemple :

```yaml
missing_input_handling:
  missing: "customer_reviews"
  impact: "moins de verbatims reels et moins de precision emotionnelle"
  assumption: "l'audience exprime probablement une frustration liee a la visibilite"
  confidence_penalty: -1
```

## 5. Structure Globale Du Campaign Pack

Chaque pack doit suivre cette structure.

```yaml
campaign_pack:
  metadata: {}
  brief_summary: {}
  strategic_diagnosis: {}
  audience_intelligence: {}
  positioning: {}
  influence_architecture: {}
  big_idea: {}
  message_system: {}
  platform_strategy:
    facebook: {}
    linkedin: {}
  annual_editorial_calendar: {}
  content_assets:
    facebook_posts: []
    linkedin_posts: []
    hooks: []
    video_scripts: []
    visual_concepts: []
    carousel_concepts: []
  growth_system: {}
  experimentation_plan: {}
  editorial_calendar: {}
  project_file_plan: {}
  quality_review: {}
  risk_review: {}
  learning_loop: {}
  final_recommendation: {}
```

## 6. Metadata

Objectif :
Identifier la campagne et tracer sa version.

Schema :

```yaml
metadata:
  campaign_id: string
  campaign_name: string
  version: string
  created_at: string
  owner: string
  status: draft | ready_for_review | approved | rejected | archived
  platforms:
    - facebook
    - linkedin
  campaign_duration_days: int
  source_brief_id: string
```

Regles :

- `campaign_id` doit etre stable.
- `version` suit le format semver.
- `status` ne doit jamais etre `approved` sans validation humaine.

## 7. Brief Summary

Objectif :
Resumer le brief sans le deformer.

Schema :

```yaml
brief_summary:
  business: string
  offer: string
  audience: string
  objective: string
  desired_action: string
  constraints: list[string]
  assumptions: list[string]
  missing_information: list[string]
```

Critere de qualite :

Le client doit pouvoir lire cette section et dire :

> Oui, le systeme a compris le contexte.

## 8. Strategic Diagnosis

Objectif :
Identifier le vrai probleme de communication.

Schema :

```yaml
strategic_diagnosis:
  current_problem: string
  hidden_problem: string
  market_noise: list[string]
  strategic_opportunity: string
  perception_to_change: string
  decision_to_trigger: string
  strongest_leverage: string
  diagnosis_confidence_score: int
```

Definitions :

- `current_problem` : probleme visible.
- `hidden_problem` : probleme plus profond qui bloque la performance.
- `market_noise` : messages banals que tout le monde utilise.
- `strategic_opportunity` : espace ou la marque peut devenir differente.
- `perception_to_change` : croyance a transformer.
- `decision_to_trigger` : action psychologique ou business attendue.

Questions obligatoires :

- Pourquoi l'audience n'agit-elle pas deja ?
- Quelle croyance la retient ?
- Quel message concurrent rend le marche confus ?
- Quel angle peut creer un declic ?

## 9. Audience Intelligence

Objectif :
Comprendre l'audience comme un humain, pas comme une categorie marketing.

Schema :

```yaml
audience_intelligence:
  primary_segment: string
  secondary_segments: list[string]
  visible_pains: list[string]
  hidden_pains: list[string]
  ambitions: list[string]
  fears: list[string]
  frustrations: list[string]
  objections: list[string]
  beliefs_to_shift: list[string]
  identity_desires: list[string]
  status_desires: list[string]
  language_patterns: list[string]
  trigger_phrases: list[string]
  emotional_tension:
    label: string
    explanation: string
    intensity_score: int
  confidence_score: int
```

Regle :

Cette section doit fournir de la matiere aux hooks, au storytelling, au positionnement et au growth.

Rejet automatique si :

- l'audience est decrite trop largement ;
- les douleurs sont generiques ;
- aucune tension emotionnelle n'est claire ;
- le langage ne ressemble pas a celui de l'audience.

## 10. Positioning

Objectif :
Transformer l'offre en position claire, differenciante et desirable.

Schema :

```yaml
positioning:
  category: string
  enemy: string
  old_belief: string
  new_belief: string
  unique_mechanism: string
  core_promise: string
  proof_required: list[string]
  proof_available: list[string]
  positioning_statement: string
  one_liner: string
  anti_positioning: list[string]
```

Definitions :

- `enemy` : croyance, comportement ou approche a combattre.
- `old_belief` : ce que l'audience croit avant la campagne.
- `new_belief` : ce que la campagne doit installer.
- `unique_mechanism` : raison specifique qui rend l'approche differente.
- `anti_positioning` : phrases et angles interdits car trop banals.

Critere GOAT :

Le positionnement doit pouvoir etre retenu en une phrase.

## 11. Influence Architecture

Objectif :
Designer le chemin psychologique de la campagne.

Schema :

```yaml
influence_architecture:
  attention_trigger: string
  emotional_trigger: string
  belief_shift: string
  proof_path: string
  trust_builder: string
  desire_builder: string
  action_trigger: string
  social_reason_to_engage: string
  central_manipulation_of_perception: string
  ethical_boundary: string
```

Explication :

Cette section dit comment la campagne manipule la perception.

Elle ne doit pas manipuler par le faux.
Elle doit orienter l'attention, les emotions, les croyances et le desir vers une lecture plus forte du probleme.

Questions obligatoires :

- Que doit ressentir la personne en premier ?
- Quelle idee doit rester dans sa tete ?
- Quelle preuve transforme l'interet en confiance ?
- Quelle raison sociale lui donne envie de commenter, partager ou sauvegarder ?
- Quelle limite ne doit pas etre franchie ?

## 12. Big Idea

Objectif :
Formuler l'idee centrale qui porte la campagne.

Schema :

```yaml
big_idea:
  title: string
  statement: string
  why_it_matters: string
  why_now: string
  emotional_core: string
  contrarian_edge: string
  memorability_factor: string
  campaign_slogan_options: list[string]
```

Une bonne big idea :

- est simple ;
- est tendue ;
- change la lecture du probleme ;
- peut vivre sur plusieurs posts ;
- peut devenir une serie ;
- peut etre expliquee vite ;
- donne envie d'en savoir plus.

Mauvaise big idea :

- "ameliorer votre communication" ;
- "developper votre visibilite" ;
- "booster votre presence digitale" ;
- "gagner plus de clients grace aux reseaux sociaux".

## 13. Message System

Objectif :
Definir le systeme de messages de la campagne.

Schema :

```yaml
message_system:
  core_message: string
  support_messages: list[string]
  proof_messages: list[string]
  objection_breakers: list[string]
  emotional_messages: list[string]
  authority_messages: list[string]
  conversion_messages: list[string]
  forbidden_messages: list[string]
```

Regle :

Chaque contenu produit doit pouvoir etre rattache a au moins un message de cette section.

## 14. Platform Strategy

Objectif :
Adapter la campagne a chaque plateforme.

### 14.1 Facebook Strategy

Schema :

```yaml
facebook_strategy:
  platform_role: string
  audience_state: string
  tone: string
  formats_to_prioritize: list[string]
  engagement_mechanisms: list[string]
  content_angles: list[string]
  cta_style: string
  risks: list[string]
```

Facebook doit favoriser :

- emotion ;
- proximite ;
- conversation ;
- visuels simples ;
- questions ;
- histoires ;
- communaute ;
- commentaires ;
- messages prives si pertinent.

### 14.2 LinkedIn Strategy

Schema :

```yaml
linkedin_strategy:
  platform_role: string
  audience_state: string
  tone: string
  formats_to_prioritize: list[string]
  engagement_mechanisms: list[string]
  content_angles: list[string]
  cta_style: string
  risks: list[string]
```

LinkedIn doit favoriser :

- expertise ;
- autorite ;
- point de vue ;
- apprentissage ;
- preuve ;
- progression professionnelle ;
- decision business ;
- commentaires de qualite ;
- sauvegardes.

## 15. Content Assets

Objectif :
Definir les actifs concrets de la campagne et les formats qui pourront etre generes a la demande.

Dans le Campaign Pack initial, cette section peut contenir :

- exemples de posts ;
- modeles de posts ;
- directions de contenu ;
- banques de hooks ;
- formats recommandes ;
- briefs video ;
- briefs visuels.

Les contenus massifs prets a utiliser, comme 70 publications Facebook pour une semaine, doivent etre produits dans un livrable separe de type `Content Batch`, en relisant d'abord le Campaign Pack, le calendrier annuel et les fichiers strategiques du projet.

Tous les contenus doivent contenir :

- un objectif ;
- un angle ;
- un hook ;
- un corps ;
- un CTA ;
- une justification ;
- un score ;
- une variante possible.

## 16. Facebook Post Contract

Schema :

```yaml
facebook_post:
  id: string
  objective: string
  audience_segment: string
  angle: string
  emotional_trigger: string
  format: short_post | storytelling | question | proof | visual_caption | community_prompt
  hook: string
  body: string
  cta: string
  visual_direction: string
  expected_reaction: string
  why_it_should_work: string
  variants:
    hook_variants: list[string]
    cta_variants: list[string]
  quality_score: int
  risk_flags: list[string]
```

Facebook post rules :

- premiere phrase claire et forte ;
- langage humain ;
- pas de jargon ;
- une emotion dominante ;
- un CTA conversationnel ;
- longueur adaptee au format ;
- pas de copie directe du post LinkedIn.

## 17. LinkedIn Post Contract

Schema :

```yaml
linkedin_post:
  id: string
  objective: string
  audience_segment: string
  angle: string
  business_insight: string
  format: opinion | story | framework | lesson | case_study | contrarian | analysis
  hook: string
  body: string
  cta: string
  proof_element: string
  expected_reaction: string
  why_it_should_work: string
  variants:
    hook_variants: list[string]
    cta_variants: list[string]
  quality_score: int
  risk_flags: list[string]
```

LinkedIn post rules :

- point de vue clair ;
- insight business ;
- phrases aerables ;
- preuve ou logique solide ;
- pas de posture creuse ;
- pas de CTA agressif ;
- pas de copie directe du post Facebook.

## 18. Hook Contract

Objectif :
Les hooks sont des actifs strategiques, pas seulement des premieres phrases.

Schema :

```yaml
hook:
  id: string
  platform: facebook | linkedin | cross_platform
  hook_text: string
  hook_type: contradiction | confession | result | fear | desire | diagnostic | curiosity | status | enemy
  emotional_trigger: string
  belief_shift: string
  intensity_score: int
  clarity_score: int
  risk_score: int
  best_use_case: string
```

Un bon hook doit :

- arreter le scroll ;
- etre clair sans tout expliquer ;
- ouvrir une tension ;
- donner envie de lire la suite ;
- rester coherent avec le contenu.

Rejet automatique si :

- le hook est clickbait sans payoff ;
- le hook promet plus que le contenu ;
- le hook pourrait appartenir a n'importe quelle marque ;
- le hook est plus intelligent que vrai.

## 19. Video Script Contract

Schema :

```yaml
video_script:
  id: string
  platform: facebook | linkedin | cross_platform
  objective: string
  angle: string
  duration_target_seconds: int
  hook_3_seconds: string
  scenes:
    - scene_number: int
      visual: string
      narration: string
      on_screen_text: string
      emotion: string
  retention_devices: list[string]
  subtitle_style: string
  thumbnail_idea: string
  cta: string
  why_it_should_work: string
  quality_score: int
```

Rules :

- le hook doit fonctionner sans contexte ;
- une seule idee principale ;
- sous-titres pensables des le depart ;
- visuel facile a produire ;
- CTA simple ;
- pas de script long deguise en video courte.

## 20. Visual Concept Contract

Schema :

```yaml
visual_concept:
  id: string
  platform: facebook | linkedin | cross_platform
  format: image | carousel | thumbnail | quote_card | infographic | before_after
  strategic_role: string
  visual_idea: string
  text_overlay: string
  composition: string
  mood: string
  brand_alignment: string
  production_notes: string
  variations: list[string]
  quality_score: int
```

Rules :

- le visuel doit renforcer l'angle ;
- pas de visuel decoratif sans role ;
- le texte doit etre court ;
- le concept doit etre realisable ;
- le visuel doit etre natif a la plateforme.

## 21. Carousel Concept Contract

Schema :

```yaml
carousel_concept:
  id: string
  platform: linkedin | facebook
  objective: string
  title: string
  slide_count: int
  slides:
    - slide_number: int
      headline: string
      body: string
      visual_note: string
      role: hook | tension | insight | proof | framework | example | cta
  saveability_reason: string
  shareability_reason: string
  quality_score: int
```

Un carrousel doit etre :

- utile ;
- sauvegardable ;
- clair ;
- visuel ;
- construit autour d'une progression ;
- pas une simple transcription de post.

## 22. Growth System

Objectif :
Transformer les contenus en mecanismes de croissance.

Schema :

```yaml
growth_system:
  growth_diagnosis: string
  primary_growth_loop:
    name: string
    steps: list[string]
    expected_behavior: string
    conversion_path: string
  tactics:
    - id: string
      name: string
      platform: facebook | linkedin | cross_platform
      mechanism: string
      psychological_trigger: string
      execution_steps: list[string]
      required_assets: list[string]
      expected_impact: low | medium | high
      effort: low | medium | high
      risk: low | medium | high
      ethical_boundary: string
      measurement: list[string]
  lead_magnets: list[string]
  dm_or_comment_paths: list[string]
  recycling_plan: list[string]
```

Accepted growth mechanisms :

- commentaire declencheur ;
- ressource utile ;
- mini-diagnostic ;
- serie recurrente ;
- challenge ;
- collaboration ;
- appel a experience ;
- template partageable ;
- contenu reponse ;
- transformation de commentaires en contenus ;
- boucle post -> commentaire -> ressource -> conversation -> offre.

Rejected growth mechanisms :

- faux comptes ;
- faux commentaires ;
- spam massif ;
- fausse rarete ;
- fausse preuve sociale ;
- messages prives agressifs ;
- automatisation non autorisee ;
- engagement artificiel.

## 23. Experimentation Plan

Objectif :
Transformer la campagne en apprentissage mesurable.

Schema :

```yaml
experimentation_plan:
  hypotheses:
    - id: string
      hypothesis: string
      why_it_matters: string
      platform: facebook | linkedin | cross_platform
      variable: hook | angle | format | cta | visual | timing | proof
      expected_signal: string
      success_metric: string
      decision_rule: string
  ab_tests:
    - id: string
      version_a: string
      version_b: string
      variable_tested: string
      minimum_signal_needed: string
  learning_questions: list[string]
```

Rules :

- un test = une variable principale ;
- chaque hypothese doit etre falsifiable ;
- chaque metrique doit servir une decision ;
- le test doit mener a une action claire.

## 24. Annual Editorial Calendar

Objectif :
Construire le calendrier editorial detaille sur 1 an.

Ce calendrier est un livrable central du systeme.
Il doit permettre de generer plus tard des contenus par semaine, par mois, par plateforme ou par campagne.

Schema :

```yaml
annual_editorial_calendar:
  year_strategy:
    annual_goal: string
    main_perception_shift: string
    annual_narrative: string
    primary_growth_loop: string
    content_pillars: list[string]
    platform_roles:
      facebook: string
      linkedin: string
  quarters:
    - quarter: Q1 | Q2 | Q3 | Q4
      strategic_role: string
      perception_focus: string
      growth_focus: string
      campaigns: list[string]
      key_formats: list[string]
  months:
    - month_number: int
      month_name: string
      theme: string
      objective: string
      main_angle: string
      emotional_tension: string
      growth_tactic: string
      facebook_focus: string
      linkedin_focus: string
      video_focus: string
      visual_focus: string
  weeks:
    - week_number: int
      month_number: int
      theme: string
      objective: string
      angle: string
      audience_state: string
      belief_shift: string
      facebook_plan:
        content_volume: int
        formats: list[string]
        hooks_to_explore: list[string]
      linkedin_plan:
        content_volume: int
        formats: list[string]
        hooks_to_explore: list[string]
      growth_mechanism: string
      video_needed: boolean
      visual_needed: boolean
      assets_to_create: list[string]
      measurement_focus: list[string]
```

Regles :

- le calendrier doit couvrir 52 semaines ;
- chaque semaine doit avoir un objectif clair ;
- chaque mois doit avoir un theme dominant ;
- chaque trimestre doit avoir un role strategique ;
- Facebook et LinkedIn doivent etre differencies ;
- les besoins video doivent etre marques meme si les scripts ne sont pas encore produits ;
- les besoins visuels doivent etre marques meme si les visuels ne sont pas encore produits ;
- les tactiques growth doivent etre reparties dans le temps ;
- le calendrier doit pouvoir servir de base aux generations futures.

Rejet automatique si :

- le calendrier ressemble a une liste de sujets ;
- les semaines ne suivent aucune progression ;
- les memes angles reviennent sans raison ;
- la strategie annuelle n'est pas visible ;
- les plateformes sont traitees de la meme facon.

## 25. Editorial Calendar

Objectif :
Organiser la sequence, pas seulement placer des dates.

Schema :

```yaml
editorial_calendar:
  campaign_duration_days: int
  sequence_logic: string
  posts:
    - day: int
      platform: facebook | linkedin
      asset_id: string
      role_in_sequence: awareness | tension | proof | education | conversion | engagement | recap
      reason_for_timing: string
      dependency: string
```

Regle :

Le calendrier doit raconter une progression :

1. capter ;
2. installer la tension ;
3. expliquer ;
4. prouver ;
5. engager ;
6. convertir ;
7. recycler.

## 26. Project File Plan

Objectif :
Definir les fichiers et dossiers que le systeme doit creer pour rendre le projet durable.

Schema :

```yaml
project_file_plan:
  project_slug: string
  root_path: string
  files_to_create:
    - path: string
      purpose: string
      owner_agent: string
      update_policy: append | overwrite_with_version | manual_review
  folders:
    - path: string
      purpose: string
  read_before_generation:
    - path: string
      reason: string
```

Regles :

- chaque projet doit avoir un dossier stable ;
- chaque livrable majeur doit exister en Markdown ;
- les donnees structurees importantes doivent aussi exister en JSON ;
- les outputs generes plus tard doivent etre rattaches au projet ;
- le systeme doit relire les fichiers strategiques avant de generer du contenu.

## 27. Quality Review

Objectif :
Decider si le pack est assez fort pour etre montre a l'utilisateur.

Schema :

```yaml
quality_review:
  global_score: int
  scoring:
    strategic_clarity: int
    audience_precision: int
    emotional_power: int
    positioning_strength: int
    content_quality: int
    platform_fit: int
    growth_potential: int
    actionability: int
    originality: int
    proof_strength: int
  strongest_parts: list[string]
  weakest_parts: list[string]
  required_improvements: list[string]
  publish_readiness: not_ready | review_needed | ready_for_human_validation
```

Minimum scores :

- global_score minimum : 8 ;
- strategic_clarity minimum : 8 ;
- audience_precision minimum : 7 ;
- emotional_power minimum : 8 ;
- content_quality minimum : 8 ;
- platform_fit minimum : 8 ;
- growth_potential minimum : 7.

Si le global_score est sous 8, le pack doit etre itere.

## 28. Risk Review

Objectif :
Identifier les risques avant validation humaine.

Schema :

```yaml
risk_review:
  reputation_risks: list[string]
  claim_risks: list[string]
  platform_risks: list[string]
  audience_risks: list[string]
  ethical_risks: list[string]
  mitigation_plan: list[string]
  red_flags: list[string]
```

Red flags :

- preuve inventee ;
- chiffre non source ;
- promesse garantie ;
- critique injustifiee d'un concurrent ;
- polarisation trop destructrice ;
- manipulation par le faux ;
- CTA agressif ;
- risque de bad buzz non maitrise.

## 29. Learning Loop

Objectif :
Preparer l'amelioration apres execution humaine.

Schema :

```yaml
learning_loop:
  metrics_to_collect:
    - views
    - reactions
    - comments
    - shares
    - saves
    - clicks
    - direct_messages
    - leads
    - qualitative_feedback
  interpretation_rules: list[string]
  next_iteration_triggers: list[string]
  recycle_candidates: list[string]
  abandon_candidates: list[string]
```

Le systeme doit apprendre :

- quels hooks fonctionnent ;
- quels angles generent des commentaires ;
- quels formats creent de la confiance ;
- quelles objections reviennent ;
- quels posts meritaient une suite ;
- quels contenus doivent etre abandonnes.

## 30. Final Recommendation

Objectif :
Donner une decision claire a l'utilisateur.

Schema :

```yaml
final_recommendation:
  recommended_next_action: string
  top_priority_asset: string
  top_growth_tactic: string
  biggest_risk: string
  what_to_validate_before_use: list[string]
  what_to_measure_first: list[string]
```

Cette section doit etre courte, nette et orientee action.

## 31. Agent Contribution Map

Chaque agent doit contribuer a des sections precises.

```yaml
agent_contributions:
  strategist:
    owns:
      - strategic_diagnosis
      - big_idea
      - final_recommendation
  audience_psychologist:
    owns:
      - audience_intelligence
      - emotional_tension
      - trigger_phrases
  positioning_agent:
    owns:
      - positioning
      - message_system
  influence_architect:
    owns:
      - influence_architecture
  growth_hacker:
    owns:
      - growth_system
      - experimentation_plan
  calendar_architect:
    owns:
      - annual_editorial_calendar
      - editorial_calendar
  facebook_native_agent:
    owns:
      - facebook_strategy
      - facebook_posts
  linkedin_native_agent:
    owns:
      - linkedin_strategy
      - linkedin_posts
  hook_master:
    owns:
      - hooks
  video_agent:
    owns:
      - video_scripts
  creative_director:
    owns:
      - visual_concepts
      - carousel_concepts
  anti_banality_agent:
    owns:
      - quality_review
      - required_improvements
  risk_reviewer:
    owns:
      - risk_review
  file_architect:
    owns:
      - project_file_plan
```

Regle :

Un agent peut contribuer ailleurs, mais il ne doit pas posseder une section qui n'est pas dans son territoire.

## 32. Orchestration Order

Ordre recommande :

```text
1. Intake Normalizer
2. File Architect
3. Strategist
4. Audience Psychologist
5. Positioning Agent
6. Influence Architect
7. Growth Hacker
8. Platform Native Agents
9. Calendar Architect
10. Hook Master
11. Copywriter Agents
12. Creative Director
13. Video Agent
14. Experimentation Agent
15. Anti-Banality Agent
16. Risk Reviewer
17. Strategist Final Arbitration
```

Pourquoi cet ordre :

- la strategie guide l'audience ;
- l'audience nourrit le positionnement ;
- le positionnement nourrit l'influence ;
- l'influence nourrit les contenus ;
- les contenus nourrissent le growth ;
- la critique ameliore tout ;
- l'arbitrage final evite les contradictions.

## 33. Quality Gates

Le pack doit passer par des portes de qualite.

### Gate 1 - Brief Clarity

Conditions :

- objectif clair ;
- audience identifiable ;
- offre comprise ;
- contraintes listees ;
- hypotheses marquees.

### Gate 2 - Strategic Strength

Conditions :

- tension claire ;
- perception a changer ;
- big idea memorable ;
- positionnement non generique.

### Gate 3 - Content Strength

Conditions :

- hooks forts ;
- contenus natifs plateforme ;
- CTA utiles ;
- preuves suffisantes ;
- pas de contenu interchangeable.

### Gate 4 - Growth Strength

Conditions :

- au moins une boucle growth ;
- mecanisme mesurable ;
- risque maitrise ;
- conversion path clair.

### Gate 5 - Final Review

Conditions :

- score global minimum 8 ;
- risques documentes ;
- ameliorations appliquees ;
- validation humaine requise.

## 34. Conditions De Rejet

Un Campaign Pack doit etre rejete si :

- il n'a pas de big idea ;
- il ne change aucune perception ;
- il produit des posts generiques ;
- il copie Facebook vers LinkedIn ;
- il invente des preuves ;
- il promet un resultat non defendable ;
- il manque de tension emotionnelle ;
- il ne contient aucune tactique growth ;
- il n'explique pas pourquoi les contenus devraient fonctionner ;
- il ne contient pas de plan d'experimentation ;
- il ne signale pas les risques.

## 35. Output Markdown Standard

Quand le pack est exporte en Markdown, il doit suivre cet ordre :

```markdown
# Campaign Pack - {campaign_name}

## 1. Resume Executif
## 2. Diagnostic Strategique
## 3. Audience Et Tensions
## 4. Positionnement
## 5. Architecture D'Influence
## 6. Big Idea
## 7. Systeme De Messages
## 8. Strategie Facebook
## 9. Strategie LinkedIn
## 10. Posts Facebook
## 11. Posts LinkedIn
## 12. Hooks
## 13. Scripts Video
## 14. Concepts Visuels
## 15. Systeme Growth
## 16. Plan D'Experimentation
## 17. Calendrier Editorial Annuel
## 18. Calendrier Editorial De Campagne
## 19. Plan Fichiers Projet
## 20. Scoring Qualite
## 21. Risques
## 22. Recommandation Finale
```

## 36. Output JSON Standard

Le JSON doit suivre la structure globale du point 5.

Regles :

- pas de cles dynamiques inutiles ;
- tous les ids doivent etre stables ;
- les scores sont des entiers de 0 a 10 ;
- les hypotheses doivent etre explicites ;
- les sections incompletes doivent contenir `status: incomplete` ;
- les erreurs doivent etre lisibles par un humain.

## 37. Exemple De Mini Pack

Exemple volontairement court.
Un vrai Campaign Pack sera plus complet.

```yaml
campaign_pack:
  metadata:
    campaign_id: "camp_001"
    campaign_name: "Votre communication explique trop"
    version: "0.1.0"
    status: "ready_for_review"
    platforms: ["facebook", "linkedin"]

  strategic_diagnosis:
    current_problem: "L'offre est presentee de facon trop rationnelle."
    hidden_problem: "L'audience ne ressent pas assez le cout de l'inaction."
    perception_to_change: "La communication n'est pas un exercice d'explication, c'est un declencheur de decision."
    decision_to_trigger: "Demander un diagnostic ou engager une conversation."
    strongest_leverage: "Montrer que les posts plats ne manquent pas d'information, mais de tension."

  big_idea:
    title: "Vous n'avez pas un probleme de visibilite, vous avez un probleme de desir."
    statement: "Les gens ne reagissent pas parce qu'ils ne comprennent pas. Ils reagissent parce qu'ils se sentent concernes."
    emotional_core: "frustration"
    contrarian_edge: "Plus expliquer peut affaiblir le desir."

  growth_system:
    primary_growth_loop:
      name: "Diagnostic en commentaire"
      steps:
        - "Publier un post qui expose le probleme."
        - "Inviter les lecteurs a commenter 'diagnostic'."
        - "Envoyer une grille d'auto-evaluation."
        - "Proposer une analyse manuelle aux cas les plus qualifies."
      expected_behavior: "Commentaires qualifies et conversations privees."
      conversion_path: "post -> commentaire -> ressource -> diagnostic -> offre"
```

## 38. Anti-Patterns

Ne jamais produire :

- une campagne sans diagnostic ;
- une strategie sans tension ;
- un post sans objectif ;
- un hook sans payoff ;
- une tactique growth non mesurable ;
- un calendrier sans logique de sequence ;
- une promesse sans preuve ;
- un score sans justification ;
- un contenu "LinkedIn" qui sonne Facebook ;
- un contenu "Facebook" qui sonne corporate ;
- une critique sans amelioration ;
- une big idea impossible a memoriser.

## 39. Definition De Done

Un Campaign Pack est termine quand :

- le brief est resume correctement ;
- la perception a changer est claire ;
- la big idea est forte ;
- l'audience est precise ;
- les tensions emotionnelles sont exploitables ;
- le positionnement est differentiant ;
- les contenus sont natifs a chaque plateforme ;
- les hooks sont scores ;
- les scripts video sont utilisables ;
- les concepts visuels sont realisables ;
- le systeme growth existe ;
- le plan d'experimentation est mesurable ;
- le calendrier raconte une sequence ;
- les risques sont explicites ;
- le score global est au moins 8 ;
- la recommandation finale est claire.

## 40. Principe Final

Le Campaign Pack est la preuve que Crew_System pense avant de produire.

Formule :

> Brief clair + strategie profonde + architecture d'influence + contenus natifs + mecanismes growth + scoring strict = campagne exploitable.

Le but n'est pas de sortir plus de contenu.
Le but est de sortir un systeme de communication qui augmente les chances de creer de l'attention, du desir, de la confiance et de l'action.
