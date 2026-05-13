# Project File System Contract - Crew_System

## 1. Role Du Document

Ce document definit la memoire fichier durable de Crew_System.

Le runtime orchestre.
Les agents produisent.
Le file system conserve.

Question centrale :

> Ou et comment Crew_System stocke-t-il sa memoire strategique, ses jobs, ses livrables, ses logs, ses revisions et ses outputs sans perdre la coherence du projet ?

Ce contrat sert de reference pour :

- le `Project Resolver` ;
- le `Context Loader` ;
- le `File Writer` ;
- l'`Artifact Registry` ;
- le `Run Logger` ;
- les futurs agents ;
- les futurs exports Markdown/JSON ;
- les futures commandes chat.

## 2. Principes Non Negociables

### 2.1 Les Fichiers Sont La Source Durable

La conversation est temporaire.
Les fichiers projet sont la memoire durable.

Le systeme doit toujours pouvoir reprendre un projet en lisant son dossier.

### 2.2 Markdown Pour Humain, JSON Pour Machine

Chaque livrable important doit exister sous deux formes quand c'est utile :

- `.md` pour lecture humaine ;
- `.json` pour exploitation machine.

Exemple :

```text
calendar/annual_editorial_calendar.md
calendar/annual_editorial_calendar.json
```

### 2.3 Aucun Ecrasement Sauvage

Un fichier important ne doit pas etre ecrase sans strategie :

- creation simple si absent ;
- append si log ;
- versioning si revision ;
- archive si obsolete ;
- confirmation utilisateur si risque de perte.

### 2.4 Tout Artifact Doit Etre Tracable

Chaque fichier produit doit pouvoir repondre a :

- qui l'a cree ;
- pour quel job ;
- avec quels agents ;
- a partir de quels fichiers ;
- a quelle version ;
- avec quel statut ;
- ou il est reference.

### 2.5 Structure Stable, Contenu Evolutif

La structure des dossiers doit etre stable.
Les contenus peuvent evoluer par versions.

Le runtime doit pouvoir trouver les fichiers sans deviner.

### 2.6 La Strategie Prime Sur Les Outputs

Les outputs comme les posts, scripts et briefs visuels doivent rester rattaches a la strategie.

Un batch de contenus n'est jamais un fichier isole.
Il doit referencer :

- le projet ;
- la periode ;
- la strategie ;
- le calendrier ;
- le job ;
- les agents ;
- les scores.

## 3. Racine Du Workspace

Crew_System doit distinguer :

- le repo de code ;
- le workspace runtime ;
- les projets utilisateur.

Racine recommandee :

```text
workspace/
```

Structure globale :

```text
workspace/
  README.md
  workspace_manifest.json
  projects/
  global_registry/
  templates/
  exports/
  archives/
  tmp/
  logs/
```

Regles :

- `workspace/` doit etre configurable ;
- les chemins dans les manifests doivent etre relatifs au workspace autant que possible ;
- le repo de code ne doit pas etre pollue par les outputs runtime si une racine externe est configuree ;
- `tmp/` peut etre nettoye ;
- `projects/` contient la memoire durable.

Variable future possible :

```text
CREW_SYSTEM_WORKSPACE=workspace/
```

## 4. Workspace Manifest

Le workspace doit avoir un manifest global.

Chemin :

```text
workspace/workspace_manifest.json
```

Schema :

```yaml
workspace_manifest:
  workspace_id: string
  version: string
  created_at: string
  updated_at: string
  projects_root: "projects"
  active_projects: list[string]
  archived_projects: list[string]
  global_registry_path: "global_registry"
  templates_path: "templates"
  archives_path: "archives"
  schema_version: string
```

Role :

- lister les projets ;
- retrouver les archives ;
- connaitre la version de schema ;
- eviter les scans filesystem inutiles ;
- aider les migrations futures.

## 5. Convention De Slug Projet

Chaque projet doit avoir un `project_slug`.

Regles :

- snake_case ;
- ASCII ;
- minuscule ;
- stable ;
- lisible ;
- unique dans le workspace ;
- pas d'espace ;
- pas d'accent ;
- pas de nom vague.

Exemples bons :

```text
coach_saas
immobilier_premium
agence_growth_b2b
formation_ia_pme
```

Exemples mauvais :

```text
new_project
test
mon projet
Projet Client Final v2
```

Si collision :

```text
coach_saas
coach_saas_2
coach_saas_2026
```

Le runtime doit preferer demander confirmation avant de creer un slug trop proche d'un projet existant.

