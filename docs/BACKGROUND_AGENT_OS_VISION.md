# Background Agent OS Vision - Crew_System

## 1. Correction De Vision

Crew_System ne doit pas etre pense comme un simple generateur de packs marketing.

Crew_System doit etre un programme agentique qui tourne en arriere-plan, pilote par une interface de chat, capable de comprendre une idee business, de lancer ses sous-agents internes, de creer des fichiers, de structurer des dossiers, de maintenir une memoire strategique et de produire des livrables lourds a la demande.

L'utilisateur ne vient pas seulement demander :

> Ecris-moi des posts.

Il vient dire :

> Voici mon idee de SaaS. Voici ce que je veux construire. Comprends mon univers, cree la strategie de communication, trouve les angles, les hacks, les leviers emotionnels, le calendrier editorial annuel, puis enregistre tout dans des fichiers propres. Plus tard, je te demanderai les contenus d'une semaine, d'un mois ou d'une campagne precise.

Le systeme doit donc fonctionner comme :

- un copilote strategique ;
- une agence IA interne ;
- un moteur de recherche d'angles ;
- un laboratoire growth ;
- une memoire de marque ;
- un generateur de documents ;
- un orchestrateur de sous-agents ;
- un producteur de contenus sur demande.

## 2. Experience Utilisateur Finale

L'utilisateur voit une interface de chat.

Derriere cette interface, le systeme travaille en arriere-plan.

Experience type :

```text
Utilisateur :
J'ai une idee de SaaS pour aider les coachs sportifs a automatiser leur suivi client.
Je veux une strategie de communication Facebook et LinkedIn sur 1 an.
Je veux un ton ambitieux, provocant, premium.
Je veux aussi prevoir des videos courtes, mais pas encore les scripts complets.

Crew_System :
Compris. Je vais analyser l'idee, structurer le positionnement, creer les axes strategiques,
construire le calendrier editorial annuel, definir les formats, puis enregistrer les documents
dans le workspace du projet.
```

Le systeme lance alors plusieurs agents internes :

- Strategist ;
- Audience Psychologist ;
- Positioning Agent ;
- Influence Architect ;
- Growth Hacker ;
- Facebook Native Agent ;
- LinkedIn Native Agent ;
- Creative Director ;
- Video Strategist ;
- Anti-Banality Agent ;
- Risk Reviewer ;
- Calendar Architect ;
- File Architect.

Quand le travail est fini, l'utilisateur obtient :

```text
workspace/
  projects/
    coach_saas/
      00_BRIEF.md
      01_STRATEGIC_DIAGNOSIS.md
      02_AUDIENCE_INTELLIGENCE.md
      03_POSITIONING.md
      04_INFLUENCE_ARCHITECTURE.md
      05_GROWTH_SYSTEM.md
      06_ANNUAL_EDITORIAL_CALENDAR.md
      07_PLATFORM_STRATEGY_FACEBOOK.md
      08_PLATFORM_STRATEGY_LINKEDIN.md
      09_VIDEO_STRATEGY.md
      10_VISUAL_DIRECTION.md
      11_RISK_REVIEW.md
      12_NEXT_ACTIONS.md
      campaign_pack.json
```

Puis l'utilisateur peut revenir plus tard :

```text
Utilisateur :
Base-toi sur le dossier coach_saas et genere les contenus Facebook pour la semaine 4.
Je veux 70 publications, avec visuels quand necessaire.

Crew_System :
Je vais relire la strategie, le calendrier annuel, les contraintes de marque,
consulter les agents hook, growth, copywriting, Facebook native, creative direction et critique,
puis produire un fichier propre avec les 70 publications.
```

Sortie :

```text
workspace/
  projects/
    coach_saas/
      outputs/
        week_04_facebook_70_posts.md
        week_04_facebook_70_posts.json
        week_04_visual_briefs.md
```

Ce type de production doit respecter le contrat `CONTENT_BATCH_CONTRACT.md`.
Le Campaign Pack cree la base strategique ; le Content Batch produit ensuite les lots de contenus a la demande.

## 3. Ce Que Le Systeme Doit Etre

Crew_System doit etre :

