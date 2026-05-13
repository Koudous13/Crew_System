# System Implementation Plan - Crew_System

## 1. Role Du Document

Ce fichier est le plan officiel de mise en place du systeme.

Il transforme les contrats deja ecrits en ordre d'execution concret.

Il doit repondre a une question simple :

```text
Dans quel ordre construit-on Crew_System pour obtenir un OS agentique robuste,
scalable, utilisable en arriere-plan, pilotable par chat, et capable de produire
des dossiers strategiques complets sans perdre la coherence ?
```

Ce plan doit etre suivi a la lettre.

Si une etape doit changer, on modifie d'abord ce fichier, puis on code.

## 2. Sources De Verite

Le plan s'appuie sur ces documents :

- `docs/BACKGROUND_AGENT_OS_VISION.md` ;
- `docs/RUNTIME_ORCHESTRATION_CONTRACT.md` ;
- `docs/PROJECT_FILE_SYSTEM_CONTRACT.md` ;
- `docs/AGENT_BLUEPRINT.md` ;
- `docs/AGENT_REGISTRY_CONTRACT.md` ;
- `docs/AGENT_MACHINE_REGISTRY.md` ;
- `docs/CAMPAIGN_PACK_CONTRACT.md` ;
- `docs/CONTENT_BATCH_CONTRACT.md` ;
- `docs/agents/`.

Regle :

```text
Le code implemente les contrats.
Le plan ordonne le code.
Les contrats restent la reference metier et systeme.
```

## 3. Etat Actuel

### 3.1 Deja Defini

- vision d'un OS agentique en arriere-plan ;
- runtime orchestration contract ;
- project file system contract ;
- campaign pack contract ;
- content batch contract ;
- blueprint agent ;
- registre humain des agents ;
- 18 specs agents ;
- registre machine agentique draft ;
- prompts systeme extraits ;
- schemas JSON minimaux ;
- routing intents ;
- dependances agents ;
- quality gates.

### 3.2 Pas Encore Implemente

- package applicatif ;
- modeles types ;
- loader de registre ;
- moteur workspace ;
- runtime kernel ;
- job planner ;
- task graph executor ;
- execution agents ;
- quality gate engine executable ;
- CLI ;
- API chat ;
- interface chat ;
- worker de fond ;
- stockage durable des jobs ;
- tests runtime ;
- evals executables.

## 4. Lois D'Implementation

### 4.1 Ne Jamais Coder Directement Sur `main` Ou `dev`

Chaque etape de construction doit partir de `dev` vers une branche de travail :

```text
codex/<nom-de-l-etape>
```

Le merge vers `dev` se fait seulement apres verification et validation.

### 4.2 Tout Sera Fait, Mais Dans L'Ordre

Le systeme final inclut bien tout :

- agents ;
- runtime ;
- jobs en arriere-plan ;
- fichiers ;
- CLI ;
- API ;
- interface chat ;
- providers LLM ;
- outils avances ;
- performance loop.

La regle est simple : tout est prevu, puis chaque morceau est construit
dans l'ordre qui le rend fiable.

Ordre obligatoire :

```text
contracts -> schemas -> filesystem -> registry loader -> runtime -> CLI -> API -> chat UI
```

### 4.3 Pas De Gros Prompt Magique

Le systeme final ne doit pas etre un seul prompt geant.

Il doit utiliser :

- un intent parser ;
- un project resolver ;
- un context loader ;
- un job planner ;
- un agent router ;
- un task graph ;
- des agents specialises ;
- des quality gates ;
- un file writer ;
- un run logger.

### 4.4 Le Registre Pilote Les Agents

Le runtime ne doit pas hardcoder les agents.

Il doit lire :

- `registry/manifest.yaml` ;
- `registry/agents/*.yaml` ;
- `registry/prompts/*.system.txt` ;
- `registry/schemas/*.schema.json` ;
- `registry/routing/*.yaml`.

### 4.5 Les Fichiers Sont La Memoire Durable

La conversation ne suffit jamais.

Un projet doit pouvoir reprendre depuis les fichiers :

- manifest projet ;
- brief normalise ;
- strategie ;
- calendrier ;
- batchs ;
- logs ;
- artifacts ;
- decisions.

### 4.6 Aucun Ecrasement Sauvage

Le systeme doit ecrire avec strategie :

