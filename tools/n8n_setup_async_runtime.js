const fs = require("fs");
const crypto = require("crypto");

const MAIN_WORKFLOW_ID = "U3eGOTVq0DenA2pm";
const WORKER_WORKFLOW_ID = "7VRaCvaGkBQHFGAL";
const WORKER_WORKFLOW_NAME = "CS_ASYNC_JOB_WORKER";
const SUPABASE_CREDENTIAL = { id: "OMiEiywYcayYYI4W", name: "Supabase Crew System" };
const GOOGLE_DRIVE_CREDENTIAL = { id: "36SWGQsLOy8AtByx", name: "Google Drive Crew System" };
const AGENT_WORKFLOWS = {
  strategist: { id: "VXBmmqF8gIljYDsd", name: "CS_AGENT_STRATEGIST" },
  audience: { id: "agRG9BP0CbQ11da0", name: "CS_AGENT_AUDIENCE_PSYCHOLOGIST" },
  growth: { id: "tSVq9yKCwxLjjbiI", name: "CS_AGENT_GROWTH_HACKER" },
  hooks: { id: "nS0MNOaFNLBgCQj6", name: "CS_AGENT_HOOK_MASTER" },
  calendar: { id: "ZrYnC5h62cxTnNG7", name: "CS_AGENT_CALENDAR_ARCHITECT" },
  facebook: { id: "bMyHsvzbOcSq2er2", name: "CS_AGENT_FACEBOOK_NATIVE" },
  linkedin: { id: "XIcYN5ox2pf8BXxr", name: "CS_AGENT_LINKEDIN_NATIVE" },
  copywriter: { id: "wkpAuT6QUUbB5d8D", name: "CS_AGENT_COPYWRITER" },
  creative: { id: "fcK2074Gtm0IDcsE", name: "CS_AGENT_CREATIVE_DIRECTOR" },
};

function loadEnv(path) {
  const content = fs.readFileSync(path, "utf8");
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function nodeId() {
  return crypto.randomUUID();
}

async function n8nFetch(baseUrl, apiKey, path, options = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`n8n API ${response.status} ${path}: ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

function workflowUpdatePayload(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections || {},
    settings: workflow.settings || { executionOrder: "v1" },
  };
}

function supabaseNode(name, operation, tableId, fieldValues, position, extra = {}) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position,
    parameters: {
      resource: "row",
      operation,
      tableId,
      dataToSend: "defineBelow",
      fieldsUi: { fieldValues },
      ...(extra.parameters || {}),
    },
    credentials: { supabaseApi: SUPABASE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    ...(extra.node || {}),
  };
}

function supabaseGetAllNode(name, tableId, limit, filterString, position, extra = {}) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position,
    parameters: {
      resource: "row",
      operation: "getAll",
      tableId,
      returnAll: false,
      limit,
      filterType: "string",
      filterString,
      ...(extra.parameters || {}),
    },
    credentials: { supabaseApi: SUPABASE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1500,
    ...(extra.node || {}),
  };
}

function codeNode(name, jsCode, position) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: { jsCode },
  };
}

function triggerNode(name, position) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.executeWorkflowTrigger",
    typeVersion: 1.1,
    position,
    parameters: { inputSource: "passthrough" },
  };
}

function ifNode(name, conditionExpression, position) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.if",
    typeVersion: 1,
    position,
    parameters: {
      conditions: {
        boolean: [{ value1: conditionExpression, value2: true }],
      },
    },
  };
}

function progressNode(name, percent, phase, message, activeAgents, position) {
  return supabaseNode(
    name,
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Prepare Worker Input').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Prepare Worker Input').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "running" },
      { fieldId: "message", fieldValue: message },
      { fieldId: "percent_estimate", fieldValue: String(percent) },
      { fieldId: "current_phase", fieldValue: phase },
      { fieldId: "active_agents", fieldValue: `={{ ${JSON.stringify(activeAgents)} }}` },
    ],
    position,
  );
}

function agentWorkflowNode(name, agentWorkflow, position, expectedOutput, previousAgentOutputsExpression) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.executeWorkflow",
    typeVersion: 1.2,
    position,
    parameters: {
      workflowId: {
        __rl: true,
        mode: "id",
        value: agentWorkflow.id,
        cachedResultName: agentWorkflow.name,
      },
      workflowInputs: {
        mappingMode: "defineBelow",
        value: {
          project_slug: "={{ $('Prepare Worker Input').first().json.project_slug }}",
          user_request: "={{ $('Prepare Worker Input').first().json.request_message }}",
          normalized_brief: "={{ $('Prepare Worker Input').first().json.request_message }}",
          context_summary: "={{ $('Prepare Worker Input').first().json.context_summary }}",
          previous_agent_outputs: previousAgentOutputsExpression || "",
          platform_context: "Facebook, LinkedIn",
          constraints:
            "Travail en francais. Intensite strategique forte, utile et defendable. Pas de spam, pas de promesses inventees, pas de JSON dans le livrable final.",
          expected_output: expectedOutput,
          language: "francais",
        },
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      options: { waitForSubWorkflow: true },
    },
    alwaysOutputData: true,
    continueOnFail: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
  };
}

function agentCheckpointNode(name, agentId, sourceNodeName, position) {
  return codeNode(
    name,
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return { ok: false, error: error.message }; }
}
function pickPayload(value) {
  if (value && value.output && typeof value.output === 'object') return value.output;
  return value || {};
}
function summarize(value, limit = 900) {
  if (!value) return '';
  const direct = value.handoff_summary || value.summary || value.strategic_diagnosis || value.growth_diagnosis || value.audience_diagnosis || value.hook_strategy || value.facebook_strategy || value.linkedin_strategy || value.annual_editorial_calendar || value.content_units || value.creative_direction;
  const text = typeof direct === 'string' && direct.trim() ? direct.trim() : JSON.stringify(value).replace(/\\s+/g, ' ');
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}
function score(value, keys) {
  for (const key of keys) {
    const number = Number(value?.[key]);
    if (Number.isFinite(number)) return Math.max(0, Math.min(100, Math.round(number)));
  }
  return null;
}
const base = $('Prepare Worker Input').first().json || {};
const raw = readNode('${sourceNodeName}');
const payload = pickPayload(raw);
const rawStatus = String(payload.status || raw.status || '').toLowerCase();
const invalidReasons = raw.invalid_reasons || payload.invalid_reasons || [];
const isFailed = raw.ok === false || Boolean(raw.error) || ['error', 'failed', 'blocked'].includes(rawStatus);
const status = isFailed ? 'failed' : (rawStatus === 'needs_context' ? 'needs_context' : 'completed');
const self = payload.self_evaluation || {};
const error = raw.error || payload.error || (isFailed ? invalidReasons.join('; ') : '');
return [{ json: {
  agent_run_id: 'agentrun_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10),
  job_id: base.job_id,
  project_slug: base.project_slug,
  agent_id: '${agentId}',
  agent_version: 'n8n_subworkflow_v1',
  status,
  input_summary: String(base.request_message || '').slice(0, 1200),
  output_summary: summarize(payload),
  handoff: payload,
  quality_score: score(self, ['quality_score', 'usefulness_score', 'precision_score']),
  confidence_score: score(self, ['confidence_score', 'precision_score']),
  error: String(error || '').slice(0, 1200),
  started_at: new Date().toISOString(),
  completed_at: new Date().toISOString()
} }];`,
    position,
  );
}

function saveAgentRunNode(name, position) {
  return supabaseNode(
    name,
    "create",
    "crew_agent_runs",
    [
      { fieldId: "agent_run_id", fieldValue: "={{ $json.agent_run_id }}" },
      { fieldId: "job_id", fieldValue: "={{ $json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $json.project_slug }}" },
      { fieldId: "agent_id", fieldValue: "={{ $json.agent_id }}" },
      { fieldId: "agent_version", fieldValue: "={{ $json.agent_version }}" },
      { fieldId: "status", fieldValue: "={{ $json.status }}" },
      { fieldId: "input_summary", fieldValue: "={{ $json.input_summary }}" },
      { fieldId: "output_summary", fieldValue: "={{ $json.output_summary }}" },
      { fieldId: "handoff", fieldValue: "={{ $json.handoff }}" },
      { fieldId: "quality_score", fieldValue: "={{ $json.quality_score }}" },
      { fieldId: "confidence_score", fieldValue: "={{ $json.confidence_score }}" },
      { fieldId: "error", fieldValue: "={{ $json.error }}" },
      { fieldId: "started_at", fieldValue: "={{ $json.started_at }}" },
      { fieldId: "completed_at", fieldValue: "={{ $json.completed_at }}" },
    ],
    position,
    { node: { continueOnFail: true, retryOnFail: false } },
  );
}

function googleDriveCreateTextNode(name, position) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    position,
    parameters: {
      resource: "file",
      operation: "createFromText",
      content: "={{ $('Build Artifact And Completion Payload').first().json.content }}",
      name: "={{ $('Build Artifact And Completion Payload').first().json.drive_file_name }}",
      driveId: {
        __rl: true,
        mode: "list",
        value: "My Drive",
      },
      folderId: {
        __rl: true,
        mode: "list",
        value: "root",
        cachedResultName: "/ (Root folder)",
      },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
    continueOnFail: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
  };
}