- conversationnel en surface ;
- agentique en profondeur ;
- asynchrone dans l'execution ;
- persistant par fichiers ;
- structure par projets ;
- capable de reprendre un contexte ancien ;
- capable de consulter ses propres documents ;
- capable de produire des fichiers propres ;
- capable de reviser une partie sans tout regenerer ;
- capable de justifier ses decisions ;
- capable de signaler ce qui manque ;
- capable de travailler longtemps sur une demande lourde.

Crew_System ne doit pas etre :

- un chatbot sans memoire ;
- un simple generateur de posts ;
- un outil qui oublie la strategie entre deux demandes ;
- un systeme qui produit du contenu sans relire les documents de base ;
- un orchestre d'agents decoratifs ;
- une boite noire impossible a auditer.

## 4. Architecture Mentale

Le systeme a trois couches.

### 4.1 Chat Interface

Role :
Recevoir les demandes de l'utilisateur, clarifier si necessaire, expliquer l'avancement et livrer les chemins des fichiers produits.

Fonctions :

- intake ;
- conversation ;
- confirmation de scope ;
- suivi d'execution ;
- resume final ;
- demande de revision.

### 4.2 Background Orchestrator

Role :
Transformer une demande en plan de travail, choisir les agents a lancer, distribuer les taches, suivre l'etat, gerer les fichiers et assembler le resultat.

Fonctions :

- decomposer la demande ;
- selectionner les agents ;
- ordonner les taches ;
- lancer les agents ;
- relire les documents existants ;
- detecter les dependances ;
- gerer les retries ;
- assembler les livrables ;
- verifier les quality gates ;
- ecrire les fichiers finaux.

Le detail operationnel de cette couche est defini dans `RUNTIME_ORCHESTRATION_CONTRACT.md`.

### 4.3 Agent Network

Role :
Produire les analyses, decisions, angles, contenus, critiques et revisions.

Chaque agent doit respecter le `AGENT_BLUEPRINT.md`.

Les agents ne sont pas des personnages de theatre.
Ce sont des composants specialises avec un contrat strict.

## 5. Workflow 1 - Creation D'Un Projet Depuis Une Idee

Objectif :
Transformer une idee business ou SaaS en base strategique exploitable.

Input utilisateur typique :

```text
J'ai une idee de SaaS pour [cible].
Il permet de [resultat].
Je veux communiquer sur Facebook et LinkedIn.
Je veux une strategie annuelle.
Je veux un ton [style].
Je veux inclure ou non des videos.
```

Process attendu :

1. Intake et normalisation du brief.
2. Creation du dossier projet.
3. Analyse de l'offre.
4. Analyse de l'audience.
5. Positionnement.
6. Architecture d'influence.
7. Strategie growth.
8. Strategie Facebook.
9. Strategie LinkedIn.
10. Strategie video si demandee.
11. Direction visuelle.
12. Calendrier editorial annuel.
13. Risk review.
14. Ecriture des fichiers.
15. Resume final dans le chat.

Sorties minimales :

- dossier projet ;
- documents strategiques ;
- calendrier editorial annuel ;
- fichier JSON de synthese ;
- recommandations d'utilisation.

## 6. Workflow 2 - Generation D'Un Calendrier Editorial Annuel

Le calendrier annuel est un livrable central.

Il ne doit pas etre une simple liste de dates.

Il doit definir :

- themes annuels ;
- trimestres strategiques ;
- campagnes mensuelles ;
- semaines editoriales ;
- objectifs de chaque periode ;
- plateformes concernees ;
- formats recommandes ;
- tensions emotionnelles ;
- angles ;
- tactiques growth ;
- videos a prevoir ;
- visuels a prevoir ;
- moments de recyclage ;
- moments d'analyse.

Structure recommandee :

```yaml
annual_editorial_calendar:
  year_strategy:
    strategic_theme: string
    annual_goal: string
    main_perception_shift: string
    primary_growth_loop: string
  quarters:
    - quarter: "Q1"
      strategic_role: string
      campaigns: []
  months:
    - month: "January"
      theme: string
      objective: string
      campaigns: []
  weeks:
    - week_number: 1
      theme: string
      objective: string
      facebook_focus: string
      linkedin_focus: string
      content_types: []
      growth_tactic: string
      video_need: string
      visual_need: string
```