- create si absent ;
- version si revision ;
- append si log ;
- archive si obsolete ;
- bloquer si risque de perte.

### 4.7 Jobs Longs, Pas Reponses Longues

Une demande lourde doit creer un job.

Exemples :

- creer un campaign pack ;
- generer un calendrier annuel ;
- produire 70 posts ;
- produire des scripts video ;
- reviser un batch ;
- analyser des performances.

Le chat affiche l'avancement.
Le job ecrit les fichiers.

### 4.8 Intensite Maximale, Faussete Minimale

Le systeme doit proteger l'intensite strategique.

Les agents psychologie, influence et growth ne doivent pas etre neutralises par les reviewers.

Une sortie forte doit etre corrigee seulement si elle est :

- fausse ;
- non prouvable ;
- incoherente ;
- abusive ;
- spammy ;
- dangereuse pour la confiance long terme ;
- non assumable par le projet.

Sinon, le systeme doit garder la version offensive propre.

### 4.9 Pas De Publication Directe

Crew_System propose, prepare, structure et archive.

Il ne publie pas directement sur Facebook ou LinkedIn dans la premiere version.

### 4.10 Tests A Chaque Couche

Chaque phase doit ajouter ses tests.

Un composant sans test minimal ne peut pas devenir fondation d'une couche suivante.

## 5. Architecture Cible

```text
Chat UI
  -> API Server
    -> Runtime Kernel
      -> Request Normalizer
      -> Intent Parser
      -> Project Resolver
      -> Context Loader
      -> Job Planner
      -> Agent Router
      -> Task Graph Executor
      -> Agent Runner
      -> Quality Gate Engine
      -> Artifact Writer
      -> Run Logger
      -> Chat Progress Stream

Workspace
  -> projects/
  -> logs/
  -> exports/
  -> archives/

Registry
  -> agents
  -> prompts
  -> schemas
  -> routing
  -> evals
```

## 6. Strategie Technique

### 6.1 Principe

Le coeur doit etre independant d'une bibliotheque agentique precise.

Raison :

- eviter le lock-in ;
- garder notre logique runtime ;
- pouvoir utiliser CrewAI si utile ;
- pouvoir changer de provider LLM ;
- pouvoir tester sans LLM ;
- pouvoir executer certains agents en mode mock.

### 6.2 Position Sur CrewAI

CrewAI peut etre utile comme adaptateur d'execution agentique.

Mais Crew_System ne doit pas dependre de CrewAI pour son architecture centrale.

Structure visee :

```text
Crew_System Runtime
  -> Agent Runner Interface
    -> Mock Runner
    -> LLM Runner
    -> CrewAI Runner optionnel
```

Le runtime reste proprietaire au projet.
CrewAI peut devenir un moteur parmi d'autres.

### 6.3 Stockage Durable

Demarrage recommande :

```text
fichiers + SQLite local
```

Evolution possible :

```text
Postgres + object storage + queue durable
```

Le systeme ne doit pas commencer par une infra trop lourde.
Il doit commencer par une architecture propre, testable, et evolutive.

## 7. Phases D'Implementation

## Phase 0 - Stabiliser Les Contrats Et Le Registre

Statut :

```text
en cours de finalisation
```

Objectif :

Verifier que la base documentaire et le registre machine sont utilisables par le futur code.

Livrables :

- `docs/AGENT_MACHINE_REGISTRY.md` ;
- `tools/generate_agent_registry.py` ;
- `registry/manifest.yaml` ;
- `registry/agents/*.yaml` ;
- `registry/prompts/*.system.txt` ;
- `registry/schemas/*.schema.json` ;
- `registry/evals/*.eval.yaml` ;
- `registry/routing/*.yaml`.

Gates de sortie :

- 18 agents declares ;
- 18 prompts presents ;
- 18 schemas presents ;
- 18 evals presentes ;
- JSON valide ;
- pas de fichier parasite ;
- pas de divergence avec `AGENT_REGISTRY_CONTRACT.md`.

Discipline :

- les agents deviennent `active` quand le runtime loader sait les verifier ;
- l'UI arrive avec un noyau exploitable derriere elle ;
- les LLM se branchent quand les schemas et le loader peuvent controler les sorties.

## Phase 1 - Creer Le Package Applicatif

Objectif :

Donner au repo une structure de code propre.