## 6. Structure Canonique D'Un Projet

Chaque projet doit suivre cette structure.

```text
workspace/
  projects/
    {project_slug}/
      README.md
      manifest.json
      brief/
        original_brief.md
        normalized_brief.json
        assumptions.md
        source_materials/
      strategy/
        strategic_diagnosis.md
        strategic_diagnosis.json
        audience_intelligence.md
        audience_intelligence.json
        positioning.md
        positioning.json
        influence_architecture.md
        influence_architecture.json
        message_system.md
        message_system.json
        growth_system.md
        growth_system.json
      calendar/
        annual_editorial_calendar.md
        annual_editorial_calendar.json
        campaign_calendars/
      platforms/
        facebook_strategy.md
        facebook_strategy.json
        linkedin_strategy.md
        linkedin_strategy.json
      creative/
        visual_direction.md
        visual_direction.json
        video_strategy.md
        video_strategy.json
        asset_briefs/
      outputs/
        campaign_packs/
        batches/
        revisions/
        exports/
      performance/
        reports/
        raw/
        learnings.md
        learnings.json
      reviews/
        risk_review.md
        risk_review.json
        quality_reviews/
      memory/
        brand_memory.md
        brand_memory.json
        audience_memory.md
        audience_memory.json
        decision_memory.md
      logs/
        jobs.jsonl
        agent_runs.jsonl
        artifacts.jsonl
        errors.jsonl
        decisions.md
        jobs/
      archive/
```

Regle :

Tous les dossiers ne contiennent pas forcement des fichiers au debut.
Mais la structure doit etre connue par le runtime.

## 7. Project Manifest

Chaque projet doit avoir :

```text
workspace/projects/{project_slug}/manifest.json
```

Schema :

```yaml
project_manifest:
  project_slug: string
  project_name: string
  status: active | draft | archived
  version: string
  created_at: string
  updated_at: string
  owner: string
  description: string
  active_campaign_pack_id: string
  active_annual_calendar_id: string
  active_platforms:
    - facebook
    - linkedin
  key_files:
    readme: string
    normalized_brief: string
    positioning: string
    annual_calendar: string
    facebook_strategy: string
    linkedin_strategy: string
  indexes:
    artifacts: "logs/artifacts.jsonl"
    jobs: "logs/jobs.jsonl"
    agent_runs: "logs/agent_runs.jsonl"
  current_state:
    strategy_ready: boolean
    calendar_ready: boolean
    content_batches_available: int
    last_job_id: string
  schema_version: string
```

Regles :

- le manifest est mis a jour apres chaque job important ;
- le manifest ne doit pas contenir de contenu long ;
- il reference les fichiers, il ne les remplace pas ;
- s'il est corrompu, le runtime peut reconstruire un manifest par scan controle.

## 8. README Projet

Chaque projet doit avoir un `README.md`.

Role :

- donner une vue humaine rapide ;
- expliquer le projet ;
- pointer vers les fichiers importants ;
- lister les derniers outputs ;
- indiquer le statut.

Template :

```markdown
# {project_name}

## Resume

## Objectif

## Audience

## Positionnement Actif

## Fichiers Strategiques

## Calendrier

## Outputs Recents

## Derniers Jobs

## Prochaine Action Recommandee
```

Le README ne doit pas remplacer les documents complets.
Il sert de table d'orientation.

## 9. Brief Folder

Chemin :

```text
brief/
```

Contenu :

```text
original_brief.md
normalized_brief.json
assumptions.md
source_materials/
```

### 9.1 original_brief.md

Contient la demande utilisateur brute ou reformatee proprement.

Regle :

- ne jamais le modifier silencieusement ;
- ajouter une nouvelle version si le brief change fortement.

### 9.2 normalized_brief.json

Schema :

```yaml
normalized_brief:
  project_slug: string
  business_name: string
  offer: string
  target_audience: string
  platforms: list[string]
  annual_goal: string
  desired_tone: string
  constraints: list[string]
  video_requested: boolean
  visuals_requested: boolean
  assumptions: list[string]
  missing_information: list[string]
  source_request_id: string
```

### 9.3 assumptions.md

Liste les hypotheses prises par le systeme.

Chaque hypothese doit indiquer :

- raison ;
- impact ;
- confiance ;
- comment la confirmer.

## 10. Strategy Folder

Chemin :

```text
strategy/
```

Fichiers strategiques canoniques :

```text
strategic_diagnosis.md/json
audience_intelligence.md/json
positioning.md/json
influence_architecture.md/json
message_system.md/json
growth_system.md/json
```