function buildAsyncToolWorkflow(workerWorkflowId) {
  const trigger = triggerNode("When called by Directeur", [0, 0]);
  const prepare = codeNode(
    "Prepare Async Job",
    `const input = $input.first().json || {};
const query = input.query || input;
function clean(value) {
  return String(value || '').trim();
}
function shortText(value, limit = 220) {
  const text = clean(value).replace(/\\s+/g, ' ');
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}
const request_message = clean(query.request_message || query.user_request || query.message || query.chatInput || '');
const project_slug = clean(query.project_slug || query.projectSlug || 'koudous_daouda_le_robot');
const project_name = clean(query.project_name || query.projectName || 'Koudous DAOUDA - Le Robot');
const description = clean(query.project_description || query.description || "Marque personnelle de Koudous DAOUDA, Le Robot : automatisation n8n/Python, applications web, domination Facebook et LinkedIn.");
const job_type = clean(query.job_type || query.jobType || 'async_agentic_job');
const context_summary = clean(query.context_summary || query.context || '');
const expected_output = clean(query.expected_output || query.livrable || 'Livrable final en Markdown lisible, exploitable et sans JSON brut.');
const job_id = clean(query.job_id) || 'job_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10);
const queued_message = "J'ai lancé le chantier en arrière-plan. Les agents vont travailler proprement et le livrable sera sauvegardé dès qu'il est prêt.";
const worker_prompt = [
  'Mission asynchrone Crew_System.',
  'job_id: ' + job_id,
  'project_slug: ' + project_slug,
  'job_type: ' + job_type,
  'Demande utilisateur: ' + request_message,
  'Contexte utile: ' + context_summary,
  'Livrable attendu: ' + expected_output,
  '',
  'Travaille comme un vrai atelier agentique : lis le contexte disponible, appelle les agents utiles, produis un document final Markdown lisible et directement exploitable.',
  'Ne retourne jamais de JSON brut, notes internes, prompts, raisonnement caché ou détails techniques.'
].join('\\n');
return [{ json: { ...query, job_id, project_slug, project_name, description, request_message, job_type, context_summary, expected_output, queued_message, worker_prompt, public_summary: shortText(request_message) } }];`,
    [260, 0],
  );
  const ensureProject = supabaseNode(
    "Ensure crew_project",
    "create",
    "crew_projects",
    [
      { fieldId: "project_slug", fieldValue: "={{ $('Prepare Async Job').first().json.project_slug }}" },
      { fieldId: "project_name", fieldValue: "={{ $('Prepare Async Job').first().json.project_name }}" },
      { fieldId: "description", fieldValue: "={{ $('Prepare Async Job').first().json.description }}" },
    ],
    [560, 0],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const createJob = supabaseNode(
    "Create async crew_job",
    "create",
    "crew_jobs",
    [
      { fieldId: "job_id", fieldValue: "={{ $('Prepare Async Job').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Prepare Async Job').first().json.project_slug }}" },
      { fieldId: "request_message", fieldValue: "={{ $('Prepare Async Job').first().json.request_message }}" },
      { fieldId: "status", fieldValue: "queued" },
      { fieldId: "provider", fieldValue: "n8n_gemini" },
      { fieldId: "assistant_message", fieldValue: "={{ $('Prepare Async Job').first().json.queued_message }}" },
      { fieldId: "percent_estimate", fieldValue: "1" },
      { fieldId: "current_phase", fieldValue: "queued" },
    ],
    [860, 0],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const addQueuedProgress = supabaseNode(
    "Add queued progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Prepare Async Job').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Prepare Async Job').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "queued" },
      { fieldId: "message", fieldValue: "Chantier créé. Le worker agentique va prendre le relais." },
      { fieldId: "percent_estimate", fieldValue: "1" },
      { fieldId: "current_phase", fieldValue: "queued" },
      { fieldId: "active_agents", fieldValue: "={{ ['director_async_worker'] }}" },
    ],
    [1160, 0],
  );
  const launchWorker = {
    id: nodeId(),
    name: "Launch Async Worker",
    type: "n8n-nodes-base.executeWorkflow",
    typeVersion: 1.2,
    position: [1460, 0],
    parameters: {
      workflowId: {
        __rl: true,
        mode: "id",
        value: workerWorkflowId,
        cachedResultName: WORKER_WORKFLOW_NAME,
      },
      workflowInputs: {
        mappingMode: "defineBelow",
        value: {
          job_id: "={{ $('Prepare Async Job').first().json.job_id }}",
          project_slug: "={{ $('Prepare Async Job').first().json.project_slug }}",
          request_message: "={{ $('Prepare Async Job').first().json.request_message }}",
          job_type: "={{ $('Prepare Async Job').first().json.job_type }}",
          context_summary: "={{ $('Prepare Async Job').first().json.context_summary }}",
          expected_output: "={{ $('Prepare Async Job').first().json.expected_output }}",
          worker_prompt: "={{ $('Prepare Async Job').first().json.worker_prompt }}",
        },
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      options: {
        waitForSubWorkflow: false,
      },
    },
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1000,
  };
  const formatResponse = codeNode(
    "Format Async Tool Response",
    `const job = $('Prepare Async Job').first().json;
return [{ json: {
  ok: true,
  tool: 'cs_async_start_job',
  job_id: job.job_id,
  project_slug: job.project_slug,
  status: 'queued',
  message: job.queued_message,
  user_message: job.queued_message + "\\n\\nJe te donne l'identifiant du chantier : " + job.job_id + ".",
  next_step: "Le worker en arrière-plan appellera les agents utiles, sauvegardera un livrable Markdown et marquera le job terminé."
} }];`,
    [1760, 0],
  );

  return {
    nodes: [trigger, prepare, ensureProject, createJob, addQueuedProgress, launchWorker, formatResponse],
    connections: {
      [trigger.name]: { main: [[{ node: prepare.name, type: "main", index: 0 }]] },
      [prepare.name]: { main: [[{ node: ensureProject.name, type: "main", index: 0 }]] },
      [ensureProject.name]: { main: [[{ node: createJob.name, type: "main", index: 0 }]] },
      [createJob.name]: { main: [[{ node: addQueuedProgress.name, type: "main", index: 0 }]] },
      [addQueuedProgress.name]: { main: [[{ node: launchWorker.name, type: "main", index: 0 }]] },
      [launchWorker.name]: { main: [[{ node: formatResponse.name, type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
}

function buildWorkerWorkflow(mainWorkflow, existingWorker) {
  const copyNames = new Set(["Gemini Chat Model"]);
  const copiedCore = mainWorkflow.nodes
    .filter((node) => copyNames.has(node.name))
    .map((node) => ({ ...JSON.parse(JSON.stringify(node)), id: nodeId() }));
  const model = copiedCore.find((node) => node.name === "Gemini Chat Model");
  const toolNodes = mainWorkflow.nodes
    .filter((node) => node.name.startsWith("cs_supabase_") || node.name.startsWith("cs_agent_") || node.name.startsWith("cs_drive_"))
    .map((node, index) => ({
      ...JSON.parse(JSON.stringify(node)),
      id: nodeId(),
      position: [320 + (index % 5) * 280, 720 + Math.floor(index / 5) * 160],
    }));

  const note = {
    id: nodeId(),
    name: "NOTE - Async Worker Contract",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [-720, -360],
    parameters: {
      color: 5,
      width: 700,
      height: 300,
      content:
        "## CS_ASYNC_JOB_WORKER\n\nWorker appelé en arrière-plan par `cs_async_start_job`.\n\n- reçoit `job_id`, `project_slug`, `request_message`\n- marque le job en cours\n- appelle les agents utiles\n- sauvegarde le livrable final dans `crew_artifacts`\n- ajoute les événements de progression\n- marque le job `completed`\n\nNe répond jamais directement au chat utilisateur.",
    },
  };
  const trigger = triggerNode("When called by async launcher", [-520, 0]);
  const prepare = codeNode(
    "Prepare Worker Input",
    `const input = $input.first().json || {};
const project_slug = input.project_slug || 'koudous_daouda_le_robot';
const job_id = input.job_id;
const request_message = input.request_message || input.chatInput || '';
const job_type = input.job_type || 'async_agentic_job';
const context = input.context_summary || '';
const expected_output = input.expected_output || 'Livrable final Markdown lisible.';
const worker_prompt = input.worker_prompt || [
  'Mode worker asynchrone Crew_System.',
  'job_id: ' + job_id,
  'project_slug: ' + project_slug,
  'job_type: ' + job_type,
  'Demande utilisateur: ' + request_message,
  'Contexte: ' + context,
  'Livrable attendu: ' + expected_output,
  'Travaille en arrière-plan. Appelle les agents utiles. Retourne un livrable final en Markdown lisible. Ne montre pas de JSON brut.'
].join('\\n');
return [{ json: { ...input, project_slug, job_id, request_message, job_type, context_summary: context, expected_output, worker_prompt } }];`,
    [-220, 0],
  );
  const markRunning = supabaseNode(
    "Mark Job Running",
    "update",
    "crew_jobs",
    [
      { fieldId: "status", fieldValue: "running" },
      { fieldId: "percent_estimate", fieldValue: "10" },
      { fieldId: "current_phase", fieldValue: "routing_agents" },
    ],
    [80, 0],
    { parameters: { filterType: "string", filterString: "={{ 'job_id=eq.' + $('Prepare Worker Input').first().json.job_id }}" } },
  );
  const addRunningProgress = supabaseNode(
    "Add Running Progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Prepare Worker Input').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Prepare Worker Input').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "running" },
      { fieldId: "message", fieldValue: "Le worker a démarré. Il route la demande vers les agents utiles." },
      { fieldId: "percent_estimate", fieldValue: "10" },
      { fieldId: "current_phase", fieldValue: "routing_agents" },
      { fieldId: "active_agents", fieldValue: "={{ ['director_async_worker'] }}" },
    ],
    [380, 0],
  );
  const agent = {
    id: nodeId(),
    name: "Async Worker Directeur",
    type: "@n8n/n8n-nodes-langchain.agent",
    typeVersion: 2.2,
    position: [720, 0],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 4000,
    parameters: {
      promptType: "define",
      text: "={{ $('Prepare Worker Input').first().json.worker_prompt }}",
      options: {
        systemMessage:
          "Tu es le Worker asynchrone de Crew_System.\n\nTu ne discutes pas directement avec Koudous. Tu exécutes un job déjà créé par le Directeur.\n\nRègles strictes :\n1. Utilise le job_id et le project_slug fournis.\n2. Ne crée pas un nouveau job.\n3. Appelle les sous-agents pertinents selon la demande.\n4. Pour Le Robot, utilise le contexte stable : Koudous DAOUDA, expert automatisation n8n/Python et applications web, cible PME/solopreneurs, plateformes Facebook/LinkedIn, angle automatiser l'ennuyeux et réduire le chaos opérationnel.\n5. Tu peux utiliser Supabase pour lire contexte, décisions, documents et artifacts.\n6. Tu peux utiliser Google Drive si un document doit être créé ou lu.\n7. Retourne seulement un livrable final Markdown lisible, sans JSON brut, sans notes internes, sans brouillon.\n8. Ta sortie finale doit commencer directement par un titre Markdown de niveau 1, par exemple `# Chantier Stratégique...`.\n9. Si une information manque, produis quand même une première version utile et liste les questions restantes à la fin.\n10. Ne dis pas que tu as sauvegardé un document : la sauvegarde finale est faite par les nodes déterministes après ta sortie.",
      },
    },
  };
  const sanitizer = codeNode(
    "Worker Markdown Sanitizer",
    `let output = String($json.output || $json.text || $json.response || '').trim();
const h1 = output.search(/(^|\\n)#\\s+/);
if (h1 > 0) {
  output = output.slice(h1).trim();
}
output = output
  .replace(/^\\*{3,}\\s*/g, '')
  .replace(/^(?:All agents have completed[\\s\\S]*?)(?=#\\s+)/i, '')
  .replace(/^(?:J'ai termin[eé][\\s\\S]*?)(?=#\\s+)/i, '')
  .trim();
return [{ json: { output } }];`,
    [1020, 0],
  );
  const buildPayload = codeNode(
    "Build Artifact And Completion Payload",
    `const output = String($json.output || $json.public_candidate || $json.text || '').trim();
let base = {};
try { base = $('Prepare Worker Input').first().json || {}; } catch (error) { base = {}; }
const job_id = base.job_id || 'job_unknown';
const project_slug = base.project_slug || 'koudous_daouda_le_robot';
const safeJob = String(job_id).replace(/[^a-zA-Z0-9_-]/g, '_');
const content = output || 'Job terminé, mais la sortie finale était vide.';
return [{ json: {
  job_id,
  project_slug,
  artifact_id: 'artifact_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  completion_event_id: 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  path: 'async_jobs/' + safeJob + '/final.md',
  content_type: 'text/markdown',
  content,
  status: 'completed',
  assistant_message: content,
  percent_estimate: 100,
  current_phase: 'completed',
  agents_used: base.agents_used || []
} }];`,
    [1620, 0],
  );
  const saveArtifact = supabaseNode(
    "Save Final Artifact",
    "create",
    "crew_artifacts",
    [
      { fieldId: "artifact_id", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.artifact_id }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.project_slug }}" },
      { fieldId: "path", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.path }}" },
      { fieldId: "status", fieldValue: "completed" },
      { fieldId: "content_type", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.content_type }}" },
      { fieldId: "content", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.content }}" },
    ],
    [1920, 0],
  );
  const completionProgress = supabaseNode(
    "Add Completion Progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.completion_event_id }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "completed" },
      { fieldId: "message", fieldValue: "Job terminé. Le livrable final est disponible." },
      { fieldId: "percent_estimate", fieldValue: "100" },
      { fieldId: "current_phase", fieldValue: "completed" },
      { fieldId: "artifacts_created", fieldValue: "={{ [$('Build Artifact And Completion Payload').first().json.path] }}" },
    ],
    [2220, 0],
  );
  const markCompleted = supabaseNode(
    "Mark Job Completed",
    "update",
    "crew_jobs",
    [
      { fieldId: "status", fieldValue: "completed" },
      { fieldId: "assistant_message", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.content }}" },
      { fieldId: "artifacts_created", fieldValue: "={{ [$('Build Artifact And Completion Payload').first().json.path] }}" },
      { fieldId: "percent_estimate", fieldValue: "100" },
      { fieldId: "current_phase", fieldValue: "completed" },
      { fieldId: "completed_at", fieldValue: "={{ new Date().toISOString() }}" },
    ],
    [2520, 0],
    { parameters: { filterType: "string", filterString: "={{ 'job_id=eq.' + $('Build Artifact And Completion Payload').first().json.job_id }}" } },
  );

  model.position = [720, -260];

  const nodes = [
    note,
    trigger,
    prepare,
    markRunning,
    addRunningProgress,
    agent,
    model,
    sanitizer,
    buildPayload,
    saveArtifact,
    completionProgress,
    markCompleted,
    ...toolNodes,
  ];
  const connections = {
    [trigger.name]: { main: [[{ node: prepare.name, type: "main", index: 0 }]] },
    [prepare.name]: { main: [[{ node: markRunning.name, type: "main", index: 0 }]] },
    [markRunning.name]: { main: [[{ node: addRunningProgress.name, type: "main", index: 0 }]] },
    [addRunningProgress.name]: { main: [[{ node: agent.name, type: "main", index: 0 }]] },
    [model.name]: { ai_languageModel: [[{ node: agent.name, type: "ai_languageModel", index: 0 }]] },
    [agent.name]: { main: [[{ node: sanitizer.name, type: "main", index: 0 }]] },
    [sanitizer.name]: { main: [[{ node: buildPayload.name, type: "main", index: 0 }]] },
    [buildPayload.name]: { main: [[{ node: saveArtifact.name, type: "main", index: 0 }]] },
    [saveArtifact.name]: { main: [[{ node: completionProgress.name, type: "main", index: 0 }]] },
    [completionProgress.name]: { main: [[{ node: markCompleted.name, type: "main", index: 0 }]] },
  };
  for (const tool of toolNodes) {
    connections[tool.name] = { ai_tool: [[{ node: agent.name, type: "ai_tool", index: 0 }]] };
  }
  return {
    ...existingWorker,
    name: WORKER_WORKFLOW_NAME,
    nodes,
    connections,
    settings: { ...(existingWorker.settings || {}), executionOrder: "v1" },
  };
}