Structure cible :

```text
src/
  crew_system/
    __init__.py
    config/
    core/
    registry/
    filesystem/
    runtime/
    agents/
    quality/
    jobs/
    llm/
    cli/
tests/
```

Livrables :

- `pyproject.toml` ;
- package importable ;
- configuration de base ;
- conventions de chemins ;
- tests de smoke import ;
- commande minimale de verification.

Gates de sortie :

- le package s'importe ;
- les tests passent ;
- aucune logique metier hardcodee dans le CLI ;
- structure compatible avec les contrats.

## Phase 2 - Implementer Les Modeles Types

Objectif :

Transformer les objets runtime en modeles stricts.

Modeles prioritaires :

- `ChatRequest` ;
- `NormalizedRequest` ;
- `Intent` ;
- `ProjectRef` ;
- `ContextSnapshot` ;
- `Job` ;
- `TaskGraph` ;
- `TaskNode` ;
- `AgentDefinition` ;
- `AgentRun` ;
- `Artifact` ;
- `QualityReport` ;
- `FinalChatResponse`.

Livrables :

- modeles Python ;
- validation des champs obligatoires ;
- serialisation JSON ;
- tests unitaires ;
- export possible des schemas.

Gates de sortie :

- chaque objet fondamental du runtime a un modele ;
- les erreurs de validation sont lisibles ;
- les modeles n'importent pas les runners LLM ;
- les tests couvrent cas valide et cas invalide.

## Phase 3 - Implementer Le Workspace Engine

Objectif :

Rendre les fichiers projet durables, propres et tracables.

Composants :

- workspace initializer ;
- workspace manifest manager ;
- project slug resolver ;
- project manifest manager ;
- safe file writer ;
- artifact registry ;
- archive manager ;
- run log writer.

Livrables :

- creation d'un workspace ;
- creation d'un projet ;
- ecriture versionnee ;
- logs de job ;
- artifacts references ;
- tests filesystem.

Gates de sortie :

- aucun ecrasement sauvage possible ;
- un projet peut etre retrouve par slug ;
- un artifact sait d'ou il vient ;
- les chemins restent relatifs au workspace quand c'est possible ;
- les tests passent sur workspace temporaire.

## Phase 4 - Implementer Le Registry Loader

Objectif :

Charger le registre machine et le rendre utilisable par le runtime.

Composants :

- manifest loader ;
- agent entry loader ;
- prompt loader ;
- schema loader ;
- routing loader ;
- dependency loader ;
- quality gate loader ;
- registry validator.

Livrables :

- lecture complete de `registry/` ;
- validation des chemins ;
- detection des agents draft ;
- detection des dependances manquantes ;
- API interne pour demander les agents par intent.

Gates de sortie :

- les 18 agents sont chargeables ;
- un prompt absent casse clairement ;
- un schema absent casse clairement ;
- le runtime peut demander `agents_for_intent(intent)` ;
- aucun agent n'est hardcode dans le runtime.

## Phase 5 - Implementer Request, Intent Et Project Resolution

Objectif :

Transformer un message utilisateur en intention claire et projet cible.

Composants :

- request normalizer ;
- intent parser ;
- ambiguity detector ;
- project resolver ;
- scope clarifier ;
- missing information detector.

Intents prioritaires :

- `create_project_from_idea` ;
- `create_campaign_pack` ;
- `generate_annual_calendar` ;
- `generate_content_batch` ;
- `revise_content_batch` ;
- `analyze_performance`.

Livrables :

- parsing regle simple ;
- parsing LLM via extension dediee quand les formats d'intent sont stables ;
- resolution projet depuis workspace ;
- erreurs lisibles ;
- tests avec demandes utilisateur realistes.

Gates de sortie :

- le systeme sait dire quoi faire ;
- le systeme sait quand il manque un projet ;
- le systeme ne lance pas une generation massive sans contexte ;
- les cas ambigus sont detectes.

## Phase 6 - Implementer Le Context Loader

Objectif :

Lire les bons fichiers avant toute execution.

Composants :

- context policy par intent ;
- project file reader ;
- artifact reader ;
- strategy pack reader ;
- calendar reader ;
- batch reader ;
- context snapshot builder.

Livrables :

- `ContextSnapshot` stable ;
- liste des fichiers lus ;
- resume des points utiles ;
- detection des fichiers manquants ;
- tests par intent.

