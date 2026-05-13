# Agent Machine Registry - Crew_System

## 1. Role

Ce document definit la premiere couche machine du registre agentique.

Les specs humaines vivent dans :

```text
docs/agents/
```

Le registre machine vit dans :

```text
registry/
```

Son role est de rendre les agents chargeables par le futur runtime :

- lister les agents disponibles ;
- pointer vers les prompts systeme ;
- pointer vers les schemas de sortie ;
- declarer routage, dependances et quality gates ;
- declarer les evals de base ;
- empecher le runtime de hardcoder les agents.

## 2. Principe

Le registre machine ne remplace pas les specs humaines.

Il les traduit en fichiers plus faciles a charger :

```text
spec humaine -> registry agent entry -> prompt -> schema -> eval -> routing
```

La spec humaine reste la source de verite strategique.
Le registre machine est la source de verite operationnelle.

## 3. Structure

```text
registry/
  README.md
  manifest.yaml
  agents/
    agents_index.json
    *.yaml
  prompts/
    *.system.txt
  schemas/
    *.schema.json
  routing/
    capabilities.yaml
    dependencies.yaml
    intents.yaml
    quality_gates.yaml
  evals/
    *.eval.yaml
```

## 4. Statut Des Agents

Tous les agents restent en `draft`.

Raison :

- le runtime loader n'existe pas encore ;
- les validateurs de schemas ne sont pas encore branches ;
- les evals ne sont pas encore executables ;
- aucun agent ne doit etre marque `active` avant verification runtime.

Le registre est donc complet comme couche source, mais pas encore active en production.

## 5. Regle D'Activation Future

Un agent pourra passer de `draft` a `active` seulement quand :

- son fichier `registry/agents/{agent_id}.yaml` est valide ;
- son prompt systeme existe ;
- son schema JSON est chargeable ;
- son eval existe ;
- son routage est declare ;
- ses dependances sont resolues ;
- au moins un test d'execution passe ;
- le runtime sait logger son execution.

## 6. Regle D'Intensite

Le registre conserve la regle strategique deja definie :

```text
Intensite maximale, faussete minimale.
```

Les gates machine doivent encadrer les sorties fortes.
Ils ne doivent pas neutraliser les agents psychologie, influence ou growth.

Une sortie forte doit etre revisee seulement si elle est :

- fausse ;
- non prouvable ;
- abusive ;
- spammy ;
- incoherente ;
- non assumable ;
- dangereuse pour la confiance long terme.

Sinon, le runtime doit preserver la version offensive propre.

## 7. Generation

Le registre est genere par :

```text
tools/generate_agent_registry.py
```

Le script lit les specs humaines et reconstruit :

- `manifest.yaml` ;
- `agents_index.json` ;
- les entrees agents YAML ;
- les prompts systeme ;
- les schemas JSON minimaux ;
- les evals draft ;
- les fichiers de routage.

## 8. Limite Actuelle

Les schemas JSON actuels sont volontairement minimaux.

Ils valident :

- la presence de la section principale attendue ;
- la presence possible de `self_evaluation` ;
- les scores standards quand ils existent.

Les schemas stricts viendront plus tard, quand le runtime et les premiers tests d'execution seront en place.

## 9. Definition De Done

Cette etape est terminee quand :

- les 18 agents ont une entree YAML ;
- les 18 agents ont un prompt systeme ;
- les 18 agents ont un schema JSON ;
- les 18 agents ont une eval draft ;
- le routage par intent existe ;
- les dependances existent ;
- les quality gates existent ;
- les fichiers JSON sont valides ;
- le registre reste coherent avec `docs/AGENT_REGISTRY_CONTRACT.md`.
