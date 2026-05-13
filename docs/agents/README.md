# Agent Specs - Crew_System

## Role

This folder contains the concrete agent specifications used by Crew_System.

The contracts define the system.
These files define the first real agents.

Reference documents:

- `docs/AGENT_BLUEPRINT.md`
- `docs/AGENT_REGISTRY_CONTRACT.md`
- `docs/RUNTIME_ORCHESTRATION_CONTRACT.md`
- `docs/CAMPAIGN_PACK_CONTRACT.md`
- `docs/PROJECT_FILE_SYSTEM_CONTRACT.md`

## First Wave

The first wave focuses on foundation agents.

These agents are required before content, growth, creative or video agents can produce reliable work.

```text
docs/agents/core/
  intake_normalizer.md
  file_architect.md
  strategist.md
  audience_psychologist.md
  positioning_agent.md
```

## Why These Agents First

`intake_normalizer` transforms a raw user idea into a usable brief.

`file_architect` makes the project durable by planning folders, files and manifests.

`strategist` defines the strategic problem, big idea and arbitration logic.

`audience_psychologist` identifies the human tensions that make the campaign powerful.

`positioning_agent` transforms the offer into a clear, memorable and defensible position.

Without these five agents, the system can generate content, but it cannot stay coherent.

## Rule

No agent should be implemented in code before its spec exists here and satisfies the blueprint.

## Spec Status

These Markdown files are human-readable agent specs.

They are not yet the final machine-readable registry entries.

The next implementation layer can derive or mirror them into:

```text
registry/agents/*.yaml
registry/prompts/*.txt
registry/schemas/*.json
registry/evals/*.json
```

Until schemas and evals are executable, these agents stay `draft`.

## Completeness Check

Each agent spec must contain:

- identity ;
- mission ;
- CrewAI mapping ;
- ownership ;
- inputs ;
- output contract ;
- routing ;
- dependencies ;
- guardrails ;
- quality gates ;
- handoff ;
- system prompt draft ;
- evaluation cases ;
- reasoning method ;
- tools ;
- memory policy ;
- execution ;
- observability ;
- versioning.