Gates de sortie :

- un content batch charge toujours la strategie ;
- un calendrier charge toujours le campaign pack si present ;
- les agents recoivent un contexte coherent ;
- les hypotheses sont marquees quand des fichiers manquent.

## Phase 7 - Implementer Job Planner, Agent Router Et Task Graph

Objectif :

Transformer l'intent et le contexte en plan d'execution.

Composants :

- job planner ;
- agent router ;
- dependency resolver ;
- task graph builder ;
- parallel safety checker ;
- retry policy ;
- stop policy.

Livrables :

- plan de job lisible ;
- graphe de taches ;
- dependances agents respectees ;
- activation conditionnelle ;
- skip rules appliquees ;
- tests de planification.

Gates de sortie :

- les agents requis par intent viennent du registre ;
- les agents optionnels sont actives par regles ;
- les dependances impossibles bloquent le job ;
- le graphe explique pourquoi chaque agent est lance.

## Phase 8 - Implementer L'Agent Runner Interface

Objectif :

Executer un agent sans lier le runtime a un seul moteur.

Runners :

- `MockAgentRunner` pour tests ;
- `LLMAgentRunner` pour premiere execution reelle ;
- `CrewAIRunner` optionnel quand le runtime est stable.

Livrables :

- interface runner ;
- entree standard agent ;
- sortie standard agent ;
- mode mock deterministe ;
- chargement prompt depuis registry ;
- validation de sortie contre schema.

Gates de sortie :

- un agent peut tourner en mock ;
- un agent peut produire une sortie structuree ;
- les erreurs runner sont journalisees ;
- le runtime reste decouple du provider LLM.

## Phase 9 - Implementer Le Quality Gate Engine

Objectif :

Verifier chaque sortie sans tuer la force strategique.

Gates prioritaires :

- schema gate ;
- context gate ;
- strategic alignment gate ;
- intensity preservation gate ;
- anti banality gate ;
- risk gate ;
- handoff gate.

Livrables :

- moteur de gates ;
- rapports de qualite ;
- decisions `accept`, `revise`, `reject`, `escalate` ;
- politique de retry ;
- tests avec sorties fortes mais propres ;
- tests avec sorties fausses ou spammy.

Gates de sortie :

- une sortie invalide est rejetee ;
- une sortie generique est revisee ;
- une sortie intense mais propre est preservee ;
- le risk reviewer ne neutralise pas par reflexe ;
- le rapport explique la decision.

## Phase 10 - Implementer Les Writers De Livrables

Objectif :

Transformer les sorties agents en fichiers propres.

Livrables prioritaires :

- campaign pack Markdown ;
- campaign pack JSON ;
- calendrier annuel Markdown ;
- calendrier annuel JSON ;
- content batch Markdown ;
- content batch JSON ;
- briefs visuels ;
- briefs video ;
- quality report ;
- run summary.

Gates de sortie :

- chaque fichier reference le job ;
- chaque fichier reference les agents utilises ;
- chaque fichier a un statut ;
- Markdown lisible humainement ;
- JSON exploitable par machine ;
- revision versionnee.

## Phase 11 - Construire Une CLI Minimaliste

Objectif :

Tester le systeme sans attendre l'interface chat.

Commandes minimales :

```text
crew-system init-workspace
crew-system create-project
crew-system run campaign-pack
crew-system run annual-calendar
crew-system run content-batch
crew-system job status
crew-system project inspect
crew-system registry validate
```

Livrables :

- CLI locale ;
- sorties lisibles ;
- execution mock ;
- execution reelle quand runner disponible ;
- tests CLI.

Gates de sortie :

- un projet peut etre cree depuis CLI ;
- un job peut etre lance depuis CLI ;
- les fichiers sont produits ;
- les logs sont consultables ;
- un echec est comprehensible.

## Phase 12 - Implementer Job Store Et Worker Local

Objectif :

Passer d'une execution simple a un vrai fonctionnement arriere-plan.

Composants :

- job store local ;
- statut durable ;
- worker local ;
- reprise apres interruption ;
- retries ;
- cancellation ;
- progress events.

Statuts :

```text
queued
running
waiting_for_user
needs_revision
failed
completed
cancelled
```

Gates de sortie :