function buildWorkerWorkflowV2(mainWorkflow, existingWorker) {
  const copiedCore = mainWorkflow.nodes
    .filter((node) => node.name === "Gemini Chat Model")
    .map((node) => ({ ...JSON.parse(JSON.stringify(node)), id: nodeId() }));
  const model = copiedCore.find((node) => node.name === "Gemini Chat Model");
  if (!model) throw new Error("Gemini Chat Model node not found in main workflow.");

  const toolNodes = mainWorkflow.nodes
    .filter((node) => node.name.startsWith("cs_supabase_") || node.name.startsWith("cs_drive_"))
    .map((node, index) => ({
      ...JSON.parse(JSON.stringify(node)),
      id: nodeId(),
      position: [3340 + (index % 4) * 280, 680 + Math.floor(index / 4) * 150],
    }));

  const note = {
    id: nodeId(),
    name: "NOTE - Async Worker Contract",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [-760, -420],
    parameters: {
      color: 5,
      width: 820,
      height: 360,
      content:
        "## CS_ASYNC_JOB_WORKER\n\nWorker asynchrone appelé par `cs_async_start_job`.\n\nArchitecture durcie :\n\n1. préparation du job\n2. progression Supabase par étape\n3. exécution déterministe des sous-agents\n4. synthèse finale par le Directeur worker\n5. sauvegarde artifact Supabase\n6. création du Markdown final dans Google Drive\n7. index document Supabase\n8. statut final `completed` ou `failed`\n\nLe worker ne répond jamais directement au chat.",
    },
  };

  const trigger = triggerNode("When called by async launcher", [-520, 0]);
  const prepare = codeNode(
    "Prepare Worker Input",
    `const input = $input.first().json || {};
const project_slug = input.project_slug || 'le_robot';
const job_id = input.job_id || 'job_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10);
const request_message = input.request_message || input.chatInput || '';
const job_type = input.job_type || 'async_agentic_job';
const context = input.context_summary || '';
const expected_output = input.expected_output || 'Livrable final Markdown lisible.';
const normalized = [request_message, job_type, expected_output].join(' ').toLowerCase();
const hasFacebook = /\\b(facebook|fb|meta)\\b/i.test(normalized);
const hasLinkedIn = /\\b(linkedin|linked ?in)\\b/i.test(normalized);
const noSpecificPlatform = !hasFacebook && !hasLinkedIn;
const wantsCalendar = /calendrier|editorial|éditorial|annuel|annuelle|sur 1 an|12 mois|52 semaines|arcs? de contenu|planning/i.test(normalized);
const wantsBatch = /\\b(batch|posts?|publications?|contenus?|semaine|30\\s+|70\\s+|scripts?|captions?)\\b/i.test(normalized);
const wantsVisual = /\\b(visuels?|images?|creatives?|créatives?|video|vidéo|briefs? visuels?)\\b/i.test(normalized);
const wantsPlatformWork = wantsCalendar || wantsBatch || hasFacebook || hasLinkedIn;
const job_route = wantsCalendar && !wantsBatch
  ? 'annual_calendar'
  : wantsBatch
    ? 'content_batch'
    : wantsVisual
      ? 'creative_batch'
      : 'strategy_brief';
const should_run_strategist = true;
const should_run_audience = true;
const should_run_growth = true;
const should_run_hook_master = job_route !== 'annual_calendar';
const should_run_facebook_native = wantsPlatformWork && (hasFacebook || noSpecificPlatform);
const should_run_linkedin_native = wantsPlatformWork && (hasLinkedIn || noSpecificPlatform);
const should_run_calendar_architect = job_route === 'annual_calendar';
const should_run_copywriter = job_route === 'content_batch';
const should_run_creative_director = wantsVisual || job_route === 'content_batch' || job_route === 'creative_batch';
const agents_used = [
  should_run_strategist ? 'strategist' : null,
  should_run_audience ? 'audience_psychologist' : null,
  should_run_growth ? 'growth_hacker' : null,
  should_run_hook_master ? 'hook_master' : null,
  should_run_facebook_native ? 'facebook_native_agent' : null,
  should_run_linkedin_native ? 'linkedin_native_agent' : null,
  should_run_calendar_architect ? 'calendar_architect' : null,
  should_run_copywriter ? 'copywriter' : null,
  should_run_creative_director ? 'creative_director' : null,
].filter(Boolean);
const stable_context = [
  'Koudous DAOUDA, surnom : Le Robot.',
  'Expertise : automatisation n8n, Python, IA operationnelle et applications web.',
  'Objectif : dominer Facebook et LinkedIn avec une marque personnelle premium, directe et concrete.',
  'Promesse : automatiser l ennuyeux, reduire le chaos operationnel, aider les dirigeants a piloter au lieu de subir.',
  'Cible : PME, solopreneurs, entrepreneurs et equipes qui perdent trop de temps dans relances, tableaux, emails, suivis et operations repetitives.'
].join('\\n');
return [{ json: {
  ...input,
  project_slug,
  job_id,
  request_message,
  job_type,
  job_route,
  context_summary: [stable_context, context].filter(Boolean).join('\\n\\n'),
  expected_output,
  should_run_strategist,
  should_run_audience,
  should_run_growth,
  should_run_hook_master,
  should_run_facebook_native,
  should_run_linkedin_native,
  should_run_calendar_architect,
  should_run_copywriter,
  should_run_creative_director,
  agents_used
} }];`,
    [-220, 0],
  );

  const markRunning = supabaseNode(
    "Mark Job Running",
    "update",
    "crew_jobs",
    [
      { fieldId: "status", fieldValue: "running" },
      { fieldId: "percent_estimate", fieldValue: "10" },
      { fieldId: "current_phase", fieldValue: "preparing_agents" },
    ],
    [80, 0],
    { parameters: { filterType: "string", filterString: "={{ 'job_id=eq.' + $('Prepare Worker Input').first().json.job_id }}" } },
  );
  const addRunningProgress = progressNode(
    "Add Running Progress",
    10,
    "preparing_agents",
    "Le worker a démarré. Il prépare les sous-agents et le contexte de travail.",
    ["director_async_worker"],
    [380, 0],
  );
  const strategistProgress = progressNode(
    "Progress Strategist Started",
    20,
    "strategist",
    "Agent Strategist en cours : positionnement, angle central, perception a changer.",
    ["strategist"],
    [680, 0],
  );
  const runStrategist = agentWorkflowNode(
    "Run Strategist Agent",
    AGENT_WORKFLOWS.strategist,
    [980, 0],
    "Diagnostic strategique, big idea, perception a changer, levier principal et instructions pour les autres agents.",
    "",
  );
  const checkpointStrategist = agentCheckpointNode(
    "Checkpoint Strategist Agent Run",
    "strategist",
    "Run Strategist Agent",
    [1120, 220],
  );
  const saveStrategistRun = saveAgentRunNode("Save Strategist Agent Run", [1280, 220]);
  const audienceProgress = progressNode(
    "Progress Audience Started",
    38,
    "audience_psychologist",
    "Agent Audience Psychologist en cours : douleurs, objections, tensions, langage et déclencheurs.",
    ["audience_psychologist"],
    [1280, 0],
  );
  const runAudience = agentWorkflowNode(
    "Run Audience Psychologist Agent",
    AGENT_WORKFLOWS.audience,
    [1580, 0],
    "Carte psychologique exploitable : douleurs, desirs de statut, objections, phrases declencheuses et limites utiles.",
    "={{ JSON.stringify({ strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json }) }}",
  );
  const checkpointAudience = agentCheckpointNode(
    "Checkpoint Audience Agent Run",
    "audience_psychologist",
    "Run Audience Psychologist Agent",
    [1720, 220],
  );
  const saveAudienceRun = saveAgentRunNode("Save Audience Agent Run", [1880, 220]);
  const growthProgress = progressNode(
    "Progress Growth Started",
    55,
    "growth_hacker",
    "Agent Growth Hacker en cours : boucles d amplification, conversion, DM, commentaires et experiences.",
    ["growth_hacker"],
    [1880, 0],
  );
  const runGrowth = agentWorkflowNode(
    "Run Growth Hacker Agent",
    AGENT_WORKFLOWS.growth,
    [2180, 0],
    "Plan growth defendable : boucles, experiments, mecanismes de commentaires/DM, lead magnets et signaux de mesure.",
    "={{ JSON.stringify({ strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json, audience: $('Run Audience Psychologist Agent').first().json.output || $('Run Audience Psychologist Agent').first().json }) }}",
  );
  const checkpointGrowth = agentCheckpointNode(
    "Checkpoint Growth Agent Run",
    "growth_hacker",
    "Run Growth Hacker Agent",
    [2320, 220],
  );
  const saveGrowthRun = saveAgentRunNode("Save Growth Agent Run", [2480, 220]);
  const hooksProgress = progressNode(
    "Progress Hook Started",
    62,
    "hook_master",
    "Agent Hook Master en cours : angles scroll-stopper, accroches, tensions et tests.",
    ["hook_master"],
    [2480, 0],
  );
  const runHooks = agentWorkflowNode(
    "Run Hook Master Agent",
    AGENT_WORKFLOWS.hooks,
    [2780, 0],
    "Banque d accroches, angles scroll-stopper et recommandations de selection pour Facebook et LinkedIn.",
    "={{ JSON.stringify({ strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json, audience: $('Run Audience Psychologist Agent').first().json.output || $('Run Audience Psychologist Agent').first().json, growth: $('Run Growth Hacker Agent').first().json.output || $('Run Growth Hacker Agent').first().json }) }}",
  );
  const checkpointHooks = agentCheckpointNode(
    "Checkpoint Hook Agent Run",
    "hook_master",
    "Run Hook Master Agent",
    [2920, 220],
  );
  const saveHooksRun = saveAgentRunNode("Save Hook Agent Run", [3080, 220]);
  const routeHook = ifNode(
    "Route Hook Master?",
    "={{ $('Prepare Worker Input').first().json.should_run_hook_master }}",
    [2480, -260],
  );
  const routeFacebook = ifNode(
    "Route Facebook Native?",
    "={{ $('Prepare Worker Input').first().json.should_run_facebook_native }}",
    [3260, -260],
  );
  const facebookProgress = progressNode(
    "Progress Facebook Native Started",
    68,
    "facebook_native_agent",
    "Agent Facebook Native en cours : emotion, conversation, formats et dynamique communautaire.",
    ["facebook_native_agent"],
    [3540, -260],
  );
  const runFacebook = agentWorkflowNode(
    "Run Facebook Native Agent",
    AGENT_WORKFLOWS.facebook,
    [3820, -260],
    "Strategie native Facebook : role plateforme, declencheurs emotionnels, directions de contenu, formats et besoins visuels.",
    "={{ JSON.stringify({ strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json, audience: $('Run Audience Psychologist Agent').first().json.output || $('Run Audience Psychologist Agent').first().json, growth: $('Run Growth Hacker Agent').first().json.output || $('Run Growth Hacker Agent').first().json, hook_master: $('Prepare Worker Input').first().json.should_run_hook_master ? ($('Run Hook Master Agent').first().json.output || $('Run Hook Master Agent').first().json) : null }) }}",
  );
  const checkpointFacebook = agentCheckpointNode(
    "Checkpoint Facebook Native Agent Run",
    "facebook_native_agent",
    "Run Facebook Native Agent",
    [3960, -40],
  );
  const saveFacebookRun = saveAgentRunNode("Save Facebook Native Agent Run", [4120, -40]);
  const routeLinkedIn = ifNode(
    "Route LinkedIn Native?",
    "={{ $('Prepare Worker Input').first().json.should_run_linkedin_native }}",
    [4300, -260],
  );
  const linkedinProgress = progressNode(
    "Progress LinkedIn Native Started",
    74,
    "linkedin_native_agent",
    "Agent LinkedIn Native en cours : autorite, preuve, point de vue et conversation qualifiee.",
    ["linkedin_native_agent"],
    [4580, -260],
  );
  const runLinkedIn = agentWorkflowNode(
    "Run LinkedIn Native Agent",
    AGENT_WORKFLOWS.linkedin,
    [4860, -260],
    "Strategie native LinkedIn : autorite, preuve, point de vue professionnel, directions de contenu et conversion douce.",
    "={{ JSON.stringify({ strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json, audience: $('Run Audience Psychologist Agent').first().json.output || $('Run Audience Psychologist Agent').first().json, growth: $('Run Growth Hacker Agent').first().json.output || $('Run Growth Hacker Agent').first().json, hook_master: $('Prepare Worker Input').first().json.should_run_hook_master ? ($('Run Hook Master Agent').first().json.output || $('Run Hook Master Agent').first().json) : null }) }}",
  );
  const checkpointLinkedIn = agentCheckpointNode(
    "Checkpoint LinkedIn Native Agent Run",
    "linkedin_native_agent",
    "Run LinkedIn Native Agent",
    [5000, -40],
  );
  const saveLinkedInRun = saveAgentRunNode("Save LinkedIn Native Agent Run", [5160, -40]);
  const routeCalendar = ifNode(
    "Route Calendar Architect?",
    "={{ $('Prepare Worker Input').first().json.should_run_calendar_architect }}",
    [5340, -260],
  );
  const calendarProgress = progressNode(
    "Progress Calendar Architect Started",
    80,
    "calendar_architect",
    "Agent Calendar Architect en cours : arcs, mois, semaines, objectifs psychologiques et production.",
    ["calendar_architect"],
    [5620, -260],
  );
  const runCalendar = agentWorkflowNode(
    "Run Calendar Architect Agent",
    AGENT_WORKFLOWS.calendar,
    [5900, -260],
    "Calendrier editorial structure : arcs, mois, semaines, objectifs psychologiques, mecanismes growth, plateformes et production.",
    "={{ JSON.stringify({ strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json, audience: $('Run Audience Psychologist Agent').first().json.output || $('Run Audience Psychologist Agent').first().json, growth: $('Run Growth Hacker Agent').first().json.output || $('Run Growth Hacker Agent').first().json, facebook_native: $('Prepare Worker Input').first().json.should_run_facebook_native ? ($('Run Facebook Native Agent').first().json.output || $('Run Facebook Native Agent').first().json) : null, linkedin_native: $('Prepare Worker Input').first().json.should_run_linkedin_native ? ($('Run LinkedIn Native Agent').first().json.output || $('Run LinkedIn Native Agent').first().json) : null }) }}",
  );
  const checkpointCalendar = agentCheckpointNode(
    "Checkpoint Calendar Architect Agent Run",
    "calendar_architect",
    "Run Calendar Architect Agent",
    [6040, -40],
  );
  const saveCalendarRun = saveAgentRunNode("Save Calendar Architect Agent Run", [6200, -40]);
  const routeCopywriter = ifNode(
    "Route Copywriter?",
    "={{ $('Prepare Worker Input').first().json.should_run_copywriter }}",
    [6380, -260],
  );
  const copywriterProgress = progressNode(
    "Progress Copywriter Started",
    86,
    "copywriter",
    "Agent Copywriter en cours : contenus finaux, hooks tenus, CTA et adaptation plateforme.",
    ["copywriter"],
    [6660, -260],
  );
  const runCopywriter = agentWorkflowNode(
    "Run Copywriter Agent",
    AGENT_WORKFLOWS.copywriter,
    [6940, -260],
    "Contenus finaux exploitables : posts, scripts ou captions avec hook, corps, CTA, notes de risque et adaptation plateforme.",
    "={{ JSON.stringify({ strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json, audience: $('Run Audience Psychologist Agent').first().json.output || $('Run Audience Psychologist Agent').first().json, growth: $('Run Growth Hacker Agent').first().json.output || $('Run Growth Hacker Agent').first().json, hook_master: $('Run Hook Master Agent').first().json.output || $('Run Hook Master Agent').first().json, facebook_native: $('Prepare Worker Input').first().json.should_run_facebook_native ? ($('Run Facebook Native Agent').first().json.output || $('Run Facebook Native Agent').first().json) : null, linkedin_native: $('Prepare Worker Input').first().json.should_run_linkedin_native ? ($('Run LinkedIn Native Agent').first().json.output || $('Run LinkedIn Native Agent').first().json) : null }) }}",
  );
  const checkpointCopywriter = agentCheckpointNode(
    "Checkpoint Copywriter Agent Run",
    "copywriter",
    "Run Copywriter Agent",
    [7080, -40],
  );
  const saveCopywriterRun = saveAgentRunNode("Save Copywriter Agent Run", [7240, -40]);
  const routeCreative = ifNode(
    "Route Creative Director?",
    "={{ $('Prepare Worker Input').first().json.should_run_creative_director }}",
    [7420, -260],
  );
  const creativeProgress = progressNode(
    "Progress Creative Director Started",
    90,
    "creative_director",
    "Agent Creative Director en cours : role du visuel, brief creatif, assets et limites de preuve.",
    ["creative_director"],
    [7700, -260],
  );
  const runCreative = agentWorkflowNode(
    "Run Creative Director Agent",
    AGENT_WORKFLOWS.creative,
    [7980, -260],
    "Direction creative exploitable : role du visuel, composition, briefs, assets manquants, limites de preuve et formats.",
    "={{ JSON.stringify({ strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json, audience: $('Run Audience Psychologist Agent').first().json.output || $('Run Audience Psychologist Agent').first().json, growth: $('Run Growth Hacker Agent').first().json.output || $('Run Growth Hacker Agent').first().json, hook_master: $('Prepare Worker Input').first().json.should_run_hook_master ? ($('Run Hook Master Agent').first().json.output || $('Run Hook Master Agent').first().json) : null, copywriter: $('Prepare Worker Input').first().json.should_run_copywriter ? ($('Run Copywriter Agent').first().json.output || $('Run Copywriter Agent').first().json) : null }) }}",
  );
  const checkpointCreative = agentCheckpointNode(
    "Checkpoint Creative Director Agent Run",
    "creative_director",
    "Run Creative Director Agent",
    [8120, -40],
  );
  const saveCreativeRun = saveAgentRunNode("Save Creative Director Agent Run", [8280, -40]);
  const synthesisProgress = progressNode(
    "Progress Synthesis Started",
    94,
    "synthesis",
    "Les sous-agents ont rendu leur analyse. Le Directeur worker consolide le document final.",
    ["director_async_worker"],
    [8460, 0],
  );
  const buildSynthesisPrompt = codeNode(
    "Build Worker Synthesis Prompt",
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return { ok: false, error: error.message }; }
}
function pickAgentPayload(value) {
  if (value && value.output && typeof value.output === 'object') return value.output;
  return value || {};
}
function compact(value, limit = 7000) {
  const text = JSON.stringify(value, null, 2);
  return text.length > limit ? text.slice(0, limit) + '\\n...TRONQUE...' : text;
}
const base = $('Prepare Worker Input').first().json || {};
const agent_outputs = {
  strategist: pickAgentPayload(readNode('Run Strategist Agent')),
  audience_psychologist: pickAgentPayload(readNode('Run Audience Psychologist Agent')),
  growth_hacker: pickAgentPayload(readNode('Run Growth Hacker Agent')),
  hook_master: base.should_run_hook_master ? pickAgentPayload(readNode('Run Hook Master Agent')) : null,
  facebook_native_agent: base.should_run_facebook_native ? pickAgentPayload(readNode('Run Facebook Native Agent')) : null,
  linkedin_native_agent: base.should_run_linkedin_native ? pickAgentPayload(readNode('Run LinkedIn Native Agent')) : null,
  calendar_architect: base.should_run_calendar_architect ? pickAgentPayload(readNode('Run Calendar Architect Agent')) : null,
  copywriter: base.should_run_copywriter ? pickAgentPayload(readNode('Run Copywriter Agent')) : null,
  creative_director: base.should_run_creative_director ? pickAgentPayload(readNode('Run Creative Director Agent')) : null
};
const active_agent_outputs = Object.fromEntries(Object.entries(agent_outputs).filter(([, value]) => value));
const agent_warnings = Object.entries(active_agent_outputs)
  .filter(([, value]) => value?.error || value?.ok === false || value?.status === 'error' || value?.status === 'failed')
  .map(([agent, value]) => ({ agent, error: value.error || value.message || value.status }));
