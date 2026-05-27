# Couche Supabase n8n - Crew_System

## 1. Decision

La couche Supabase est maintenant branchee dans n8n directement dans le workflow Directeur `CS_CHAT_DIRECTOR_NATIVE`.

Le Directeur ne branche pas les nodes Supabase classiques directement comme tools IA.

Raison :

```text
Le node Supabase classique lit/ecrit bien la base, mais il n'expose pas la methode supplyData attendue par l'AI Agent.
Donc il echoue s'il est branche directement en ai_tool.
```

Pattern retenu :

```text
Directeur AI Agent
  -> Call n8n Workflow Tool
  -> Workflow JSON integre dans le tool
  -> Execute Workflow Trigger
  -> Node Supabase normal
  -> Format Tool Response
```

Ce pattern garde la proprete du modele Master/Worker sans encombrer l'interface n8n avec 14 workflows separes.

Les anciens workflows `CS_TOOL_SUPABASE_*` crees pour tester la couche ont ete supprimes apres validation.

## 2. Credential utilise

Credential n8n :

```text
Supabase Crew System
```

Type :

```text
supabaseApi
```

Ne jamais stocker les secrets Supabase dans le repo.

## 3. Schema Supabase

La migration ajoute la couche agentique :

```text
crew_agent_runs
crew_decisions
crew_errors
crew_documents
```

Fichier :

```text
supabase/migrations/20260525_agentic_runtime_layer.sql
```

Le schema complet est aussi synchronise dans :

```text
supabase/schema.sql
```

## 4. Tools Supabase branches

Tools de lecture :

```text
cs_supabase_list_projects
cs_supabase_load_project_record
cs_supabase_load_project_jobs
cs_supabase_load_project_decisions
cs_supabase_load_project_documents
cs_supabase_load_project_artifacts
cs_supabase_load_job_progress
```

Tools d'ecriture :

```text
cs_supabase_create_project
cs_supabase_create_job
cs_supabase_add_progress_event
cs_supabase_save_decision
cs_supabase_save_error
cs_supabase_save_artifact
cs_supabase_save_document_index
```

## 5. Implementation n8n actuelle

```text
Workflow principal : CS_CHAT_DIRECTOR_NATIVE
Tools Supabase : 14
Mode des tools : Call n8n Workflow Tool / source parameter
Sous-workflows Supabase externes : 0
Sticky notes d'organisation : 5
```

Chaque tool contient son workflow JSON integre :

```text
Execute Workflow Trigger
  -> Supabase node
  -> Format Tool Response
```

Chaque tool retourne une structure lisible au Directeur :

```json
{
  "ok": true,
  "tool": "tool_name",
  "count": 1,
  "rows": []
}
```

## 6. Tests valides

Test lecture :

```text
Demande : lister les projets connus.
Resultat : le Directeur a utilise Supabase et a retrouve "Ecole 229".
Statut : succes.
```

Test apres suppression des anciens workflows :

```text
Workflow principal actif : oui.
Tools Supabase integres : 14.
Ancien CS_TOOL_SUPABASE_* restant : 0.
Reponse webhook : "Ecole 229".
Statut : succes.
```

Test ecriture :

```text
Demande : charger ecole_229, creer un job de test et ajouter un progress event a 12%.
Resultat : job cree dans crew_jobs, event cree dans crew_progress_events.
Statut : succes.
```

## 7. Regles pour le Directeur

Avant tout travail important sur un projet existant :

```text
1. cs_supabase_list_projects
2. cs_supabase_load_project_record
3. cs_supabase_load_project_jobs
4. cs_supabase_load_project_decisions
5. cs_supabase_load_project_documents
6. cs_supabase_load_project_artifacts
```

Pour un travail long :

```text
1. cs_supabase_create_job
2. cs_supabase_add_progress_event
3. sous-agents
4. cs_supabase_save_decision
5. cs_supabase_save_artifact ou cs_supabase_save_document_index
```

En cas d'erreur :

```text
cs_supabase_save_error
```

## 8. Points a renforcer ensuite

Les statuts doivent rester standardises :

```text
queued
running
blocked
completed
failed
info
```

La prochaine couche a construire :

```text
Google Drive Tools
```

Objectif :

```text
Supabase = memoire operationnelle
Google Drive = documents Markdown lisibles
n8n Chat = cockpit utilisateur
```