- un job a un identifiant stable ;
- un job peut etre consulte plus tard ;
- une erreur ne detruit pas les artifacts deja produits ;
- le systeme peut reprendre proprement.

## Phase 13 - Construire L'API Chat

Objectif :

Exposer le runtime a une interface conversationnelle.

Endpoints minimaux :

- creer une conversation ;
- envoyer un message ;
- creer un job ;
- suivre un job ;
- lister les artifacts ;
- lire un artifact ;
- demander une revision ;
- valider un livrable.

Livrables :

- API locale ;
- streaming de progression ;
- format de messages stable ;
- erreurs propres ;
- tests API.

Gates de sortie :

- le chat ne bloque pas pendant un job long ;
- les progress events remontent ;
- les artifacts sont accessibles ;
- la validation humaine est explicite.

## Phase 14 - Construire L'Interface Chat

Objectif :

Donner a l'utilisateur une facade simple pour piloter l'OS.

Vues minimales :

- chat principal ;
- selecteur de projet ;
- panneau job en cours ;
- timeline d'execution ;
- navigateur d'artifacts ;
- lecteur Markdown ;
- statut des agents ;
- demande de revision.

Regles UX :

- pas de landing page marketing ;
- l'utilisateur arrive directement dans l'outil ;
- le chat reste central ;
- les fichiers produits sont visibles ;
- les jobs longs restent suivables ;
- les erreurs sont actionnables.

Gates de sortie :

- l'utilisateur peut donner une idee SaaS ;
- le systeme cree un projet ;
- le job tourne en arriere-plan ;
- les fichiers apparaissent ;
- l'utilisateur peut demander 70 posts ;
- l'utilisateur peut reviser un batch.

## Phase 15 - Brancher Les Providers Et Outils Avances

Objectif :

Ajouter les capacites puissantes sans polluer le noyau.

Extensions possibles :

- provider LLM principal ;
- provider LLM secondaire ;
- web research ;
- generation image ;
- generation video ;
- exports ;
- connecteurs stockage ;
- CrewAI runner ;
- evaluation automatique avancee.

Gates de sortie :

- chaque outil est derriere une interface ;
- chaque appel est logge ;
- chaque cout peut etre suivi ;
- un outil absent ne casse pas tout le systeme ;
- les permissions sont explicites.

## Phase 16 - Implementer Performance Et Apprentissage

Objectif :

Transformer les resultats en amelioration continue.

Composants :

- import performance ;
- performance analyst runner ;
- memoire des contenus gagnants ;
- memoire des hooks forts ;
- memoire des angles faibles ;
- boucle d'experimentation ;
- recommandations de revision.

Livrables :

- performance reports ;
- insights reutilisables ;
- experiment backlog ;
- recommandations pour prochain batch.

Gates de sortie :

- le systeme apprend des resultats ;
- il distingue opinion et signal ;
- il ne stocke pas de faux resultats ;
- il peut expliquer pourquoi il recommande une iteration.

## Phase 17 - Hardening, Packaging Et Scalabilite

Objectif :

Rendre le systeme robuste hors prototype.

Chantiers :

- migrations de schemas ;
- logs structures ;
- configuration environnements ;
- observabilite ;
- tests integration ;
- tests charge legers ;
- documentation developpeur ;
- packaging ;
- sauvegardes workspace ;
- securite des secrets.

Gates de sortie :

- installation reproductible ;
- tests complets ;
- jobs longs fiables ;
- reprise apres crash ;
- structure prete pour plusieurs projets ;
- documentation de run locale.

## 8. Vertical Slices Obligatoires

Le systeme doit progresser par tranches utilisables.

### Slice A - Registry Validable

Le code charge et valide le registre.

Sortie :

```text
registry valid
18 agents loaded
0 missing prompts
0 missing schemas
```

### Slice B - Projet Local Creable

Le systeme cree un workspace et un projet.

Sortie :

```text
workspace/projects/<project_slug>/
project_manifest.json
```

### Slice C - Campaign Pack Mock

Le runtime cree un campaign pack avec agents mock.

But :

Tester orchestration, fichiers, logs, gates, sans payer de LLM.

### Slice D - Campaign Pack Reel

Le runtime cree un campaign pack avec runner LLM.

But :

Verifier la qualite strategique reelle.

### Slice E - Calendrier Annuel

Le systeme genere un calendrier annuel depuis campaign pack.