Le calendrier doit permettre ensuite de generer :

- une semaine de contenus ;
- un mois de contenus ;
- une campagne precise ;
- une serie video ;
- une sequence de posts growth ;
- une serie de carrousels ;
- une banque de hooks.

## 7. Workflow 3 - Generation De Contenus A La Demande

L'utilisateur peut demander :

```text
Genere les contenus Facebook pour la semaine 7.
Je veux 70 publications.
Ajoute des idees de visuels quand c'est pertinent.
```

Le systeme doit alors :

1. Identifier le projet.
2. Lire les fichiers strategiques.
3. Lire le calendrier editorial annuel.
4. Identifier la semaine demandee.
5. Determiner les objectifs et angles de la semaine.
6. Lancer les agents necessaires.
7. Generer les contenus.
8. Faire passer chaque contenu par critique et scoring.
9. Ajouter les visuels quand necessaire.
10. Exporter un fichier propre.

Pour creer un seul contenu important, le systeme doit consulter presque tous les agents utiles :

- Strategist pour coherence globale ;
- Audience Psychologist pour tension humaine ;
- Positioning Agent pour coherence de l'offre ;
- Influence Architect pour architecture de perception ;
- Growth Hacker pour mecanisme d'amplification ;
- Platform Native Agent pour adaptation Facebook ou LinkedIn ;
- Hook Master pour l'accroche ;
- Copywriter pour l'ecriture ;
- Creative Director pour le visuel ;
- Video Agent si format video ;
- Anti-Banality Agent pour casser le contenu faible ;
- Risk Reviewer si promesse sensible.

Regle :

> Un contenu Crew_System n'est jamais une generation directe. C'est une decision collective compressee dans un actif final.

## 8. Workflow 4 - Generation Video

La video est optionnelle au depart, mais doit etre prevue dans l'architecture.

L'utilisateur peut dire :

```text
Pour cette campagne, je veux aussi des videos courtes.
```

Le systeme doit alors produire :

- strategie video ;
- formats recommandes ;
- idees de series ;
- scripts courts ;
- hooks 3 secondes ;
- storyboards ;
- sous-titres proposes ;
- idees de miniatures ;
- briefs visuels ;
- niveau d'effort de production.

Le systeme ne doit pas forcer la video si elle n'est pas demandee.
Mais il doit garder l'option dans le calendrier.

## 9. Workflow 5 - Visuels Et Assets Creatifs

Chaque contenu ne doit pas automatiquement avoir un visuel.

Le systeme doit decider :

- aucun visuel ;
- visuel simple ;
- carrousel ;
- miniature ;
- image conceptuelle ;
- infographie ;
- avant/apres ;
- template partageable ;
- visuel preuve ;
- visuel emotionnel.

Un visuel est necessaire si :

- il augmente la comprehension ;
- il augmente l'arret du scroll ;
- il rend le contenu plus partageable ;
- il porte mieux la preuve ;
- il permet de recycler l'idee ;
- il renforce la marque.

Un visuel est inutile si :

- il est decoratif ;
- il affaiblit le message ;
- il complique un post qui fonctionne mieux en texte ;
- il demande trop d'effort pour peu d'impact.

## 10. File System Comme Memoire

Le systeme doit utiliser les fichiers comme memoire durable.

Chaque projet doit avoir une structure claire.

Le contrat complet de cette memoire fichier est defini dans `PROJECT_FILE_SYSTEM_CONTRACT.md`.

Structure recommandee :

```text
workspace/
  projects/
    {project_slug}/
      README.md
      brief/
        original_brief.md
        normalized_brief.json
      strategy/
        strategic_diagnosis.md
        audience_intelligence.md
        positioning.md
        influence_architecture.md
        growth_system.md
      calendar/
        annual_editorial_calendar.md
        annual_editorial_calendar.json
      platforms/
        facebook_strategy.md
        linkedin_strategy.md
      creative/
        visual_direction.md
        video_strategy.md
      outputs/
        week_01_facebook_posts.md
        week_01_linkedin_posts.md
      logs/
        jobs.jsonl
        agent_runs.jsonl
        artifacts.jsonl
        errors.jsonl
        decisions.md
        jobs/
```