const finalPrompt = [
  'Mission finale du Worker Crew_System.',
  '',
  'job_id: ' + base.job_id,
  'project_slug: ' + base.project_slug,
  'route: ' + base.job_route,
  'agents utilises: ' + (base.agents_used || []).join(', '),
  'Demande utilisateur: ' + base.request_message,
  'Livrable attendu: ' + base.expected_output,
  '',
  'Contexte stable:',
  base.context_summary,
  '',
  'Sorties structurees des sous-agents:',
  compact(active_agent_outputs),
  '',
  'Consigne de synthese:',
  '- Produis un document Markdown lisible, utile et directement exploitable.',
  '- Commence directement par un titre H1.',
  '- Integre uniquement les agents appeles pour cette route : strategie, psychologie audience, growth, plateformes, calendrier, copywriting et/ou direction creative selon le besoin.',
  '- Si la demande vise des publications, donne des contenus prets a utiliser avec variations visibles, angles distincts et indications visuelles utiles.',
  '- Si la demande vise un calendrier, structure par periodes, objectifs, angles, plateformes, preuves, boucles growth et livrables.',
  '- Ne montre jamais de JSON brut, notes internes, prompts, traces techniques ou raisonnement cache.',
  '- Si un sous-agent a manque quelque chose, compense proprement et liste les questions restantes a la fin.',
  '- Ne dis pas que le fichier est sauvegardé : les nodes déterministes le feront après ta sortie.'
].join('\\n');
return [{ json: { ...base, worker_prompt: finalPrompt, agent_outputs: active_agent_outputs, agent_warnings } }];`,
    [8740, 0],
  );

  const agent = {
    id: nodeId(),
    name: "Async Worker Directeur",
    type: "@n8n/n8n-nodes-langchain.agent",
    typeVersion: 2.2,
    position: [9040, 0],
    retryOnFail: true,
    continueOnFail: true,
    maxTries: 2,
    waitBetweenTries: 4000,
    parameters: {
      promptType: "define",
      text: "={{ $('Build Worker Synthesis Prompt').first().json.worker_prompt }}",
      options: {
        systemMessage:
          "Tu es le Directeur worker de Crew_System. Les sous-agents ont déjà été exécutés par des nodes déterministes. Tu ne dois pas inventer leurs sorties ni appeler des sous-agents. Ton rôle est de consolider leurs résultats en un document final Markdown lisible, stratégique et exploitable. Tu peux utiliser Supabase ou Google Drive seulement si tu dois vérifier un contexte, mais tu ne dois pas créer le fichier final : un node déterministe le fera. Sortie stricte : Markdown public uniquement, commence par un titre H1, aucun JSON brut, aucune note interne, aucune trace technique.",
      },
    },
  };
  const sanitizer = codeNode(
    "Worker Markdown Sanitizer",
    `let output = String($json.output || $json.text || $json.response || '').trim();