Regles :

- chaque fichier `.md` doit etre lisible seul ;
- chaque fichier `.json` doit suivre un schema exploitable ;
- les documents doivent referencer le job qui les a crees ;
- les revisions majeures vont dans `outputs/revisions/` ou sont versionnees.

Statuts possibles :

```yaml
document_status:
  draft
  needs_revision
  ready_for_human_review
  approved_by_human
  archived
```

## 11. Calendar Folder

Chemin :

```text
calendar/
```

Fichiers :

```text
annual_editorial_calendar.md
annual_editorial_calendar.json
campaign_calendars/
```

Le calendrier annuel est central.

Il doit contenir :

- strategie annuelle ;
- trimestres ;
- mois ;
- 52 semaines ;
- objectifs ;
- angles ;
- plateformes ;
- formats ;
- besoins visuels ;
- besoins video ;
- tactiques growth ;
- mesures.

Regle :

Un `Content Batch` ne doit pas etre produit si le calendrier annuel manque, sauf si l'utilisateur confirme explicitement une generation hors calendrier.

## 12. Platforms Folder

Chemin :

```text
platforms/
```

Fichiers :

```text
facebook_strategy.md/json
linkedin_strategy.md/json
```

Role :

- definir comment adapter la strategie a chaque plateforme ;
- eviter le copier-coller ;
- guider les Content Batches ;
- documenter les CTA, formats et tonalites.

Regles :

- un batch Facebook doit lire `facebook_strategy` ;
- un batch LinkedIn doit lire `linkedin_strategy` ;
- un batch cross-platform doit lire les deux.

## 13. Creative Folder

Chemin :

```text
creative/
```

Fichiers :

```text
visual_direction.md/json
video_strategy.md/json
asset_briefs/
```

Role :

- garder la coherence visuelle ;
- prevoir les formats video ;
- centraliser les briefs assets ;
- eviter les visuels decoratifs.

`asset_briefs/` peut contenir :

```text
visual_brief_{id}.md
video_script_{id}.md
carousel_brief_{id}.md
thumbnail_brief_{id}.md
```

## 14. Outputs Folder

Chemin :

```text
outputs/
```

Structure :

```text
outputs/
  campaign_packs/
  batches/
  revisions/
  exports/
```

### 14.1 Campaign Packs

```text
outputs/campaign_packs/
  {campaign_pack_id}/
    README.md
    campaign_pack.md
    campaign_pack.json
    quality_review.md
    risk_review.md
    agent_run_summary.md
```

### 14.2 Content Batches

```text
outputs/batches/
  {batch_id}/
    README.md
    content_batch.md
    content_batch.json
    visual_briefs.md
    video_scripts.md
    quality_review.md
    risk_review.md
    production_plan.json
    agent_run_summary.md
```

### 14.3 Revisions

```text
outputs/revisions/
  {revision_id}/
    README.md
    revision_summary.md
    changed_items.json
    before_after.md
```

### 14.4 Exports

```text
outputs/exports/
  markdown/
  json/
  pdf/
  docx/
  csv/
```

Regles :

- chaque output lourd a son dossier ;
- chaque dossier d'output a un README ;
- chaque output doit etre reference dans `logs/artifacts.jsonl` ;
- les outputs humains sont en Markdown ;
- les outputs machines sont en JSON.

## 15. Performance Folder

Chemin :

```text
performance/
```

Structure :

```text
performance/
  reports/
  raw/
  learnings.md
  learnings.json
```

Role :

- stocker les resultats fournis par l'utilisateur ;
- garder les apprentissages ;
- nourrir les iterations futures ;
- eviter de recommencer les memes erreurs.

Exemples :

```text
reports/week_04_facebook_results.md
raw/week_04_metrics.csv
```

Regle :

Les donnees de performance doivent etre marquees selon leur source :

- declaree par utilisateur ;
- importee ;
- calculee ;
- estimee.

## 16. Reviews Folder

Chemin :

```text
reviews/
```

Structure :

```text
reviews/
  risk_review.md/json
  quality_reviews/
```

Role :

- conserver les revues de risque ;
- conserver les scores ;
- retrouver pourquoi un output a ete accepte ou rejete.

Fichiers possibles :

```text
quality_reviews/{artifact_id}_quality_review.md
risk_review_{job_id}.md
```

## 17. Memory Folder

Chemin :

```text
memory/
```

Fichiers :

```text
brand_memory.md/json
audience_memory.md/json
decision_memory.md
```

