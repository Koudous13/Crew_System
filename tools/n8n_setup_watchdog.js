const fs = require("fs");
const crypto = require("crypto");

const WATCHDOG_WORKFLOW_NAME = "CS_JOB_WATCHDOG";
const SUPABASE_CREDENTIAL = { id: "OMiEiywYcayYYI4W", name: "Supabase Crew System" };

function loadEnv(path) {
  const env = {};
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
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
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function workflowPayload(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
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

function supabaseGetAllNode(name, tableId, limit, filterString, position) {
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
    },
    credentials: { supabaseApi: SUPABASE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
  };
}

function buildWorkflow(existing = {}) {
  const note = {
    id: nodeId(),
    name: "NOTE - Watchdog Contract",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [-760, -320],
    parameters: {
      color: 4,
      width: 780,
      height: 320,
      content:
        "## CS_JOB_WATCHDOG\n\nSurveille les chantiers Crew_System qui restent bloqués.\n\nRègles prudentes :\n\n- `queued` sans mouvement depuis 10 minutes : failed\n- `running` sans mouvement depuis 30 minutes : failed\n\nActions :\n\n1. lit les jobs actifs\n2. repère les jobs bloqués\n3. ajoute un événement clair dans `crew_progress_events`\n4. écrit une erreur dans `crew_errors`\n5. marque le job `failed`\n\nLe watchdog ne relance pas encore les jobs : il rend les blocages visibles et lisibles.",
    },
  };
  const schedule = {
    id: nodeId(),
    name: "Every 5 minutes",
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    position: [-520, 40],
    parameters: {
      rule: {
        interval: [
          {
            field: "minutes",
            minutesInterval: 5,
          },
        ],
      },
    },
  };
  const loadJobs = supabaseGetAllNode(
    "Load Active Jobs",
    "crew_jobs",
    100,
    "status=in.(queued,running)",
    [-220, 40],
  );
  const selectStaleJobs = {
    id: nodeId(),
    name: "Select Stale Jobs",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [80, 40],
    parameters: {
      jsCode: `const now = Date.now();
const QUEUED_TIMEOUT_MS = 10 * 60 * 1000;
const RUNNING_TIMEOUT_MS = 30 * 60 * 1000;
function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
const jobs = $input.all()
  .map((item) => item.json || {})
  .filter((job) => job.job_id && ['queued', 'running'].includes(job.status));
const stale = [];
for (const job of jobs) {
  const referenceDate = parseDate(job.updated_at) || parseDate(job.created_at);
  if (!referenceDate) continue;
  const ageMs = now - referenceDate.getTime();
  const timeoutMs = job.status === 'queued' ? QUEUED_TIMEOUT_MS : RUNNING_TIMEOUT_MS;
  if (ageMs < timeoutMs) continue;
  const ageMinutes = Math.floor(ageMs / 60000);
  const phase = job.current_phase || job.status || 'unknown';
  const message = job.status === 'queued'
    ? 'Le chantier est resté en attente trop longtemps. Il est marqué en échec pour éviter un faux statut en cours.'
    : 'Le chantier n a pas bougé depuis trop longtemps. Il est marqué en échec pour rendre le blocage visible.';
  stale.push({
    json: {
      job_id: job.job_id,
      project_slug: job.project_slug,
      previous_status: job.status,
      previous_phase: phase,
      previous_percent: Number(job.percent_estimate || 0),
      age_minutes: ageMinutes,
      watchdog_message: message,
      error_message: 'Watchdog Crew_System : job bloqué depuis ' + ageMinutes + ' minutes en phase ' + phase + '.',
      failed_assistant_message: [
        '# Chantier bloqué',
        '',
        message,
        '',
        '## Détails',
        '- Job : ' + job.job_id,
        '- Statut précédent : ' + job.status,
        '- Phase précédente : ' + phase,
        '- Dernière progression connue : ' + Number(job.percent_estimate || 0) + '%',
        '- Durée sans mouvement : ' + ageMinutes + ' minutes',
        '',
        '## Suite recommandée',
        'Relancer le chantier ou réduire le périmètre si la demande était très lourde.'
      ].join('\\n'),
    },
  });
}
return stale;`,
    },
  };
  const addProgress = supabaseNode(
    "Add Watchdog Progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $json.project_slug }}" },
      { fieldId: "status", fieldValue: "failed" },
      { fieldId: "message", fieldValue: "={{ $json.watchdog_message }}" },
      { fieldId: "percent_estimate", fieldValue: "={{ $json.previous_percent }}" },
      { fieldId: "current_phase", fieldValue: "watchdog_failed" },
      { fieldId: "active_agents", fieldValue: "={{ [] }}" },
    ],
    [380, 40],
  );
  const addError = supabaseNode(
    "Add Watchdog Error",
    "create",
    "crew_errors",
    [
      { fieldId: "error_id", fieldValue: "={{ 'error_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $json.project_slug }}" },
      { fieldId: "source_type", fieldValue: "runtime" },
      { fieldId: "source_name", fieldValue: "CS_JOB_WATCHDOG" },
      { fieldId: "severity", fieldValue: "error" },
      { fieldId: "recoverable", fieldValue: "true" },
      { fieldId: "message", fieldValue: "={{ $json.error_message }}" },
      { fieldId: "details", fieldValue: "={{ { previous_status: $json.previous_status, previous_phase: $json.previous_phase, previous_percent: $json.previous_percent, age_minutes: $json.age_minutes } }}" },
      { fieldId: "retry_count", fieldValue: "0" },
      { fieldId: "status", fieldValue: "open" },
    ],
    [680, 40],
    { node: { continueOnFail: true } },
  );
  const markFailed = supabaseNode(
    "Mark Job Failed",
    "update",
    "crew_jobs",
    [
      { fieldId: "status", fieldValue: "failed" },
      { fieldId: "assistant_message", fieldValue: "={{ $json.failed_assistant_message }}" },
      { fieldId: "error", fieldValue: "={{ $json.error_message }}" },
      { fieldId: "percent_estimate", fieldValue: "={{ $json.previous_percent }}" },
      { fieldId: "current_phase", fieldValue: "watchdog_failed" },
      { fieldId: "completed_at", fieldValue: "={{ new Date().toISOString() }}" },
    ],
    [980, 40],
    { parameters: { filterType: "string", filterString: "={{ 'job_id=eq.' + $json.job_id }}" } },
  );

  return {
    ...existing,
    name: WATCHDOG_WORKFLOW_NAME,
    nodes: [note, schedule, loadJobs, selectStaleJobs, addProgress, addError, markFailed],
    connections: {
      [schedule.name]: { main: [[{ node: loadJobs.name, type: "main", index: 0 }]] },
      [loadJobs.name]: { main: [[{ node: selectStaleJobs.name, type: "main", index: 0 }]] },
      [selectStaleJobs.name]: {
        main: [[
          { node: addProgress.name, type: "main", index: 0 },
          { node: addError.name, type: "main", index: 0 },
          { node: markFailed.name, type: "main", index: 0 },
        ]],
      },
    },
    settings: { ...(existing.settings || {}), executionOrder: "v1" },
  };
}

async function findWorkflowByName(baseUrl, apiKey, name) {
  const payload = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows?limit=100");
  const workflows = payload.data || payload;
  return workflows.find((workflow) => workflow.name === name) || null;
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const existingRef = await findWorkflowByName(baseUrl, apiKey, WATCHDOG_WORKFLOW_NAME);
  let saved;
  if (existingRef?.id) {
    const existing = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${existingRef.id}`);
    const workflow = buildWorkflow(existing);
    saved = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${existingRef.id}`, {
      method: "PUT",
      body: JSON.stringify(workflowPayload(workflow)),
    });
  } else {
    const workflow = buildWorkflow();
    saved = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows", {
      method: "POST",
      body: JSON.stringify(workflowPayload(workflow)),
    });
  }

  const workflowId = saved.id || existingRef?.id;
  if (!workflowId) throw new Error("Watchdog workflow was saved but no workflow id was returned.");
  if (!saved.active) {
    try {
      await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${workflowId}/activate`, { method: "POST" });
    } catch (error) {
      console.warn(`watchdog_activation_warning=${error.message}`);
    }
  }

  console.log(`watchdog=${workflowId}`);
  console.log("watchdog_runtime=installed");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