But :

Verifier la lecture contexte et la coherence longue.

### Slice F - Batch 70 Posts

Le systeme genere une semaine de contenus Facebook ou LinkedIn.

But :

Verifier volume, coherence, hooks, growth, psychologie, plateforme et quality gates.

### Slice G - Chat Local

Le systeme accepte une demande par chat et lance un job.

But :

Verifier l'experience utilisateur finale.

## 9. Ordre Des Prochains Fichiers A Creer

Apres validation de ce plan, l'ordre logique est :

1. `pyproject.toml`
2. `src/crew_system/__init__.py`
3. `src/crew_system/core/models.py`
4. `src/crew_system/config/settings.py`
5. `src/crew_system/registry/loader.py`
6. `src/crew_system/registry/validator.py`
7. `tests/test_registry_loader.py`
8. `src/crew_system/filesystem/workspace.py`
9. `src/crew_system/filesystem/safe_writer.py`
10. `tests/test_workspace_engine.py`

Regle :

```text
Les agents LLM sont prevus.
On pose d'abord le socle qui leur permettra de travailler proprement,
de produire des fichiers fiables, et de reprendre apres erreur.
```

## 10. Definition De Done Du Systeme Final

Crew_System est considere fonctionnel quand un utilisateur peut :

1. ouvrir l'interface chat ;
2. donner une idee SaaS, business ou offre ;
3. obtenir la creation d'un projet ;
4. lancer un job en arriere-plan ;
5. voir les agents mobilises ;
6. suivre l'avancement ;
7. recevoir un campaign pack complet ;
8. recevoir un calendrier editorial annuel ;
9. demander 70 contenus pour une semaine ;
10. obtenir des fichiers Markdown et JSON propres ;
11. demander une revision ;
12. valider humainement un livrable ;
13. retrouver le projet plus tard ;
14. relancer un job depuis les fichiers existants ;
15. analyser les performances et ameliorer la suite.

## 11. Discipline D'Execution

On va tout construire.

Ces points ne sont pas des renoncements.
Ce sont les raccourcis qui casseraient le systeme si on les prenait dans le mauvais ordre :

- une UI sans runtime exploitable derriere ;
- des agents lances sans registre ;
- des outputs ecrits dans le repo au lieu du workspace ;
- 70 posts generes sans campaign pack ou contexte ;
- un fichier strategique ecrase sans version ;
- un seul prompt qui fait semblant de remplacer le systeme ;
- du volume sans quality gates ;
- CrewAI branche comme coeur rigide au lieu d'un runner possible ;
- un livrable marque approuve sans action humaine ;
- des strategies psychology, influence ou growth affaiblies automatiquement ;
- des faux chiffres, faux temoignages ou fausses preuves.

## 12. Regle De Relecture Avant Merge

Avant chaque merge vers `dev` :

- supposer que l'utilisateur demande explicitement : "verifie vraiment tout" ;
- relire les fichiers modifies ;
- lancer les tests disponibles ;
- lancer les scenarios manuels pertinents quand la phase touche un flux critique ;
- verifier `git diff --check` ;
- verifier les scans d'hygiene disponibles ;
- verifier les chemins dangereux, fichiers manquants et erreurs publiques quand la phase touche le filesystem ou le registre ;
- verifier que le plan est respecte ;
- verifier qu'aucune dette critique n'est cachee ;
- corriger tout point faible trouve avant de demander validation ou de merger ;
- noter clairement ce qui reste a faire.

Cette verification est implicite.

Cela veut dire :

```text
Meme si l'utilisateur ne le repete pas, chaque phase doit etre traitee comme si
la consigne "reverifie encore proprement" venait d'etre donnee.
```

Le systeme ne doit pas avancer par confiance vague.
Il doit avancer par verification repetee, corrections courtes, puis validation.

## 13. Prochaine Etape Apres Ce Fichier

La prochaine vraie etape est :

```text
Phase 1 - Creer Le Package Applicatif
```

Objectif immediat :

```text
Mettre en place le squelette Python propre, importable et testable,
avec les points d'extension qui permettront de brancher les agents LLM proprement.
```

Pourquoi :

```text
Un OS agentique robuste commence par ses objets, son registre, ses fichiers,
ses logs et ses tests. Les agents viennent ensuite travailler dans ce cadre.
```