Role :

- stocker les apprentissages durables ;
- garder les preferences de marque ;
- garder les patterns d'audience ;
- garder les decisions structurantes.

Regles :

- ne pas stocker de donnees personnelles sensibles inutiles ;
- distinguer faits, hypotheses et preferences ;
- inclure source et date ;
- permettre l'oubli ou l'archivage.

## 18. Logs Folder

Chemin :

```text
logs/
```

Structure :

```text
logs/
  jobs.jsonl
  agent_runs.jsonl
  artifacts.jsonl
  errors.jsonl
  decisions.md
  jobs/
    {job_id}/
      job.json
      task_graph.json
      context_snapshot.json
      progress_events.jsonl
      checkpoints.jsonl
      final_response.md
```

### 18.1 jobs.jsonl

Un job par ligne.

```yaml
job_log_entry:
  job_id: string
  request_id: string
  intent_type: string
  status: string
  started_at: string
  completed_at: string
  artifacts_created: list[string]
  quality_score: int
```

### 18.2 agent_runs.jsonl

Une execution d'agent par ligne.

```yaml
agent_run_log_entry:
  agent_run_id: string
  job_id: string
  agent_id: string
  agent_version: string
  status: string
  quality_score: int
  confidence_score: int
  output_artifacts: list[string]
```

### 18.3 artifacts.jsonl

Un artifact produit par ligne.

```yaml
artifact_log_entry:
  artifact_id: string
  job_id: string
  type: string
  path: string
  format: markdown | json | jsonl
  version: string
  status: string
  hash: string
```

### 18.4 decisions.md

Journal humain des decisions importantes.

Doit contenir :

- date ;
- job ;
- decision ;
- raison ;
- impact ;
- fichiers concernes.

## 19. Archive Folder

Chemin :

```text
archive/
```

Role :

- conserver documents obsoletes ;
- conserver anciennes versions ;
- retirer du flux actif sans supprimer.

Structure possible :

```text
archive/
  documents/
  outputs/
  jobs/
```

Regles :

- archiver plutot que supprimer ;
- conserver la raison d'archive ;
- mettre a jour le manifest ;
- ne pas charger les archives par defaut dans le contexte.

## 20. Naming Conventions

### 20.1 IDs

```text
project_slug: coach_saas
job_id: job_20260513_153000_ab12
campaign_pack_id: cp_coach_saas_v001
batch_id: batch_coach_saas_w04_fb_70_v001
artifact_id: art_20260513_ab12
revision_id: rev_batch_coach_saas_w04_fb_70_v002
```

### 20.2 Files

Regles :

- snake_case ;
- extension explicite ;
- version si necessaire ;
- pas d'espaces ;
- pas d'accents ;
- pas de noms vagues comme `final_final.md`.

Exemples :

```text
week_04_facebook_70_posts.md
annual_editorial_calendar_v002.json
positioning_revision_20260513.md
```

## 21. Versioning

### 21.1 Document Versions

Un document strategique majeur doit etre versionne si son sens change.

Modes :

```yaml
write_modes:
  create: "nouveau fichier"
  append: "ajout a un log ou journal"
  overwrite_with_version: "creer une version et mettre a jour l'actif courant"
  skip_if_exists: "ne rien faire si present"
```

### 21.2 Version Pattern

```text
{name}_v001.md
{name}_v002.md
```

Le fichier canonique peut pointer vers la derniere version ou contenir la version active.

Exemple :

```text
strategy/positioning.md
strategy/versions/positioning_v001.md
strategy/versions/positioning_v002.md
```

Regle :

Le versioning est obligatoire pour :

- positionnement ;
- calendrier annuel ;
- campaign pack ;
- content batch ;
- revisions majeures.

## 22. Atomic Write Contract

Le File Writer doit utiliser une ecriture atomique.

Pattern :

```text
1. preparer contenu en memoire
2. ecrire dans tmp/{job_id}/{filename}.tmp
3. valider schema ou format
4. calculer hash
5. deplacer vers chemin final
6. verifier lecture
7. mettre a jour artifacts.jsonl
8. mettre a jour manifest si necessaire
9. journaliser decision
```

Si une etape echoue :

- ne pas annoncer succes ;
- conserver erreur dans `errors.jsonl` ;
- conserver le fichier temporaire si utile au debug ;
- proposer retry ou correction.

## 23. Read Contract

Avant generation, le runtime doit lire les fichiers requis.

Lecture minimale pour `Content Batch` :