const h1 = output.search(/(^|\\n)#\\s+/);
if (h1 > 0) output = output.slice(h1).trim();
output = output
  .replace(/^\\*{3,}\\s*/g, '')
  .replace(/^(?:All agents have completed[\\s\\S]*?)(?=#\\s+)/i, '')
  .replace(/^(?:J'ai termin[eé][\\s\\S]*?)(?=#\\s+)/i, '')
  .trim();
return [{ json: { output } }];`,
    [9340, 0],
  );
  const buildPayload = codeNode(
    "Build Artifact And Completion Payload",
    `const output = String($json.output || $json.public_candidate || $json.text || '').trim();
let base = {};
try { base = $('Build Worker Synthesis Prompt').first().json || {}; } catch (error) { base = {}; }
const job_id = base.job_id || 'job_unknown';
const project_slug = base.project_slug || 'le_robot';
const safeJob = String(job_id).replace(/[^a-zA-Z0-9_-]/g, '_');
const hasUsableOutput = /^#\\s+/m.test(output) && output.length > 80;
const status = hasUsableOutput ? 'completed' : 'failed';
const content = hasUsableOutput ? output : [
  '# Job échoué',
  '',
  'Le worker a terminé son parcours, mais la synthèse finale n a pas produit de Markdown exploitable.',
  '',
  '## Demande initiale',
  base.request_message || '',
  '',
  '## Diagnostic technique',
  'Les sorties des sous-agents peuvent etre presentes dans les traces internes, mais le livrable final public etait vide ou invalide.',
  '',
  '## Action recommandee',
  'Relancer le chantier ou reduire le perimetre si le modele IA a renvoye une erreur ponctuelle.'
].join('\\n');
const path = 'async_jobs/' + safeJob + '/final.md';
return [{ json: {
  job_id,
  project_slug,
  artifact_id: 'artifact_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  document_id: 'document_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  completion_event_id: 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  path,
  drive_file_name: safeJob + '_crew_system_final.md',
  document_title: 'Crew_System - Livrable final - ' + safeJob,
  content_type: 'text/markdown',
  content,
  status,
  assistant_message: content,
  percent_estimate: 100,
  current_phase: status === 'completed' ? 'completed' : 'failed',
  completion_message: status === 'completed' ? 'Job terminé. Le livrable final est disponible.' : 'Job terminé en erreur. Un diagnostic a été sauvegardé.',
  agents_used: Array.isArray(base.agents_used) && base.agents_used.length
    ? base.agents_used
    : ['strategist','audience_psychologist','growth_hacker'],
  agent_warnings: base.agent_warnings || []
} }];`,
    [9640, 0],
  );

  const saveArtifact = supabaseNode(
    "Save Final Artifact",
    "create",
    "crew_artifacts",
    [
      { fieldId: "artifact_id", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.artifact_id }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.project_slug }}" },
      { fieldId: "path", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.path }}" },
      { fieldId: "status", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.status }}" },
      { fieldId: "content_type", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.content_type }}" },
      { fieldId: "content", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.content }}" },
    ],
    [9940, 0],
  );
  const createDriveFile = googleDriveCreateTextNode("Create Final Markdown In Drive", [10240, 0]);
  const buildDocumentIndex = codeNode(
    "Build Document Index Payload",
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return {}; }
}
const payload = $('Build Artifact And Completion Payload').first().json || {};
const drive = readNode('Create Final Markdown In Drive');
const drive_file_id = drive.id || drive.fileId || drive.file_id || '';
const drive_url = drive.webViewLink || drive.webContentLink || drive.url || (drive_file_id ? 'https://drive.google.com/file/d/' + drive_file_id + '/view' : '');
return [{ json: {
  document_id: payload.document_id,
  project_slug: payload.project_slug,
  job_id: payload.job_id,
  artifact_id: payload.artifact_id,
  storage_provider: 'google_drive',
  path: payload.path,
  title: payload.document_title,
  document_type: 'markdown',
  status: drive_file_id ? 'ready' : 'saved_without_drive',
  content_type: payload.content_type || 'text/markdown',
  drive_file_id,
  drive_url
} }];`,
    [10540, 0],
  );
  const indexDocument = supabaseNode(
    "Index Final Drive Document",
    "create",
    "crew_documents",
    [
      { fieldId: "document_id", fieldValue: "={{ $('Build Document Index Payload').first().json.document_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Document Index Payload').first().json.project_slug }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Document Index Payload').first().json.job_id }}" },
      { fieldId: "artifact_id", fieldValue: "={{ $('Build Document Index Payload').first().json.artifact_id }}" },
      { fieldId: "storage_provider", fieldValue: "={{ $('Build Document Index Payload').first().json.storage_provider }}" },
      { fieldId: "path", fieldValue: "={{ $('Build Document Index Payload').first().json.path }}" },
      { fieldId: "title", fieldValue: "={{ $('Build Document Index Payload').first().json.title }}" },
      { fieldId: "document_type", fieldValue: "={{ $('Build Document Index Payload').first().json.document_type }}" },
      { fieldId: "status", fieldValue: "={{ $('Build Document Index Payload').first().json.status }}" },
      { fieldId: "content_type", fieldValue: "={{ $('Build Document Index Payload').first().json.content_type }}" },
      { fieldId: "drive_file_id", fieldValue: "={{ $('Build Document Index Payload').first().json.drive_file_id }}" },
      { fieldId: "drive_url", fieldValue: "={{ $('Build Document Index Payload').first().json.drive_url }}" },
    ],
    [10840, 0],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const completionProgress = supabaseNode(
    "Add Completion Progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.completion_event_id }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.status }}" },
      { fieldId: "message", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.completion_message }}" },
      { fieldId: "percent_estimate", fieldValue: "100" },
      { fieldId: "current_phase", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.current_phase }}" },
      { fieldId: "artifacts_created", fieldValue: "={{ [$('Build Artifact And Completion Payload').first().json.path] }}" },
    ],
    [11140, 0],
  );
  const markFinalStatus = supabaseNode(
    "Mark Job Final Status",
    "update",
    "crew_jobs",
    [
      { fieldId: "status", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.status }}" },
      { fieldId: "assistant_message", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.content }}" },
      { fieldId: "artifacts_created", fieldValue: "={{ [$('Build Artifact And Completion Payload').first().json.path] }}" },
      { fieldId: "percent_estimate", fieldValue: "100" },
      { fieldId: "current_phase", fieldValue: "={{ $('Build Artifact And Completion Payload').first().json.current_phase }}" },
      { fieldId: "completed_at", fieldValue: "={{ new Date().toISOString() }}" },
    ],
    [11440, 0],
    { parameters: { filterType: "string", filterString: "={{ 'job_id=eq.' + $('Build Artifact And Completion Payload').first().json.job_id }}" } },
  );

  model.position = [9040, -260];

  const nodes = [
    note,
    trigger,
    prepare,
    markRunning,
    addRunningProgress,
    strategistProgress,
    runStrategist,
    checkpointStrategist,
    saveStrategistRun,
    audienceProgress,
    runAudience,
    checkpointAudience,
    saveAudienceRun,
    growthProgress,
    runGrowth,
    checkpointGrowth,
    saveGrowthRun,
    routeHook,
    hooksProgress,
    runHooks,
    checkpointHooks,
    saveHooksRun,
    routeFacebook,
    facebookProgress,
    runFacebook,
    checkpointFacebook,
    saveFacebookRun,
    routeLinkedIn,
    linkedinProgress,
    runLinkedIn,
    checkpointLinkedIn,
    saveLinkedInRun,
    routeCalendar,
    calendarProgress,
    runCalendar,
    checkpointCalendar,
    saveCalendarRun,
    routeCopywriter,
    copywriterProgress,
    runCopywriter,
    checkpointCopywriter,
    saveCopywriterRun,
    routeCreative,
    creativeProgress,
    runCreative,
    checkpointCreative,
    saveCreativeRun,
    synthesisProgress,
    buildSynthesisPrompt,
    agent,
    model,
    sanitizer,
    buildPayload,
    saveArtifact,
    createDriveFile,
    buildDocumentIndex,
    indexDocument,
    completionProgress,
    markFinalStatus,
    ...toolNodes,
  ];
  const connections = {
    [trigger.name]: { main: [[{ node: prepare.name, type: "main", index: 0 }]] },
    [prepare.name]: { main: [[{ node: markRunning.name, type: "main", index: 0 }]] },
    [markRunning.name]: { main: [[{ node: addRunningProgress.name, type: "main", index: 0 }]] },
    [addRunningProgress.name]: { main: [[{ node: strategistProgress.name, type: "main", index: 0 }]] },
    [strategistProgress.name]: { main: [[{ node: runStrategist.name, type: "main", index: 0 }]] },
    [runStrategist.name]: { main: [[{ node: checkpointStrategist.name, type: "main", index: 0 }]] },
    [checkpointStrategist.name]: { main: [[{ node: saveStrategistRun.name, type: "main", index: 0 }]] },
    [saveStrategistRun.name]: { main: [[{ node: audienceProgress.name, type: "main", index: 0 }]] },
    [audienceProgress.name]: { main: [[{ node: runAudience.name, type: "main", index: 0 }]] },
    [runAudience.name]: { main: [[{ node: checkpointAudience.name, type: "main", index: 0 }]] },
    [checkpointAudience.name]: { main: [[{ node: saveAudienceRun.name, type: "main", index: 0 }]] },
    [saveAudienceRun.name]: { main: [[{ node: growthProgress.name, type: "main", index: 0 }]] },
    [growthProgress.name]: { main: [[{ node: runGrowth.name, type: "main", index: 0 }]] },
    [runGrowth.name]: { main: [[{ node: checkpointGrowth.name, type: "main", index: 0 }]] },
    [checkpointGrowth.name]: { main: [[{ node: saveGrowthRun.name, type: "main", index: 0 }]] },
    [saveGrowthRun.name]: { main: [[{ node: routeHook.name, type: "main", index: 0 }]] },
    [routeHook.name]: {
      main: [
        [{ node: hooksProgress.name, type: "main", index: 0 }],
        [{ node: routeFacebook.name, type: "main", index: 0 }],
      ],
    },
    [hooksProgress.name]: { main: [[{ node: runHooks.name, type: "main", index: 0 }]] },
    [runHooks.name]: { main: [[{ node: checkpointHooks.name, type: "main", index: 0 }]] },
    [checkpointHooks.name]: { main: [[{ node: saveHooksRun.name, type: "main", index: 0 }]] },
    [saveHooksRun.name]: { main: [[{ node: routeFacebook.name, type: "main", index: 0 }]] },
    [routeFacebook.name]: {
      main: [
        [{ node: facebookProgress.name, type: "main", index: 0 }],
        [{ node: routeLinkedIn.name, type: "main", index: 0 }],
      ],
    },
    [facebookProgress.name]: { main: [[{ node: runFacebook.name, type: "main", index: 0 }]] },
    [runFacebook.name]: { main: [[{ node: checkpointFacebook.name, type: "main", index: 0 }]] },
    [checkpointFacebook.name]: { main: [[{ node: saveFacebookRun.name, type: "main", index: 0 }]] },
    [saveFacebookRun.name]: { main: [[{ node: routeLinkedIn.name, type: "main", index: 0 }]] },
    [routeLinkedIn.name]: {
      main: [
        [{ node: linkedinProgress.name, type: "main", index: 0 }],
        [{ node: routeCalendar.name, type: "main", index: 0 }],
      ],
    },
    [linkedinProgress.name]: { main: [[{ node: runLinkedIn.name, type: "main", index: 0 }]] },
    [runLinkedIn.name]: { main: [[{ node: checkpointLinkedIn.name, type: "main", index: 0 }]] },
    [checkpointLinkedIn.name]: { main: [[{ node: saveLinkedInRun.name, type: "main", index: 0 }]] },
    [saveLinkedInRun.name]: { main: [[{ node: routeCalendar.name, type: "main", index: 0 }]] },
    [routeCalendar.name]: {
      main: [
        [{ node: calendarProgress.name, type: "main", index: 0 }],
        [{ node: routeCopywriter.name, type: "main", index: 0 }],
      ],
    },
    [calendarProgress.name]: { main: [[{ node: runCalendar.name, type: "main", index: 0 }]] },
    [runCalendar.name]: { main: [[{ node: checkpointCalendar.name, type: "main", index: 0 }]] },
    [checkpointCalendar.name]: { main: [[{ node: saveCalendarRun.name, type: "main", index: 0 }]] },
    [saveCalendarRun.name]: { main: [[{ node: routeCopywriter.name, type: "main", index: 0 }]] },
    [routeCopywriter.name]: {
      main: [
        [{ node: copywriterProgress.name, type: "main", index: 0 }],
        [{ node: routeCreative.name, type: "main", index: 0 }],
      ],
    },
    [copywriterProgress.name]: { main: [[{ node: runCopywriter.name, type: "main", index: 0 }]] },
    [runCopywriter.name]: { main: [[{ node: checkpointCopywriter.name, type: "main", index: 0 }]] },
    [checkpointCopywriter.name]: { main: [[{ node: saveCopywriterRun.name, type: "main", index: 0 }]] },
    [saveCopywriterRun.name]: { main: [[{ node: routeCreative.name, type: "main", index: 0 }]] },
    [routeCreative.name]: {
      main: [
        [{ node: creativeProgress.name, type: "main", index: 0 }],
        [{ node: synthesisProgress.name, type: "main", index: 0 }],
      ],
    },
    [creativeProgress.name]: { main: [[{ node: runCreative.name, type: "main", index: 0 }]] },
    [runCreative.name]: { main: [[{ node: checkpointCreative.name, type: "main", index: 0 }]] },
    [checkpointCreative.name]: { main: [[{ node: saveCreativeRun.name, type: "main", index: 0 }]] },
    [saveCreativeRun.name]: { main: [[{ node: synthesisProgress.name, type: "main", index: 0 }]] },
    [synthesisProgress.name]: { main: [[{ node: buildSynthesisPrompt.name, type: "main", index: 0 }]] },
    [buildSynthesisPrompt.name]: { main: [[{ node: agent.name, type: "main", index: 0 }]] },
    [model.name]: { ai_languageModel: [[{ node: agent.name, type: "ai_languageModel", index: 0 }]] },
    [agent.name]: { main: [[{ node: sanitizer.name, type: "main", index: 0 }]] },
    [sanitizer.name]: { main: [[{ node: buildPayload.name, type: "main", index: 0 }]] },
    [buildPayload.name]: { main: [[{ node: saveArtifact.name, type: "main", index: 0 }]] },
    [saveArtifact.name]: { main: [[{ node: createDriveFile.name, type: "main", index: 0 }]] },
    [createDriveFile.name]: { main: [[{ node: buildDocumentIndex.name, type: "main", index: 0 }]] },
    [buildDocumentIndex.name]: { main: [[{ node: indexDocument.name, type: "main", index: 0 }]] },
    [indexDocument.name]: { main: [[{ node: completionProgress.name, type: "main", index: 0 }]] },
    [completionProgress.name]: { main: [[{ node: markFinalStatus.name, type: "main", index: 0 }]] },
  };
  for (const tool of toolNodes) {
    connections[tool.name] = { ai_tool: [[{ node: agent.name, type: "ai_tool", index: 0 }]] };
  }
  return {
    ...existingWorker,
    name: WORKER_WORKFLOW_NAME,
    nodes,
    connections,
    settings: { ...(existingWorker.settings || {}), executionOrder: "v1" },
  };
}

