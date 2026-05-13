# Specs Agents - Crew_System

## Role

Ce dossier contient les specifications concretes des agents de Crew_System.

Les contrats definissent le systeme.
Ces fichiers definissent les premiers vrais agents.

Documents de reference :

- `docs/AGENT_BLUEPRINT.md`
- `docs/AGENT_REGISTRY_CONTRACT.md`
- `docs/RUNTIME_ORCHESTRATION_CONTRACT.md`
- `docs/CAMPAIGN_PACK_CONTRACT.md`
- `docs/PROJECT_FILE_SYSTEM_CONTRACT.md`

## Premiere Vague

La premiere vague se concentre sur les agents de fondation.

Ces agents sont necessaires avant que les agents de contenu, growth, creation ou video puissent produire un travail fiable.

```text
docs/agents/core/
  intake_normalizer.md
  file_architect.md
  strategist.md
  audience_psychologist.md
  positioning_agent.md
```

## Pourquoi Ces Agents D'Abord

`intake_normalizer` transforme une idee brute en brief utilisable.

`file_architect` rend le projet durable en planifiant les dossiers, fichiers et manifests.

`strategist` definit le probleme strategique, la big idea et la logique d'arbitrage.

`audience_psychologist` identifie les tensions humaines qui rendent une campagne puissante.

`positioning_agent` transforme l'offre en position claire, memorable et defendable.

Sans ces cinq agents, le systeme peut generer du contenu, mais il ne peut pas rester coherent.

## Deuxieme Vague

La deuxieme vague transforme la strategie en influence, growth, plateforme, calendrier et production de contenu.

Specs disponibles dans cette vague :

```text
docs/agents/strategy/
  influence_architect.md
```

## Regle

Aucun agent ne doit etre implemente dans le code tant que sa spec n'existe pas ici et ne respecte pas le blueprint.

## Statut Des Specs

Ces fichiers Markdown sont les specifications humaines des agents.

Ce ne sont pas encore les entrees machine finales du registre.

La couche d'implementation suivante pourra les deriver ou les dupliquer vers :

```text
registry/agents/*.yaml
registry/prompts/*.txt
registry/schemas/*.json
registry/evals/*.json
```

Tant que les schemas et evals ne sont pas executables, ces agents restent `draft`.

## Verification De Completude

Chaque spec agent doit contenir :

- identite ;
- mission ;
- mapping CrewAI ;
- responsabilites ;
- inputs ;
- contrat de sortie ;
- routage ;
- dependances ;
- garde-fous ;
- quality gates ;
- handoff ;
- prompt systeme draft ;
- cas d'evaluation ;
- methode de raisonnement ;
- outils ;
- politique memoire ;
- execution ;
- observabilite ;
- versioning.