```text
README.md
brief/normalized_brief.json
strategy/positioning.md
strategy/audience_intelligence.md
strategy/influence_architecture.md
strategy/growth_system.md
calendar/annual_editorial_calendar.md
platforms/{platform}_strategy.md
reviews/risk_review.md
```

Lecture supplementaire si besoin :

```text
creative/visual_direction.md
creative/video_strategy.md
performance/learnings.md
outputs/batches/{previous_batch}/content_batch.json
memory/brand_memory.md
memory/audience_memory.md
```

Regles :

- lire Markdown pour nuances ;
- lire JSON pour structure ;
- produire un `context_snapshot.json` ;
- signaler les fichiers manquants ;
- ne pas inventer ce qu'un fichier absent aurait du contenir.

## 24. Context Snapshot

Chaque job lourd doit sauvegarder :

```text
logs/jobs/{job_id}/context_snapshot.json
```

Schema :

```yaml
context_snapshot:
  job_id: string
  project_slug: string
  loaded_files:
    - path: string
      hash: string
      role: string
      summary: string
  missing_files:
    - path: string
      impact: string
      required: boolean
  assumptions: list[string]
  confidence_score: int
```

Ce snapshot permet :

- audit ;
- reprise ;
- debug ;
- comparaison entre revisions.

## 25. Conflict Rules

Conflits possibles :

- deux jobs veulent ecrire le meme fichier ;
- le manifest reference un fichier absent ;
- Markdown et JSON divergent ;
- utilisateur modifie un fichier pendant un job ;
- deux projets ont des slugs proches ;
- une revision cible un batch archive.

Resolution :

```yaml
conflict_resolution:
  same_file_write: "lock + version"
  missing_manifest_target: "scan + repair suggestion"
  md_json_mismatch: "prefer json for structure, markdown for nuance, flag conflict"
  user_modified_during_job: "pause and ask or replan"
  close_project_slug: "ask user"
  archived_batch_revision: "ask user to restore or fork"
```

## 26. Locks

Les locks empechent les collisions.

Chemin possible :

```text
workspace/tmp/locks/
```

Schema :

```yaml
lock:
  lock_id: string
  scope: project | artifact | batch | job
  target_path: string
  owner_job_id: string
  acquired_at: string
  expires_at: string
```

Regles :

- lock obligatoire avant ecriture finale ;
- expiration pour eviter les locks morts ;
- unlock apres succes, echec ou annulation ;
- logs en cas de conflit.

## 27. Deletion Policy

Suppression par defaut interdite pour les artifacts importants.

Preferer :

- archive ;
- deprecated ;
- superseded ;
- hidden from active context.

Suppression autorisee seulement pour :

- fichiers temporaires ;
- outputs explicitement demandes par l'utilisateur ;
- erreurs de generation sans valeur ;
- caches reconstruisibles.

## 28. Archive Policy

Archiver un artifact doit :

1. deplacer ou copier dans `archive/` ;
2. mettre a jour `artifacts.jsonl` ;
3. mettre a jour `manifest.json` si actif ;
4. ecrire la raison dans `decisions.md` ;
5. retirer l'artifact du contexte actif par defaut.

Schema :

```yaml
archive_record:
  artifact_id: string
  original_path: string
  archive_path: string
  reason: string
  archived_at: string
  archived_by_job_id: string
```

## 29. Exports

Les exports sont des representations partageables.

Chemin :

```text
outputs/exports/
```

Formats possibles :

- Markdown ;
- JSON ;
- PDF ;
- DOCX ;
- CSV ;
- ZIP.

Regle :

Un export ne doit pas devenir source de verite.
La source de verite reste dans les dossiers canoniques et manifests.

## 30. Templates

Le workspace peut contenir :

```text
workspace/templates/
  project_readme.md
  campaign_pack.md
  content_batch.md
  annual_calendar.md
  decision_log_entry.md
```

Role :

- garantir structure ;
- reduire variation inutile ;
- faciliter le File Writer ;
- standardiser les outputs.

Les templates doivent etre versionnes si leur structure change.

## 31. Global Registry

Chemin :

```text
workspace/global_registry/
```

Contenu futur possible :

```text
projects_index.json
agents_index.json
schemas_index.json
artifacts_index.json
```

Role :

- chercher rapidement les projets ;
- trouver les agents ;
- gerer les schemas ;
- auditer les artifacts globaux.

Ce dossier ne remplace pas les manifests projet.
Il sert d'index global.

## 32. Security And Privacy

Regles :