function asyncToolNode(workerWorkflowId) {
  const workflow = buildAsyncToolWorkflow(workerWorkflowId);
  return {
    id: nodeId(),
    name: "cs_async_start_job",
    type: "@n8n/n8n-nodes-langchain.toolWorkflow",
    typeVersion: 1.3,
    position: [1720, 720],
    parameters: {
      name: "cs_async_start_job",
      description:
        "Lance un chantier long en arrière-plan. À utiliser pour stratégie complète, calendrier, batch de contenus, création de documents, révisions longues, demandes multi-agents ou tout travail susceptible de dépasser le temps de réponse du chat. Retourne vite un job_id.",
      source: "parameter",
      workflowJson: JSON.stringify(workflow, null, 2),
      specifyInputSchema: true,
      schemaType: "manual",
      inputSchema: JSON.stringify({
        type: "object",
        properties: {
          project_slug: { type: "string", description: "Slug projet. Par defaut koudous_daouda_le_robot." },
          project_name: { type: "string", description: "Nom lisible du projet si nouveau." },
          request_message: { type: "string", description: "Demande utilisateur complète à traiter en arrière-plan." },
          job_type: { type: "string", description: "Type de chantier : strategy, content_batch, calendar, revision, document_creation, etc." },
          context_summary: { type: "string", description: "Contexte utile deja compris ou lu." },
          expected_output: { type: "string", description: "Livrable final attendu." },
        },
        required: ["request_message"],
        additionalProperties: false,
      }),
    },
  };
}