Regles :

- ne jamais ecraser sans raison ;
- versionner les outputs importants ;
- garder les hypotheses ;
- marquer les documents obsoletes ;
- permettre a l'utilisateur de relire et modifier ;
- permettre au systeme de relire avant de produire.

## 11. Chat Commands Naturelles

L'utilisateur ne doit pas apprendre une syntaxe complexe.

Commandes naturelles possibles :

```text
Cree un nouveau projet pour mon SaaS.
Genere la strategie annuelle.
Refais le positionnement, il est trop faible.
Base-toi sur le projet X.
Genere 70 posts Facebook pour la semaine 5.
Ajoute des concepts visuels.
Fais une version plus agressive.
Fais une version plus premium.
Genere les scripts video du mois 2.
Lis les resultats et propose la prochaine iteration.
Archive cette campagne.
```

Le systeme doit comprendre :

- le projet vise ;
- le livrable attendu ;
- les fichiers a lire ;
- les agents a consulter ;
- le format de sortie ;
- le niveau de profondeur.

## 12. Etats D'Execution

Comme le systeme travaille en arriere-plan, il doit exposer des etats.

Etats recommandes :

```yaml
job_status:
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

Le chat doit pouvoir dire :

```text
Je suis en train de relire la strategie annuelle.
J'ai lance les agents Hook Master, Growth Hacker et Facebook Native.
Je suis en revue qualite sur les 70 posts.
J'ecris les fichiers finaux.
```

## 13. Un Agent Ne Suffit Pas Pour Un Contenu

Un contenu final doit etre le resultat d'une chaine.

Exemple pour un post Facebook :

```text
Calendar Architect
  -> selectionne le theme de la semaine
Strategist
  -> confirme l'objectif du post
Audience Psychologist
  -> choisit la tension emotionnelle
Influence Architect
  -> definit le mouvement de perception
Growth Hacker
  -> ajoute le mecanisme d'engagement
Facebook Native Agent
  -> adapte au contexte Facebook
Hook Master
  -> cree les accroches
Copywriter
  -> redige le post
Creative Director
  -> decide si un visuel est utile
Anti-Banality Agent
  -> critique et renforce
Risk Reviewer
  -> signale les limites si necessaire
```

Resultat :

```yaml
post:
  platform: facebook
  week: 4
  objective: "declencher commentaires qualifies"
  angle: "les coachs perdent des clients parce que le suivi est invisible"
  emotional_trigger: "frustration"
  growth_mechanism: "commentaire diagnostic"
  hook: "Vos clients ne quittent pas toujours votre coaching. Parfois, ils quittent votre silence."
  body: "..."
  cta: "Commentez SUIVI si vous voulez la grille d'auto-diagnostic."
  visual_needed: true
  visual_brief: "..."
  quality_score: 9
```

## 14. Les Livrables Principaux

Crew_System doit pouvoir produire :

- dossier projet complet ;
- strategie annuelle ;
- calendrier editorial annuel ;
- strategie Facebook ;
- strategie LinkedIn ;
- strategie video ;
- direction visuelle ;
- banque de hooks ;
- banque d'angles ;
- banque de tactiques growth ;
- contenus d'une semaine ;
- contenus d'un mois ;
- scripts video ;
- briefs visuels ;
- carrousels ;
- rapports d'analyse ;
- plans d'iteration.

## 15. Definition Du Systeme Final

Crew_System est un systeme agentique de communication strategique qui :

- discute avec l'utilisateur dans un chat ;
- travaille en arriere-plan ;
- lance des sous-agents specialises ;
- cree et relit ses propres fichiers ;
- construit une memoire de projet ;
- genere une strategie long terme ;
- produit des contenus a la demande ;
- ajoute des visuels ou videos si demandes ;
- critique ses propres sorties ;
- garde la coherence entre strategie, calendrier et contenus ;
- evite les sorties generiques ;
- privilegie les angles, les emotions, les hooks, les mecanismes growth et la qualite.

Formule :

> Chat en facade + orchestration agentique en arriere-plan + memoire fichier + agents specialises + quality gates = Strategic Communication OS.
