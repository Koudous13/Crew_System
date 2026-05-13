# Agent Machine Registry - Crew_System

Ce dossier contient la premiere couche machine du registre agentique.

Il transforme les specs humaines dans `docs/agents/` en fichiers chargeables par le futur runtime.

Structure :

```text
registry/
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

Statut actuel : `draft`.

Les agents sont declares et routables, mais ils ne doivent pas etre consideres comme `active` tant que le loader runtime, les validateurs de schema et les evals executables ne sont pas implementes.