function buildFastAsyncMainNodes(workerWorkflowId) {
  const router = codeNode(
    "Quick Async Router",
    `const input = $input.first().json || {};
const chatInput = String(input.chatInput || input.message || '').trim();
const normalized = chatInput.toLowerCase();
const launchLike = /\\b(lance|lancer|d[eé]marre|d[eé]marrer|pr[eé]pare|pr[eé]parer|cr[eé]e|cr[eé]er|g[eé]n[eè]re|g[eé]n[eé]rer|produis|produire|fais|faire)\\b/i.test(chatInput);
const statusLike = /\\b(o[uù] en est|statut|status|avancement|progression|termin[eé]|livrable pr[eê]t|job[_ -]?id)\\b/i.test(chatInput) && !launchLike;
const jobMatch = chatInput.match(/\\bjob_[a-z0-9]+_[a-z0-9]+\\b/i);
const heavyPatterns = [
  /arri[eè]re[- ]plan|asynchrone|background/i,
  /chantier complet|strat[eé]gie compl[eè]te|plan complet|syst[eè]me complet/i,
  /calendrier [eé]ditorial|annuel|sur 1 an|toute l.?ann[eé]e/i,
  /\\b(?:30|40|50|60|70|80|90|100)\\s+(?:publications|posts|contenus)\\b/i,
  /batch|production massive|contenus pour toute une semaine/i,
  /document markdown|livrable final|cr[eé]e.*document|google drive/i,
  /multi[- ]agents?|tous les agents|agents utiles/i,
  /psychologie.*growth.*hooks?|growth.*psychologie.*hooks?/i,
];
const should_status = Boolean(chatInput) && statusLike;
const should_async = Boolean(chatInput) && !should_status && heavyPatterns.some((pattern) => pattern.test(chatInput));
const job_id = 'job_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10);
const status_job_id = jobMatch ? jobMatch[0] : '';
const project_slug = normalized.includes('ecole_229') ? 'ecole_229' : 'le_robot';
const project_name = project_slug === 'ecole_229' ? 'ecole_229' : 'Koudous DAOUDA - Le Robot';
const description = project_slug === 'ecole_229'
  ? 'Projet ecole_229 pilote par Crew_System.'
  : "Marque personnelle de Koudous DAOUDA, Le Robot : automatisation n8n/Python, applications web, domination Facebook et LinkedIn.";
const job_type = /calendrier|annuel|semaine/i.test(chatInput) ? 'calendar_or_content_batch' : 'async_agentic_job';
const expected_output = /markdown|document|livrable/i.test(chatInput)
  ? 'Document Markdown final, lisible, structuré, sans JSON brut.'
  : 'Livrable final clair, exploitable et sauvegardé.';
const context_summary = project_slug === 'le_robot'
  ? "Koudous DAOUDA, Le Robot, expert automatisation n8n/Python et applications web. Cible : PME, solopreneurs et entrepreneurs. Plateformes : Facebook et LinkedIn."
  : '';
const queued_message = "C'est lancé. Les agents travaillent en arrière-plan et le livrable sera sauvegardé dès qu'il est prêt.";
const worker_prompt = [
  'Mission asynchrone Crew_System déclenchée par routeur rapide.',
  'job_id: ' + job_id,
  'project_slug: ' + project_slug,
  'job_type: ' + job_type,
  'Demande utilisateur: ' + chatInput,
  'Contexte utile: ' + context_summary,
  'Livrable attendu: ' + expected_output,
  '',
  'Lis le contexte disponible, appelle les agents utiles, produis un livrable final Markdown lisible et directement exploitable.',
  'Ne retourne jamais de JSON brut, de notes internes, de prompts ou de raisonnement caché.'
].join('\\n');
return [{ json: { ...input, should_status, should_async, status_job_id, job_id, project_slug, project_name, description, request_message: chatInput, job_type, context_summary, expected_output, queued_message, worker_prompt } }];`,
    [-1040, -120],
  );
  const route = {
    id: nodeId(),
    name: "Route Async Request?",
    type: "n8n-nodes-base.if",
    typeVersion: 1,
    position: [-440, -120],
    parameters: {
      conditions: {
        boolean: [
          {
            value1: "={{ $json.should_async }}",
            value2: true,
          },
        ],
      },
    },
  };
  const statusRoute = {
    id: nodeId(),
    name: "Route Status Request?",
    type: "n8n-nodes-base.if",
    typeVersion: 1,
    position: [-740, -120],
    parameters: {
      conditions: {
        boolean: [
          {
            value1: "={{ $json.should_status }}",
            value2: true,
          },
        ],
      },
    },
  };
  const loadStatusJobs = supabaseGetAllNode(
    "Status Load crew_jobs",
    "crew_jobs",
    25,
    "={{ $('Quick Async Router').first().json.status_job_id ? 'job_id=eq.' + $('Quick Async Router').first().json.status_job_id : 'project_slug=eq.' + $('Quick Async Router').first().json.project_slug }}",
    [-440, -620],
  );
  const selectStatusJob = codeNode(
    "Status Select Job",
    `const router = $('Quick Async Router').first().json || {};
const requestedJobId = String(router.status_job_id || '').trim();
const rows = $input.all()
  .map((item) => item.json || {})
  .filter((row) => row.job_id);
rows.sort((a, b) => {
  const ad = new Date(a.updated_at || a.created_at || 0).getTime();
  const bd = new Date(b.updated_at || b.created_at || 0).getTime();
  return bd - ad;
});
const selected = requestedJobId
  ? rows.find((row) => String(row.job_id).toLowerCase() === requestedJobId.toLowerCase()) || null
  : rows[0] || null;
return [{ json: {
  ...router,
  status_job: selected,
  status_job_id: selected?.job_id || requestedJobId || '',
  status_missing: !selected,
  candidate_jobs: rows.slice(0, 5).map((row) => ({
    job_id: row.job_id,
    status: row.status,
    percent_estimate: row.percent_estimate,
    current_phase: row.current_phase,
    updated_at: row.updated_at,
    created_at: row.created_at,
  })),
} }];`,
    [-140, -620],
  );
  const loadStatusProgress = supabaseGetAllNode(
    "Status Load progress_events",
    "crew_progress_events",
    50,
    "={{ 'job_id=eq.' + ($('Status Select Job').first().json.status_job_id || '__missing__') }}",
    [160, -620],
  );
  const loadStatusAgentRuns = supabaseGetAllNode(
    "Status Load agent_runs",
    "crew_agent_runs",
    50,
    "={{ 'job_id=eq.' + ($('Status Select Job').first().json.status_job_id || '__missing__') }}",
    [460, -620],
  );
  const loadStatusDocuments = supabaseGetAllNode(
    "Status Load crew_documents",
    "crew_documents",
    20,
    "={{ 'job_id=eq.' + ($('Status Select Job').first().json.status_job_id || '__missing__') }}",
    [760, -620],
  );
  const formatStatus = codeNode(
    "Format Status Chat Response",
    `function rowsFromNode(name) {
  try {
    return $(name).all().map((item) => item.json || {}).filter((row) => Object.keys(row).length > 0);
  } catch (error) {
    return [];
  }
}
function asDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
function formatDate(value) {
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleString('fr-FR', { timeZone: 'Africa/Porto-Novo', dateStyle: 'short', timeStyle: 'short' });
}
function humanize(value) {
  return String(value || '')
    .replace(/\\bdemarre\\b/gi, 'démarré')
    .replace(/\\bprepare\\b/gi, 'prépare')
    .replace(/\\bdeclencheurs\\b/gi, 'déclencheurs')
    .replace(/\\btermine\\b/gi, 'terminé')
    .replace(/\\betape\\b/gi, 'étape')
    .replace(/\\bexperiences\\b/gi, 'expériences')
    .replace(/\\bd amplification\\b/gi, "d'amplification")
    .replace(/\\barriere-plan\\b/gi, 'arrière-plan');
}
const selected = $('Status Select Job').first().json || {};
const job = selected.status_job || null;
if (!job) {
  const hint = selected.status_job_id
    ? "Je n'ai pas trouvé ce chantier : " + selected.status_job_id + "."
    : "Je n'ai pas encore trouvé de chantier pour ce projet.";
  return [{ json: {
    output: hint + "\\n\\nLance d'abord un chantier, puis redemande-moi l'avancement avec son identifiant.",
    is_safe_public_response: true,
    status: 'not_found',
  } }];
}
const progressRows = rowsFromNode('Status Load progress_events').filter((row) => row.job_id === job.job_id);
progressRows.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
const agentRows = rowsFromNode('Status Load agent_runs').filter((row) => row.job_id === job.job_id);
agentRows.sort((a, b) => new Date(a.created_at || a.started_at || 0) - new Date(b.created_at || b.started_at || 0));
const documentRows = rowsFromNode('Status Load crew_documents')
  .filter((row) => row.document_id || row.drive_file_id || row.drive_url);
documentRows.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
const lastProgress = progressRows[progressRows.length - 1] || {};
const jobPercent = Number(job.percent_estimate ?? 0);
const progressPercent = Number(lastProgress.percent_estimate ?? 0);
const percent = Math.max(jobPercent, progressPercent);
const phase = ['queued', 'running'].includes(job.status)
  ? (lastProgress.current_phase || job.current_phase || 'queued')
  : (job.current_phase || lastProgress.current_phase || 'queued');
const statusLabels = {
  queued: 'en attente',
  running: 'en cours',
  completed: 'terminé',
  failed: 'échoué',
  cancelled: 'annulé',
};
const phaseLabels = {
  queued: 'en attente',
  preparing_agents: 'préparation des agents',
  strategist: 'stratégie',
  audience_psychologist: 'psychologie audience',
  growth_hacker: 'growth',
  hook_master: 'hooks',
  facebook_native_agent: 'Facebook natif',
  linkedin_native_agent: 'LinkedIn natif',
  calendar_architect: 'calendrier editorial',
  copywriter: 'redaction finale',
  creative_director: 'direction creative',
  resume_requested: 'reprise demandee',
  resume_planning: 'planification de reprise',
  resume_strategist: 'reprise strategie',
  resume_audience: 'reprise psychologie audience',
  resume_growth: 'reprise growth',
  resume_hooks: 'reprise hooks',
  resume_facebook_native: 'reprise Facebook natif',
  resume_linkedin_native: 'reprise LinkedIn natif',
  resume_calendar_architect: 'reprise calendrier editorial',
  resume_copywriter: 'reprise redaction',
  resume_creative_director: 'reprise direction creative',
  resume_synthesis: 'synthese de reprise',
  synthesis: 'synthèse finale',
  completed: 'terminé',
  failed: 'échoué',
  watchdog_failed: 'blocage détecté',
};
const statusLabel = statusLabels[job.status] || job.status || 'inconnu';
const phaseLabel = phaseLabels[phase] || humanize(phase);
const agentLabels = {
  strategist: 'Strategist',
  audience_psychologist: 'Audience Psychologist',
  growth_hacker: 'Growth Hacker',
  hook_master: 'Hook Master',
  facebook_native_agent: 'Facebook Native',
  linkedin_native_agent: 'LinkedIn Native',
  calendar_architect: 'Calendar Architect',
  copywriter: 'Copywriter',
  creative_director: 'Creative Director',
};
const agentStatusLabels = {
  completed: 'terminé',
  success: 'terminé',
  needs_context: 'à compléter',
  failed: 'échoué',
  blocked: 'bloqué',
  running: 'en cours',
  queued: 'en attente',
};
function inferRoute(job) {
  const text = [job.request_message, job.job_type, job.current_phase].join(' ').toLowerCase();
  const hasFacebook = /facebook|\\bfb\\b/.test(text);
  const hasLinkedIn = /linkedin|linked in/.test(text);
  const wantsBatch = /batch|publications?|posts?|contenus?|semaine|\\b30\\b|\\b70\\b/.test(text);
  const wantsCalendar = /calendrier|editorial|annuel|annee|year|12 mois/.test(text);
  const wantsCreative = /visuel|image|creative|creatif|direction creative/.test(text);
  if (wantsBatch || (hasFacebook && hasLinkedIn && /publication|post|contenu/.test(text))) return 'content_batch';
  if (wantsCalendar) return 'annual_calendar';
  if (wantsCreative) return 'creative_batch';
  return 'strategy_brief';
}
function routeAgents(route, job) {
  const text = String(job.request_message || '').toLowerCase();
  const hasFacebook = /facebook|\\bfb\\b/.test(text);
  const hasLinkedIn = /linkedin|linked in/.test(text);
  const bothPlatforms = !hasFacebook && !hasLinkedIn;
  const agents = ['strategist', 'audience_psychologist', 'growth_hacker'];
  if (['strategy_brief', 'content_batch', 'creative_batch'].includes(route)) agents.push('hook_master');
  if (route === 'annual_calendar' || route === 'content_batch') {
    if (hasFacebook || bothPlatforms) agents.push('facebook_native_agent');
    if (hasLinkedIn || bothPlatforms) agents.push('linkedin_native_agent');
  }
  if (route === 'annual_calendar') agents.push('calendar_architect');
  if (route === 'content_batch') agents.push('copywriter', 'creative_director');
  if (route === 'creative_batch') agents.push('creative_director');
  return agents;
}
function latestAgentRows(rows) {
  const latest = {};
  for (const row of rows) {
    const agentId = row.agent_id || '';
    if (!agentId) continue;
    const current = latest[agentId];
    const rowTime = new Date(row.completed_at || row.created_at || row.started_at || 0).getTime();
    const currentTime = current ? new Date(current.completed_at || current.created_at || current.started_at || 0).getTime() : -1;
    if (!current || rowTime >= currentTime) latest[agentId] = row;
  }
  return latest;
}
const readyDocument = documentRows.find((row) => row.drive_url) || documentRows[0] || null;
const recentEvents = progressRows.slice(-5).map((event) => {
  const eventPercent = Number(event.percent_estimate ?? 0);
  const prefix = eventPercent ? eventPercent + '%' : '-';
  return '- ' + prefix + ' · ' + humanize(event.message || event.current_phase || 'Progression enregistrée');
});
const inferredRoute = inferRoute(job);
const expectedAgents = routeAgents(inferredRoute, job);
const latestAgents = latestAgentRows(agentRows);
const displayAgentRows = expectedAgents
  .map((agentId) => latestAgents[agentId])
  .filter(Boolean);
const fallbackAgentRows = Object.values(latestAgents);
const agentLines = (displayAgentRows.length ? displayAgentRows : fallbackAgentRows).map((agent) => {
  const label = agentLabels[agent.agent_id] || agent.agent_id || 'Agent';
  const status = agentStatusLabels[agent.status] || agent.status || 'inconnu';
  const summary = humanize(agent.output_summary || '').replace(/\\s+/g, ' ').trim();
  const shortSummary = summary.length > 130 ? summary.slice(0, 129) + '…' : summary;
  return '- ' + label + ' : ' + status + (shortSummary ? ' · ' + shortSummary : '');
});
const lines = [
  'Voici l\\'avancement du chantier **' + job.job_id + '**.',
  '',
  'Statut : **' + statusLabel + '**',
  'Progression : **' + percent + '%**',
  'Phase actuelle : **' + phaseLabel + '**',
];
if (job.updated_at || job.created_at) {
  lines.push('Dernière mise à jour : ' + formatDate(job.updated_at || job.created_at));
}
if (recentEvents.length) {
  lines.push('', 'Activité récente :', ...recentEvents);
}
if (agentLines.length) {
  lines.push('', 'Agents :', ...agentLines);
}
if (job.status === 'completed' && readyDocument?.drive_url) {
  lines.push('', 'Document prêt : ' + readyDocument.drive_url);
} else if (job.status === 'completed') {
  lines.push('', 'Le livrable est terminé. Je vois le document indexé, mais le lien Drive n\\'est pas encore disponible dans l\\'index.');
} else if (job.status === 'failed') {
  const reason = humanize(job.error || lastProgress.message || '');
  if (reason) lines.push('', 'Raison : ' + reason);
  lines.push('Suite recommandée : relancer le chantier ou réduire le périmètre si la demande était très lourde.');
} else {
  lines.push('', 'Le travail continue en arrière-plan. Tu peux me redemander l\\'avancement dans quelques instants.');
}
return [{ json: {
  output: lines.join('\\n'),
  is_safe_public_response: true,
  job_id: job.job_id,
  project_slug: job.project_slug,
  status: job.status,
  percent_estimate: percent,
} }];`,
    [1060, -620],
  );
  const ensureProject = supabaseNode(
    "Fast Ensure crew_project",
    "create",
    "crew_projects",
    [
      { fieldId: "project_slug", fieldValue: "={{ $('Quick Async Router').first().json.project_slug }}" },
      { fieldId: "project_name", fieldValue: "={{ $('Quick Async Router').first().json.project_name }}" },
      { fieldId: "description", fieldValue: "={{ $('Quick Async Router').first().json.description }}" },
    ],
    [-440, -320],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const createJob = supabaseNode(
    "Fast Create async crew_job",
    "create",
    "crew_jobs",
    [
      { fieldId: "job_id", fieldValue: "={{ $('Quick Async Router').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Quick Async Router').first().json.project_slug }}" },
      { fieldId: "request_message", fieldValue: "={{ $('Quick Async Router').first().json.request_message }}" },
      { fieldId: "status", fieldValue: "queued" },
      { fieldId: "provider", fieldValue: "n8n_gemini" },
      { fieldId: "assistant_message", fieldValue: "={{ $('Quick Async Router').first().json.queued_message }}" },
      { fieldId: "percent_estimate", fieldValue: "1" },
      { fieldId: "current_phase", fieldValue: "queued" },
    ],
    [-140, -320],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const addProgress = supabaseNode(
    "Fast Add queued progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Quick Async Router').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Quick Async Router').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "queued" },
      { fieldId: "message", fieldValue: "Chantier créé. Le worker agentique va prendre le relais." },
      { fieldId: "percent_estimate", fieldValue: "1" },
      { fieldId: "current_phase", fieldValue: "queued" },
      { fieldId: "active_agents", fieldValue: "={{ ['director_async_worker'] }}" },
    ],
    [160, -320],
  );
  const launchWorker = {
    id: nodeId(),
    name: "Fast Launch Async Worker",
    type: "n8n-nodes-base.executeWorkflow",
    typeVersion: 1.2,
    position: [460, -320],
    parameters: {
      workflowId: {
        __rl: true,
        mode: "id",
        value: workerWorkflowId,
        cachedResultName: WORKER_WORKFLOW_NAME,
      },
      workflowInputs: {
        mappingMode: "defineBelow",
        value: {
          job_id: "={{ $('Quick Async Router').first().json.job_id }}",
          project_slug: "={{ $('Quick Async Router').first().json.project_slug }}",
          request_message: "={{ $('Quick Async Router').first().json.request_message }}",
          job_type: "={{ $('Quick Async Router').first().json.job_type }}",
          context_summary: "={{ $('Quick Async Router').first().json.context_summary }}",
          expected_output: "={{ $('Quick Async Router').first().json.expected_output }}",
          worker_prompt: "={{ $('Quick Async Router').first().json.worker_prompt }}",
        },
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      options: { waitForSubWorkflow: false },
    },
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1000,
  };
  const format = codeNode(
    "Format Fast Async Chat Response",
    `const job = $('Quick Async Router').first().json;
const output = [
  "C'est lancé.",
  "",
  "Identifiant du chantier : **" + job.job_id + "**.",
  "",
  "Les agents vont travailler en arrière-plan et produire le livrable demandé. Tu peux me demander l'avancement avec cet identifiant."
].join('\\n');
return [{ json: { output, job_id: job.job_id, project_slug: job.project_slug, status: 'queued', is_safe_public_response: true } }];`,
    [760, -320],
  );
  return {
    router,
    statusRoute,
    loadStatusJobs,
    selectStatusJob,
    loadStatusProgress,
    loadStatusAgentRuns,
    loadStatusDocuments,
    formatStatus,
    route,
    ensureProject,
    createJob,
    addProgress,
    launchWorker,
    format,
  };
}

function updateDirectorPrompt(systemMessage) {
  const asyncBlock = `\n\nMODE ASYNCHRONE OBLIGATOIRE\nCrew_System doit rester rapide dans le chat. Pour toute demande lourde, longue ou multi-agents, utilise d'abord l'outil cs_async_start_job puis réponds brièvement avec le job_id et la suite concrète.\n\nDemandes lourdes = stratégie complète, calendrier éditorial, batch de contenus, 30+ posts, 70 posts, documents, Google Drive, production annuelle, révision massive, analyse multi-agents, growth plan complet, ou tout travail qui exige plusieurs agents.\n\nRègles :\n- N'appelle pas tous les sous-agents directement dans le chat pour une demande lourde.\n- Ne crée pas manuellement le job avec cs_supabase_create_job si cs_async_start_job convient : l'outil asynchrone crée le job, ajoute la progression et lance le worker.\n- Pour une demande légère, tu peux répondre normalement ou appeler un agent précis.\n- Si l'utilisateur demande l'état d'un chantier, utilise cs_supabase_load_job_progress et cs_supabase_load_project_artifacts.\n- Après cs_async_start_job, ne montre aucun détail technique. Dis simplement que le chantier est lancé, donne le job_id, et explique ce que les agents vont produire.`;
  const cleaned = systemMessage.replace(/\n\nMODE ASYNCHRONE OBLIGATOIRE[\s\S]*?(?=\n\nOUTILS SUPABASE DISPONIBLES|\n\nOUTILS GOOGLE DRIVE DISPONIBLES|$)/, "");
  if (cleaned.includes("OUTILS SUPABASE DISPONIBLES")) {
    return cleaned.replace("\n\nOUTILS SUPABASE DISPONIBLES", `${asyncBlock}\n\nOUTILS SUPABASE DISPONIBLES`);
  }
  return `${cleaned}${asyncBlock}`;
}

function patchPublicResponseLeakGuard(workflow) {
  const guard = workflow.nodes.find((node) => node.name === "Public Response Leak Guard");
  if (!guard?.parameters?.jsCode) return workflow;
  if (guard.parameters.jsCode.includes("is_safe_public_response")) return workflow;
  guard.parameters.jsCode = guard.parameters.jsCode.replace(
    "const item = $input.first();",
    `const item = $input.first();
if (item.json.is_safe_public_response === true) {
  const safeOutput = String(item.json.output ?? item.json.public_candidate ?? item.json.text ?? '').trim();
  return [{ json: { output: safeOutput } }];
}`,
  );
  return workflow;
}

function addOrReplaceAsyncTool(mainWorkflow, workerWorkflowId) {
  patchPublicResponseLeakGuard(mainWorkflow);
  const fastNames = new Set([
    "Quick Async Router",
    "Route Status Request?",
    "Status Load crew_jobs",
    "Status Select Job",
    "Status Load progress_events",
    "Status Load agent_runs",
    "Status Load crew_documents",
    "Format Status Chat Response",
    "Route Async Request?",
    "Fast Ensure crew_project",
    "Fast Create async crew_job",
    "Fast Add queued progress",
    "Fast Launch Async Worker",
    "Format Fast Async Chat Response",
  ]);
  const nodes = mainWorkflow.nodes.filter((node) => node.name !== "cs_async_start_job" && !fastNames.has(node.name));
  nodes.push(asyncToolNode(workerWorkflowId));
  const fast = buildFastAsyncMainNodes(workerWorkflowId);
  nodes.push(
    fast.router,
    fast.statusRoute,
    fast.loadStatusJobs,
    fast.selectStatusJob,
    fast.loadStatusProgress,
    fast.loadStatusAgentRuns,
    fast.loadStatusDocuments,
    fast.formatStatus,
    fast.route,
    fast.ensureProject,
    fast.createJob,
    fast.addProgress,
    fast.launchWorker,
    fast.format,
  );
  mainWorkflow.nodes = nodes;
  const director = mainWorkflow.nodes.find((node) => node.name === "Directeur Crew_System");
  if (!director) throw new Error("Directeur Crew_System node not found.");
  director.parameters.options = director.parameters.options || {};
  director.parameters.options.systemMessage = updateDirectorPrompt(director.parameters.options.systemMessage || "");
  mainWorkflow.connections = mainWorkflow.connections || {};
  const chatTrigger = mainWorkflow.nodes.find((node) => node.name === "When chat message received");
  if (!chatTrigger) throw new Error("When chat message received node not found.");
  const resumeRouter = mainWorkflow.nodes.find((node) => node.name === "Resume Request Router");
  const firstRouterAfterQuick = resumeRouter?.name || fast.statusRoute.name;
  mainWorkflow.connections[chatTrigger.name] = {
    main: [[{ node: fast.router.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.router.name] = {
    main: [[{ node: firstRouterAfterQuick, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.statusRoute.name] = {
    main: [
      [{ node: fast.loadStatusJobs.name, type: "main", index: 0 }],
      [{ node: fast.route.name, type: "main", index: 0 }],
    ],
  };
  mainWorkflow.connections[fast.loadStatusJobs.name] = {
    main: [[{ node: fast.selectStatusJob.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.selectStatusJob.name] = {
    main: [[{ node: fast.loadStatusProgress.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.loadStatusProgress.name] = {
    main: [[{ node: fast.loadStatusAgentRuns.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.loadStatusAgentRuns.name] = {
    main: [[{ node: fast.loadStatusDocuments.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.loadStatusDocuments.name] = {
    main: [[{ node: fast.formatStatus.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.formatStatus.name] = {
    main: [[{ node: "Public Response Leak Guard", type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.route.name] = {
    main: [
      [{ node: fast.ensureProject.name, type: "main", index: 0 }],
      [{ node: director.name, type: "main", index: 0 }],
    ],
  };
  mainWorkflow.connections[fast.ensureProject.name] = {
    main: [[{ node: fast.createJob.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.createJob.name] = {
    main: [[{ node: fast.addProgress.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.addProgress.name] = {
    main: [[{ node: fast.launchWorker.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.launchWorker.name] = {
    main: [[{ node: fast.format.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.format.name] = {
    main: [[{ node: "Public Response Leak Guard", type: "main", index: 0 }]],
  };
  delete mainWorkflow.connections.cs_async_start_job;
  mainWorkflow.connections.cs_async_start_job = {
    ai_tool: [[{ node: director.name, type: "ai_tool", index: 0 }]],
  };
  return mainWorkflow;
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const mainWorkflow = patchPublicResponseLeakGuard(await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${MAIN_WORKFLOW_ID}`));
  const existingWorker = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${WORKER_WORKFLOW_ID}`);
  const rebuiltWorker = buildWorkerWorkflowV2(mainWorkflow, existingWorker);
  const savedWorker = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${WORKER_WORKFLOW_ID}`, {
    method: "PUT",
    body: JSON.stringify(workflowUpdatePayload(rebuiltWorker)),
  });
  const updatedMain = addOrReplaceAsyncTool(mainWorkflow, savedWorker.id || WORKER_WORKFLOW_ID);
  const savedMain = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${MAIN_WORKFLOW_ID}`, {
    method: "PUT",
    body: JSON.stringify(workflowUpdatePayload(updatedMain)),
  });

  console.log(`worker=${savedWorker.id || WORKER_WORKFLOW_ID}`);
  console.log(`main=${savedMain.id || MAIN_WORKFLOW_ID}`);
  console.log("async_runtime=installed");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