- ne jamais stocker de tokens ou secrets dans les projets ;
- ne pas stocker de donnees personnelles sensibles sans raison ;
- separer credentials et fichiers de contenu ;
- permettre d'archiver ou supprimer sur demande explicite ;
- marquer les sources de donnees utilisateur.

Fichiers interdits :

```text
api_keys.txt
tokens.json
credentials.md
```

Les credentials doivent etre geres par configuration separee, pas par le project file system.

## 33. Git Policy

Le workspace runtime peut contenir des donnees volumineuses ou privees.

Politique recommandee :

- les contrats et schemas sont versionnes dans Git ;
- les projets utilisateur peuvent etre hors Git ou ignores ;
- les exemples anonymises peuvent etre versionnes ;
- les logs runtime reels ne doivent pas etre commits par defaut ;
- les exports publics peuvent etre commits seulement si explicite.

Futur `.gitignore` probable :

```text
workspace/projects/
workspace/tmp/
workspace/logs/
```

Exception :

```text
workspace/templates/
workspace/README.md
```

## 34. Migration Policy

Comme les schemas vont evoluer, le file system doit prevoir les migrations.

Chaque manifest contient :

```yaml
schema_version: string
```

Regles :

- ne pas migrer silencieusement sans backup ;
- ecrire un log de migration ;
- conserver l'ancienne version en archive ;
- valider les fichiers apres migration.

## 35. Project Bootstrap

Creation minimale d'un projet :

```text
1. creer dossier project_slug
2. creer sous-dossiers canoniques
3. ecrire README.md
4. ecrire manifest.json
5. ecrire brief/original_brief.md
6. ecrire brief/normalized_brief.json
7. initialiser logs/*.jsonl
8. ecrire decisions.md
9. mettre a jour workspace_manifest.json
```

Le projet est `draft` tant que le Campaign Pack n'est pas produit.

## 36. Project Readiness Levels

```yaml
project_readiness:
  draft:
    description: "brief present, strategie incomplete"
  strategy_ready:
    description: "documents strategiques principaux presents"
  calendar_ready:
    description: "calendrier annuel present"
  production_ready:
    description: "pret a produire des Content Batches"
  archived:
    description: "retire du contexte actif"
```

Un Content Batch massif exige au minimum :

```text
production_ready
```

ou une validation explicite de l'utilisateur pour passer outre.

## 37. File System Quality Gates

Avant de terminer un job, verifier :

- manifest lisible ;
- fichiers attendus presents ;
- Markdown non vide ;
- JSON valide ;
- artifacts enregistres ;
- logs ecrits ;
- aucun fichier temporaire promu par erreur ;
- chemins relatifs corrects ;
- statuts coherents ;
- README projet a jour si necessaire.

Si un gate echoue :

- ne pas annoncer completion ;
- ecrire erreur ;
- proposer correction ;
- laisser le job en `failed` ou `needs_revision`.

## 38. Example - Projet SaaS Coach

```text
workspace/
  projects/
    coach_saas/
      README.md
      manifest.json
      brief/
        original_brief.md
        normalized_brief.json
        assumptions.md
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
        batches/
          batch_coach_saas_w04_fb_70_v001/
            README.md
            content_batch.md
            content_batch.json
            visual_briefs.md
            production_plan.json
      logs/
        jobs.jsonl
        agent_runs.jsonl
        artifacts.jsonl
        decisions.md
```

## 39. Anti-Patterns

Ne pas faire :

- stocker tous les outputs a la racine ;
- creer des fichiers `final.md`, `new.md`, `test.md` ;
- ecraser `positioning.md` sans version ;
- generer un batch sans le rattacher au calendrier ;
- laisser un fichier produit hors manifest/artifact registry ;
- utiliser la conversation comme unique memoire ;
- stocker des credentials dans le projet ;
- melanger logs et livrables ;
- mettre les archives dans le contexte actif par defaut ;
- annoncer un fichier sans verifier son existence.

## 40. Definition De Done

Le Project File System est correctement defini quand il permet de :

- creer un projet stable ;
- retrouver un projet ;
- lire le contexte strategique ;
- produire un Campaign Pack ;
- produire un Content Batch ;
- versionner les revisions ;
- journaliser les jobs ;
- auditer les agents ;
- archiver sans perdre ;
- reprendre un job ;
- eviter les collisions ;
- servir de memoire durable au runtime.

## 41. Principe Final

Le file system est la memoire longue de Crew_System.

Formule :

> Runtime pour agir + agents pour produire + fichiers pour se souvenir = systeme agentique durable.
