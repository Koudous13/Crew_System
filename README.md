# Crew_System

Strategic Communication OS powered by specialized agents.

Start here:

- [Strategic Communication OS](docs/STRATEGIC_COMMUNICATION_OS.md)
- [Background Agent OS Vision](docs/BACKGROUND_AGENT_OS_VISION.md)
- [Runtime Orchestration Contract](docs/RUNTIME_ORCHESTRATION_CONTRACT.md)
- [Project File System Contract](docs/PROJECT_FILE_SYSTEM_CONTRACT.md)
- [Agent Blueprint](docs/AGENT_BLUEPRINT.md)
- [Agent Registry Contract](docs/AGENT_REGISTRY_CONTRACT.md)
- [Agent Specs](docs/agents/README.md)
- [Campaign Pack Contract](docs/CAMPAIGN_PACK_CONTRACT.md)
- [Content Batch Contract](docs/CONTENT_BATCH_CONTRACT.md)
- [Supabase + Vercel Deployment](docs/SUPABASE_VERCEL_DEPLOYMENT.md)

## LLM provider

Le provider par defaut est `auto` :

1. Gemini/Gemma si `GEMINI_API_KEY` est configuree ;
2. erreur claire si Gemini/Gemma n'est pas configure ;
3. pas de fallback automatique vers DeepSeek ou mock.

DeepSeek est disponible uniquement sur demande explicite avec `--provider deepseek`.
Le mock deterministe est reserve aux tests explicites avec `--mock` ou `--provider mock`.

Copier `.env.example` vers `.env`, puis renseigner la cle voulue. Pour Gemini :

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemma-4-26b-a4b-it
GEMINI_STEP_TIMEOUT_SECONDS=28
GEMINI_MAX_OUTPUT_TOKENS=2048
GEMINI_RESPONSE_SCHEMA=false
```

`GEMINI_RESPONSE_SCHEMA=false` evite d'envoyer les schemas complets au provider quand un modele Gemma les gere mal. Le systeme demande toujours du JSON et valide localement la sortie de chaque agent.

Execution manuelle :

```powershell
python -m crew_system run content-batch --project koudous_daouda_le_robot --provider gemini --count 10
```

## Cloud gratuit

La voie cloud gratuite recommandee est maintenant Vercel + Supabase :

- Vercel heberge l'interface Next.js et le backend `/crew-api` ;
- Supabase stocke projets, conversations, jobs, progression et documents Markdown ;
- Gemini/Gemma execute les agents reels.

Variables minimales cote Vercel :

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemma-4-26b-a4b-it
GEMINI_RESPONSE_SCHEMA=false
```

Le schema SQL a executer dans Supabase est dans `supabase/schema.sql`.
