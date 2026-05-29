const fs = require("fs");
const crypto = require("crypto");

const MAIN_WORKFLOW_ID = "U3eGOTVq0DenA2pm";
const RESUME_WORKFLOW_NAME = "CS_RESUME_JOB_WORKER";
const SUPABASE_CREDENTIAL = { id: "OMiEiywYcayYYI4W", name: "Supabase Crew System" };
const GOOGLE_DRIVE_CREDENTIAL = { id: "fXAOobHIOV39kLNd", name: "Google Drive Crew System" };
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
    connections: workflow.connections || {},
    settings: workflow.settings || { executionOrder: "v1" },
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

function progressNode(name, percent, phase, message, activeAgents, position) {
  return supabaseNode(
    name,
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Prepare Resume Context').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Prepare Resume Context').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "running" },
      { fieldId: "message", fieldValue: message },
      { fieldId: "percent_estimate", fieldValue: String(percent) },
      { fieldId: "current_phase", fieldValue: phase },
      { fieldId: "active_agents", fieldValue: `={{ ${JSON.stringify(activeAgents)} }}` },
    ],
    position,
    { node: { continueOnFail: true } },
  );
}

function agentWorkflowNode(name, agentWorkflow, position, agentId, expectedOutput, previousAgentOutputsExpression) {
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
          project_slug: "={{ $('Prepare Resume Context').first().json.project_slug }}",
          user_request: "={{ $('Prepare Resume Context').first().json.request_message }}",
          normalized_brief: "={{ $('Prepare Resume Context').first().json.request_message }}",
          context_summary: "={{ $('Prepare Resume Context').first().json.context_summary }}",
          previous_agent_outputs:
            previousAgentOutputsExpression || "={{ JSON.stringify($('Prepare Resume Context').first().json.agent_outputs || {}) }}",
          platform_context: "Facebook, LinkedIn",
          constraints:
            "Reprise ciblée. Ne refais que le travail demandé. Français, intensité stratégique forte, pas de JSON dans le livrable final.",
          expected_output: expectedOutput,
          language: "francais",
          resumed_agent_id: agentId,
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

function checkpointNode(name, agentId, sourceNodeName, position) {
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
  return text.length > limit ? text.slice(0, limit - 1) + '...' : text;
}
function score(value, keys) {
  for (const key of keys) {
    const number = Number(value?.[key]);
    if (Number.isFinite(number)) return Math.max(0, Math.min(100, Math.round(number)));
  }
  return null;
}
const base = $('Prepare Resume Context').first().json || {};
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
  agent_version: 'n8n_resume_v1',
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
      content: "={{ $('Build Resume Artifact Payload').first().json.content }}",
      name: "={{ $('Build Resume Artifact Payload').first().json.drive_file_name }}",
      driveId: { __rl: true, mode: "list", value: "My Drive" },
      folderId: { __rl: true, mode: "list", value: "root", cachedResultName: "/ (Root folder)" },
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

function buildResumeWorkflow(mainWorkflow, existing = {}) {
  const model = mainWorkflow.nodes.find((node) => node.name === "Gemini Chat Model");
  if (!model) throw new Error("Gemini Chat Model node not found.");
  const resumeModel = { ...JSON.parse(JSON.stringify(model)), id: nodeId(), position: [15680, -240] };

  const note = {
    id: nodeId(),
    name: "NOTE - Resume Worker Contract",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [-760, -420],
    parameters: {
      color: 4,
      width: 840,
      height: 360,
      content:
        "## CS_RESUME_JOB_WORKER\n\nReprise ciblée d'un chantier existant.\n\n1. lit le job\n2. lit les checkpoints `crew_agent_runs`\n3. relance uniquement les agents manquants ou échoués\n4. refait la synthèse finale\n5. crée une nouvelle version Markdown dans Google Drive\n6. remet le job en `completed` ou `failed`\n\nObjectif : ne pas refaire tout le chantier quand un seul agent ou la synthèse a échoué.",
    },
  };
  const trigger = triggerNode("When called by resume launcher", [-520, 0]);
  const prepareRequest = codeNode(
    "Prepare Resume Request",
    `const input = $input.first().json || {};
const job_id = String(input.job_id || input.resume_job_id || '').trim();
const resume_request = String(input.resume_request || input.request_message || input.chatInput || '').trim();
return [{ json: {
  ...input,
  job_id,
  resume_request,
  project_slug: input.project_slug || ''
} }];`,
    [-220, 0],
  );
  const loadJob = supabaseGetAllNode(
    "Load Resume Job",
    "crew_jobs",
    1,
    "={{ 'job_id=eq.' + $('Prepare Resume Request').first().json.job_id }}",
    [80, 0],
  );
  const loadAgentRuns = supabaseGetAllNode(
    "Load Resume Agent Runs",
    "crew_agent_runs",
    100,
    "={{ 'job_id=eq.' + $('Prepare Resume Request').first().json.job_id }}",
    [380, 0],
  );
  const prepareContext = codeNode(
    "Prepare Resume Context",
    `const request = $('Prepare Resume Request').first().json || {};
const jobRows = $('Load Resume Job').all().map((item) => item.json || {}).filter((row) => row.job_id);
const job = jobRows[0] || {};
const runs = $input.all().map((item) => item.json || {}).filter((row) => row.agent_id);
const allAgentOrder = [
  'strategist',
  'audience_psychologist',
  'growth_hacker',
  'hook_master',
  'facebook_native_agent',
  'linkedin_native_agent',
  'calendar_architect',
  'copywriter',
  'creative_director'
];
const latest = {};
for (const run of runs) {
  const current = latest[run.agent_id];
  const runDate = new Date(run.completed_at || run.created_at || 0).getTime();
  const currentDate = current ? new Date(current.completed_at || current.created_at || 0).getTime() : -1;
  if (!current || runDate >= currentDate) latest[run.agent_id] = run;
}
const agent_outputs = {};
const agent_statuses = {};
for (const agent of allAgentOrder) {
  const run = latest[agent];
  const status = String(run?.status || '').toLowerCase();
  const isComplete = ['completed', 'success'].includes(status) && run?.handoff && Object.keys(run.handoff || {}).length > 0;
  agent_statuses[agent] = isComplete ? 'completed' : (status || 'missing');
  if (isComplete) agent_outputs[agent] = run.handoff;
}
const project_slug = job.project_slug || request.project_slug || '';
const request_message = job.request_message || request.resume_request || '';
const normalized = [request_message, request.resume_request, job.job_type, job.current_phase].join(' ').toLowerCase();
const hasFacebook = /\b(facebook|fb|meta)\b/i.test(normalized);
const hasLinkedIn = /\b(linkedin|linked ?in)\b/i.test(normalized);
const noSpecificPlatform = !hasFacebook && !hasLinkedIn;
const wantsCalendar = /calendrier|editorial|éditorial|annuel|annuelle|sur 1 an|12 mois|52 semaines|planning/i.test(normalized);
const wantsBatch = /\b(batch|posts?|publications?|contenus?|semaine|30\s+|70\s+|scripts?|captions?)\b/i.test(normalized);
const wantsVisual = /\b(visuels?|images?|creatives?|créatives?|video|vidéo|briefs? visuels?)\b/i.test(normalized);
const wantsPlatformWork = wantsCalendar || wantsBatch || hasFacebook || hasLinkedIn;
const existingCompletedAgents = Object.keys(agent_outputs);
const inferred_route = wantsCalendar && !wantsBatch
  ? 'annual_calendar'
  : wantsBatch
    ? 'content_batch'
    : wantsVisual
      ? 'creative_batch'
      : 'strategy_brief';
const hasExistingCalendar = existingCompletedAgents.includes('calendar_architect');
const hasExistingContentBatch = existingCompletedAgents.includes('copywriter') || existingCompletedAgents.includes('facebook_native_agent') || existingCompletedAgents.includes('linkedin_native_agent');
const hasExistingCreativeOnly = existingCompletedAgents.includes('creative_director') && !hasExistingContentBatch;
const job_route = hasExistingContentBatch
  ? 'content_batch'
  : hasExistingCalendar
    ? 'annual_calendar'
    : hasExistingCreativeOnly
      ? 'creative_batch'
      : inferred_route;
const should = {
  strategist: true,
  audience_psychologist: true,
  growth_hacker: true,
  hook_master: job_route !== 'annual_calendar' || existingCompletedAgents.includes('hook_master'),
  facebook_native_agent: (wantsPlatformWork && (hasFacebook || noSpecificPlatform)) || existingCompletedAgents.includes('facebook_native_agent'),
  linkedin_native_agent: (wantsPlatformWork && (hasLinkedIn || noSpecificPlatform)) || existingCompletedAgents.includes('linkedin_native_agent'),
  calendar_architect: job_route === 'annual_calendar' || existingCompletedAgents.includes('calendar_architect'),
  copywriter: job_route === 'content_batch' || existingCompletedAgents.includes('copywriter'),
  creative_director: wantsVisual || job_route === 'content_batch' || job_route === 'creative_batch' || existingCompletedAgents.includes('creative_director'),
};
const required_agents = allAgentOrder.filter((agent) => should[agent]);
const needs = {};
for (const agent of allAgentOrder) needs[agent] = required_agents.includes(agent) && agent_statuses[agent] !== 'completed';
const firstMissing = required_agents.find((agent) => needs[agent]) || 'synthesis_only';
const stable_context = [
  'Projet actif: ' + project_slug + '.',
  'Ne suppose jamais l identite du porteur, la marque, la cible ou les plateformes.',
  'Utilise seulement le contexte du job, les checkpoints agents et les documents du projet.'
].join('\\n');
return [{ json: {
  ...request,
  job,
  job_found: Boolean(job.job_id),
  project_slug,
  job_id: request.job_id,
  request_message,
  context_summary: [stable_context, 'Reprise ciblee du job ' + request.job_id, request.resume_request || ''].filter(Boolean).join('\\n\\n'),
  expected_output: 'Livrable final Markdown repris depuis les checkpoints existants.',
  job_route,
  required_agents,
  latest_agent_runs: latest,
  agent_outputs,
  agent_statuses,
  needs_strategist: needs.strategist,
  needs_audience: needs.audience_psychologist,
  needs_growth: needs.growth_hacker,
  needs_hooks: needs.hook_master,
  needs_facebook_native: needs.facebook_native_agent,
  needs_linkedin_native: needs.linkedin_native_agent,
  needs_calendar: needs.calendar_architect,
  needs_copywriter: needs.copywriter,
  needs_creative: needs.creative_director,
  resume_from: firstMissing,
  resume_agents: required_agents.filter((agent) => needs[agent])
} }];`,
    [680, 0],
  );
  const markResumeRunning = supabaseNode(
    "Mark Resume Running",
    "update",
    "crew_jobs",
    [
      { fieldId: "status", fieldValue: "running" },
      { fieldId: "percent_estimate", fieldValue: "12" },
      { fieldId: "current_phase", fieldValue: "resume_planning" },
      { fieldId: "error", fieldValue: "" },
    ],
    [980, 0],
    { parameters: { filterType: "string", filterString: "={{ 'job_id=eq.' + $('Prepare Resume Context').first().json.job_id }}" }, node: { continueOnFail: true } },
  );
  const addResumeProgress = progressNode(
    "Add Resume Planning Progress",
    12,
    "resume_planning",
    "Reprise ciblée lancée. Le système lit les checkpoints et relance seulement ce qui manque.",
    ["resume_worker"],
    [1280, 0],
  );

  const resumeOutputsExpression = (checkpointPairs = []) =>
    `={{ (() => {
  const outputs = { ...($('Prepare Resume Context').first().json.agent_outputs || {}) };
  const pairs = ${JSON.stringify(checkpointPairs)};
  for (const pair of pairs) {
    try {
      const row = $(pair.node).first().json || {};
      const value = row.handoff || row.output || row;
      if (value && Object.keys(value).length > 0) outputs[pair.agent] = value;
    } catch (error) {}
  }
  return JSON.stringify(outputs);
})() }}`;

  const routeStrategist = ifNode("Needs Strategist?", "={{ $('Prepare Resume Context').first().json.needs_strategist }}", [1580, 0]);
  const strategistProgress = progressNode("Resume Progress Strategist", 24, "resume_strategist", "Reprise Strategist en cours.", ["strategist"], [1880, -220]);
  const runStrategist = agentWorkflowNode("Run Resume Strategist Agent", AGENT_WORKFLOWS.strategist, [2180, -220], "strategist", "Reprendre ou produire le diagnostic stratégique manquant.");
  const checkpointStrategist = checkpointNode("Checkpoint Resume Strategist", "strategist", "Run Resume Strategist Agent", [2480, -220]);
  const saveStrategist = saveAgentRunNode("Save Resume Strategist", [2780, -220]);

  const routeAudience = ifNode("Needs Audience?", "={{ $('Prepare Resume Context').first().json.needs_audience }}", [3080, 0]);
  const audienceProgress = progressNode("Resume Progress Audience", 42, "resume_audience", "Reprise Audience Psychologist en cours.", ["audience_psychologist"], [3380, -220]);
  const runAudience = agentWorkflowNode(
    "Run Resume Audience Agent",
    AGENT_WORKFLOWS.audience,
    [3680, -220],
    "audience_psychologist",
    "Reprendre ou produire l'analyse psychologique audience manquante.",
    resumeOutputsExpression([{ agent: "strategist", node: "Checkpoint Resume Strategist" }]),
  );
  const checkpointAudience = checkpointNode("Checkpoint Resume Audience", "audience_psychologist", "Run Resume Audience Agent", [3980, -220]);
  const saveAudience = saveAgentRunNode("Save Resume Audience", [4280, -220]);

  const routeGrowth = ifNode("Needs Growth?", "={{ $('Prepare Resume Context').first().json.needs_growth }}", [4580, 0]);
  const growthProgress = progressNode("Resume Progress Growth", 60, "resume_growth", "Reprise Growth Hacker en cours.", ["growth_hacker"], [4880, -220]);
  const runGrowth = agentWorkflowNode(
    "Run Resume Growth Agent",
    AGENT_WORKFLOWS.growth,
    [5180, -220],
    "growth_hacker",
    "Reprendre ou produire le plan growth manquant.",
    resumeOutputsExpression([
      { agent: "strategist", node: "Checkpoint Resume Strategist" },
      { agent: "audience_psychologist", node: "Checkpoint Resume Audience" },
    ]),
  );
  const checkpointGrowth = checkpointNode("Checkpoint Resume Growth", "growth_hacker", "Run Resume Growth Agent", [5480, -220]);
  const saveGrowth = saveAgentRunNode("Save Resume Growth", [5780, -220]);

  const routeHooks = ifNode("Needs Hooks?", "={{ $('Prepare Resume Context').first().json.needs_hooks }}", [6080, 0]);
  const hooksProgress = progressNode("Resume Progress Hooks", 76, "resume_hooks", "Reprise Hook Master en cours.", ["hook_master"], [6380, -220]);
  const runHooks = agentWorkflowNode(
    "Run Resume Hook Agent",
    AGENT_WORKFLOWS.hooks,
    [6680, -220],
    "hook_master",
    "Reprendre ou produire la banque de hooks manquante.",
    resumeOutputsExpression([
      { agent: "strategist", node: "Checkpoint Resume Strategist" },
      { agent: "audience_psychologist", node: "Checkpoint Resume Audience" },
      { agent: "growth_hacker", node: "Checkpoint Resume Growth" },
    ]),
  );
  const checkpointHooks = checkpointNode("Checkpoint Resume Hooks", "hook_master", "Run Resume Hook Agent", [6980, -220]);
  const saveHooks = saveAgentRunNode("Save Resume Hooks", [7280, -220]);

  const corePairs = [
    { agent: "strategist", node: "Checkpoint Resume Strategist" },
    { agent: "audience_psychologist", node: "Checkpoint Resume Audience" },
    { agent: "growth_hacker", node: "Checkpoint Resume Growth" },
    { agent: "hook_master", node: "Checkpoint Resume Hooks" },
  ];
  const routeFacebook = ifNode("Needs Facebook Native?", "={{ $('Prepare Resume Context').first().json.needs_facebook_native }}", [7580, 0]);
  const facebookProgress = progressNode("Resume Progress Facebook Native", 66, "resume_facebook_native", "Reprise Facebook Native en cours.", ["facebook_native_agent"], [7880, -220]);
  const runFacebook = agentWorkflowNode(
    "Run Resume Facebook Native Agent",
    AGENT_WORKFLOWS.facebook,
    [8180, -220],
    "facebook_native_agent",
    "Reprendre ou produire l'adaptation Facebook native manquante.",
    resumeOutputsExpression(corePairs),
  );
  const checkpointFacebook = checkpointNode("Checkpoint Resume Facebook Native", "facebook_native_agent", "Run Resume Facebook Native Agent", [8480, -220]);
  const saveFacebook = saveAgentRunNode("Save Resume Facebook Native", [8780, -220]);

  const routeLinkedIn = ifNode("Needs LinkedIn Native?", "={{ $('Prepare Resume Context').first().json.needs_linkedin_native }}", [9080, 0]);
  const linkedinProgress = progressNode("Resume Progress LinkedIn Native", 72, "resume_linkedin_native", "Reprise LinkedIn Native en cours.", ["linkedin_native_agent"], [9380, -220]);
  const runLinkedIn = agentWorkflowNode(
    "Run Resume LinkedIn Native Agent",
    AGENT_WORKFLOWS.linkedin,
    [9680, -220],
    "linkedin_native_agent",
    "Reprendre ou produire l'adaptation LinkedIn native manquante.",
    resumeOutputsExpression(corePairs),
  );
  const checkpointLinkedIn = checkpointNode("Checkpoint Resume LinkedIn Native", "linkedin_native_agent", "Run Resume LinkedIn Native Agent", [9980, -220]);
  const saveLinkedIn = saveAgentRunNode("Save Resume LinkedIn Native", [10280, -220]);

  const routeCalendar = ifNode("Needs Calendar Architect?", "={{ $('Prepare Resume Context').first().json.needs_calendar }}", [10580, 0]);
  const calendarProgress = progressNode("Resume Progress Calendar Architect", 78, "resume_calendar_architect", "Reprise Calendar Architect en cours.", ["calendar_architect"], [10880, -220]);
  const runCalendar = agentWorkflowNode(
    "Run Resume Calendar Architect Agent",
    AGENT_WORKFLOWS.calendar,
    [11180, -220],
    "calendar_architect",
    "Reprendre ou produire l'architecture de calendrier manquante.",
    resumeOutputsExpression([
      ...corePairs,
      { agent: "facebook_native_agent", node: "Checkpoint Resume Facebook Native" },
      { agent: "linkedin_native_agent", node: "Checkpoint Resume LinkedIn Native" },
    ]),
  );
  const checkpointCalendar = checkpointNode("Checkpoint Resume Calendar Architect", "calendar_architect", "Run Resume Calendar Architect Agent", [11480, -220]);
  const saveCalendar = saveAgentRunNode("Save Resume Calendar Architect", [11780, -220]);

  const routeCopywriter = ifNode("Needs Copywriter?", "={{ $('Prepare Resume Context').first().json.needs_copywriter }}", [12080, 0]);
  const copywriterProgress = progressNode("Resume Progress Copywriter", 84, "resume_copywriter", "Reprise Copywriter en cours.", ["copywriter"], [12380, -220]);
  const runCopywriter = agentWorkflowNode(
    "Run Resume Copywriter Agent",
    AGENT_WORKFLOWS.copywriter,
    [12680, -220],
    "copywriter",
    "Reprendre ou produire les contenus finaux manquants.",
    resumeOutputsExpression([
      ...corePairs,
      { agent: "facebook_native_agent", node: "Checkpoint Resume Facebook Native" },
      { agent: "linkedin_native_agent", node: "Checkpoint Resume LinkedIn Native" },
      { agent: "calendar_architect", node: "Checkpoint Resume Calendar Architect" },
    ]),
  );
  const checkpointCopywriter = checkpointNode("Checkpoint Resume Copywriter", "copywriter", "Run Resume Copywriter Agent", [12980, -220]);
  const saveCopywriter = saveAgentRunNode("Save Resume Copywriter", [13280, -220]);

  const routeCreative = ifNode("Needs Creative Director?", "={{ $('Prepare Resume Context').first().json.needs_creative }}", [13580, 0]);
  const creativeProgress = progressNode("Resume Progress Creative Director", 90, "resume_creative_director", "Reprise Creative Director en cours.", ["creative_director"], [13880, -220]);
  const runCreative = agentWorkflowNode(
    "Run Resume Creative Director Agent",
    AGENT_WORKFLOWS.creative,
    [14180, -220],
    "creative_director",
    "Reprendre ou produire la direction creative manquante.",
    resumeOutputsExpression([
      ...corePairs,
      { agent: "facebook_native_agent", node: "Checkpoint Resume Facebook Native" },
      { agent: "linkedin_native_agent", node: "Checkpoint Resume LinkedIn Native" },
      { agent: "calendar_architect", node: "Checkpoint Resume Calendar Architect" },
      { agent: "copywriter", node: "Checkpoint Resume Copywriter" },
    ]),
  );
  const checkpointCreative = checkpointNode("Checkpoint Resume Creative Director", "creative_director", "Run Resume Creative Director Agent", [14480, -220]);
  const saveCreative = saveAgentRunNode("Save Resume Creative Director", [14780, -220]);

  const synthesisProgress = progressNode(
    "Resume Progress Synthesis",
    94,
    "resume_synthesis",
    "Les checkpoints sont prêts. Le Directeur worker refait la synthèse finale.",
    ["resume_worker", "director_async_worker"],
    [15080, 0],
  );
  const buildSynthesisPrompt = codeNode(
    "Build Resume Synthesis Prompt",
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return null; }
}
function pick(value) {
  if (!value) return null;
  if (value.handoff && typeof value.handoff === 'object') return value.handoff;
  if (value.output && typeof value.output === 'object') return value.output;
  return value;
}
function compact(value, limit = 9000) {
  const text = JSON.stringify(value, null, 2);
  return text.length > limit ? text.slice(0, limit) + '\\n...TRONQUE...' : text;
}
const base = $('Prepare Resume Context').first().json || {};
const outputs = { ...(base.agent_outputs || {}) };
const replacements = {
  strategist: pick(readNode('Checkpoint Resume Strategist')),
  audience_psychologist: pick(readNode('Checkpoint Resume Audience')),
  growth_hacker: pick(readNode('Checkpoint Resume Growth')),
  hook_master: pick(readNode('Checkpoint Resume Hooks')),
  facebook_native_agent: pick(readNode('Checkpoint Resume Facebook Native')),
  linkedin_native_agent: pick(readNode('Checkpoint Resume LinkedIn Native')),
  calendar_architect: pick(readNode('Checkpoint Resume Calendar Architect')),
  copywriter: pick(readNode('Checkpoint Resume Copywriter')),
  creative_director: pick(readNode('Checkpoint Resume Creative Director')),
};
for (const [agent, value] of Object.entries(replacements)) {
  if (value && Object.keys(value).length > 0) outputs[agent] = value;
}
const requiredAgents = base.required_agents || ['strategist','audience_psychologist','growth_hacker','hook_master'];
const missing = requiredAgents.filter((agent) => !outputs[agent]);
const prompt = [
  'Mission de reprise ciblée Crew_System.',
  '',
  'job_id: ' + base.job_id,
  'project_slug: ' + base.project_slug,
  'route: ' + base.job_route,
  'agents requis: ' + requiredAgents.join(', '),
  'Demande initiale: ' + base.request_message,
  'Demande de reprise: ' + (base.resume_request || ''),
  'Reprise depuis: ' + base.resume_from,
  '',
  'Sorties agents disponibles:',
  compact(outputs),
  '',
  'Agents encore manquants: ' + missing.join(', '),
  '',
  'Consigne:',
  '- Refais uniquement la synthèse finale à partir des checkpoints disponibles et des agents relancés.',
  '- Si la demande concerne un batch de contenus, conserve les contenus finaux et les briefs visuels exploitables.',
  '- Si la demande concerne un calendrier, conserve la structure longue, les arcs, les semaines et les boucles growth.',
  '- Si un agent manque encore, compense sans inventer de preuve et liste la question à la fin.',
  '- Produit un Markdown public, lisible, directement exploitable.',
  '- Commence par un titre H1.',
  '- Aucun JSON brut, aucune note interne, aucun détail technique.'
].join('\\n');
return [{ json: { ...base, agent_outputs: outputs, missing_agents: missing, worker_prompt: prompt } }];`,
    [15380, 0],
  );
  const director = {
    id: nodeId(),
    name: "Resume Worker Directeur",
    type: "@n8n/n8n-nodes-langchain.agent",
    typeVersion: 2.2,
    position: [15680, 0],
    retryOnFail: true,
    continueOnFail: true,
    maxTries: 2,
    waitBetweenTries: 4000,
    parameters: {
      promptType: "define",
      text: "={{ $('Build Resume Synthesis Prompt').first().json.worker_prompt }}",
      options: {
        systemMessage:
          "Tu es le Directeur de reprise de Crew_System. Tu ne refais pas le travail déjà validé. Tu consolides les checkpoints disponibles et produis un Markdown final public. Aucun JSON brut, aucune note interne, aucune trace technique.",
      },
    },
  };
  const sanitizer = codeNode(
    "Resume Markdown Sanitizer",
    `let output = String($json.output || $json.text || $json.response || '').trim();
const h1 = output.search(/(^|\\n)#\\s+/);
if (h1 > 0) output = output.slice(h1).trim();
output = output.trim();
return [{ json: { output } }];`,
    [15980, 0],
  );
  const buildPayload = codeNode(
    "Build Resume Artifact Payload",
    `const output = String($json.output || '').trim();
const base = $('Build Resume Synthesis Prompt').first().json || {};
const safeJob = String(base.job_id || 'job_unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
const suffix = Date.now().toString(36);
const hasUsableOutput = /^#\\s+/m.test(output) && output.length > 80;
const status = hasUsableOutput ? 'completed' : 'failed';
const content = hasUsableOutput ? output : [
  '# Reprise échouée',
  '',
  'La reprise ciblée a été lancée, mais la synthèse finale n a pas produit de Markdown exploitable.',
  '',
  '## Job',
  base.job_id || '',
  '',
  '## Agents manquants',
  (base.missing_agents || []).join(', ') || 'Non renseigné'
].join('\\n');
return [{ json: {
  job_id: base.job_id,
  project_slug: base.project_slug,
  artifact_id: 'artifact_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  document_id: 'document_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  completion_event_id: 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  path: 'async_jobs/' + safeJob + '/resume_' + suffix + '.md',
  drive_file_name: safeJob + '_crew_system_resume_' + suffix + '.md',
  document_title: 'Crew_System - Reprise finale - ' + safeJob,
  content_type: 'text/markdown',
  content,
  status,
  current_phase: status === 'completed' ? 'completed' : 'failed',
  completion_message: status === 'completed' ? 'Reprise terminée. Le livrable final est disponible.' : 'Reprise terminée en erreur. Un diagnostic a été sauvegardé.'
} }];`,
    [16280, 0],
  );
  const saveArtifact = supabaseNode(
    "Save Resume Artifact",
    "create",
    "crew_artifacts",
    [
      { fieldId: "artifact_id", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.artifact_id }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.project_slug }}" },
      { fieldId: "path", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.path }}" },
      { fieldId: "status", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.status }}" },
      { fieldId: "content_type", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.content_type }}" },
      { fieldId: "content", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.content }}" },
    ],
    [16580, 0],
  );
  const createDriveFile = googleDriveCreateTextNode("Create Resume Markdown In Drive", [16880, 0]);
  const buildDocumentIndex = codeNode(
    "Build Resume Document Index",
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return {}; }
}
const payload = $('Build Resume Artifact Payload').first().json || {};
const drive = readNode('Create Resume Markdown In Drive');
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
    [17180, 0],
  );
  const indexDocument = supabaseNode(
    "Index Resume Drive Document",
    "create",
    "crew_documents",
    [
      { fieldId: "document_id", fieldValue: "={{ $('Build Resume Document Index').first().json.document_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Resume Document Index').first().json.project_slug }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Resume Document Index').first().json.job_id }}" },
      { fieldId: "artifact_id", fieldValue: "={{ $('Build Resume Document Index').first().json.artifact_id }}" },
      { fieldId: "storage_provider", fieldValue: "={{ $('Build Resume Document Index').first().json.storage_provider }}" },
      { fieldId: "path", fieldValue: "={{ $('Build Resume Document Index').first().json.path }}" },
      { fieldId: "title", fieldValue: "={{ $('Build Resume Document Index').first().json.title }}" },
      { fieldId: "document_type", fieldValue: "={{ $('Build Resume Document Index').first().json.document_type }}" },
      { fieldId: "status", fieldValue: "={{ $('Build Resume Document Index').first().json.status }}" },
      { fieldId: "content_type", fieldValue: "={{ $('Build Resume Document Index').first().json.content_type }}" },
      { fieldId: "drive_file_id", fieldValue: "={{ $('Build Resume Document Index').first().json.drive_file_id }}" },
      { fieldId: "drive_url", fieldValue: "={{ $('Build Resume Document Index').first().json.drive_url }}" },
    ],
    [17480, 0],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const completionProgress = supabaseNode(
    "Add Resume Completion Progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.completion_event_id }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.status }}" },
      { fieldId: "message", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.completion_message }}" },
      { fieldId: "percent_estimate", fieldValue: "100" },
      { fieldId: "current_phase", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.current_phase }}" },
      { fieldId: "artifacts_created", fieldValue: "={{ [$('Build Resume Artifact Payload').first().json.path] }}" },
    ],
    [17780, 0],
  );
  const markFinalStatus = supabaseNode(
    "Mark Resume Final Status",
    "update",
    "crew_jobs",
    [
      { fieldId: "status", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.status }}" },
      { fieldId: "assistant_message", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.content }}" },
      { fieldId: "artifacts_created", fieldValue: "={{ [$('Build Resume Artifact Payload').first().json.path] }}" },
      { fieldId: "percent_estimate", fieldValue: "100" },
      { fieldId: "current_phase", fieldValue: "={{ $('Build Resume Artifact Payload').first().json.current_phase }}" },
      { fieldId: "completed_at", fieldValue: "={{ new Date().toISOString() }}" },
    ],
    [18080, 0],
    { parameters: { filterType: "string", filterString: "={{ 'job_id=eq.' + $('Build Resume Artifact Payload').first().json.job_id }}" } },
  );

  const nodes = [
    note,
    trigger,
    prepareRequest,
    loadJob,
    loadAgentRuns,
    prepareContext,
    markResumeRunning,
    addResumeProgress,
    routeStrategist,
    strategistProgress,
    runStrategist,
    checkpointStrategist,
    saveStrategist,
    routeAudience,
    audienceProgress,
    runAudience,
    checkpointAudience,
    saveAudience,
    routeGrowth,
    growthProgress,
    runGrowth,
    checkpointGrowth,
    saveGrowth,
    routeHooks,
    hooksProgress,
    runHooks,
    checkpointHooks,
    saveHooks,
    routeFacebook,
    facebookProgress,
    runFacebook,
    checkpointFacebook,
    saveFacebook,
    routeLinkedIn,
    linkedinProgress,
    runLinkedIn,
    checkpointLinkedIn,
    saveLinkedIn,
    routeCalendar,
    calendarProgress,
    runCalendar,
    checkpointCalendar,
    saveCalendar,
    routeCopywriter,
    copywriterProgress,
    runCopywriter,
    checkpointCopywriter,
    saveCopywriter,
    routeCreative,
    creativeProgress,
    runCreative,
    checkpointCreative,
    saveCreative,
    synthesisProgress,
    buildSynthesisPrompt,
    director,
    resumeModel,
    sanitizer,
    buildPayload,
    saveArtifact,
    createDriveFile,
    buildDocumentIndex,
    indexDocument,
    completionProgress,
    markFinalStatus,
  ];
  const connections = {
    [trigger.name]: { main: [[{ node: prepareRequest.name, type: "main", index: 0 }]] },
    [prepareRequest.name]: { main: [[{ node: loadJob.name, type: "main", index: 0 }]] },
    [loadJob.name]: { main: [[{ node: loadAgentRuns.name, type: "main", index: 0 }]] },
    [loadAgentRuns.name]: { main: [[{ node: prepareContext.name, type: "main", index: 0 }]] },
    [prepareContext.name]: { main: [[{ node: markResumeRunning.name, type: "main", index: 0 }]] },
    [markResumeRunning.name]: { main: [[{ node: addResumeProgress.name, type: "main", index: 0 }]] },
    [addResumeProgress.name]: { main: [[{ node: routeStrategist.name, type: "main", index: 0 }]] },
    [routeStrategist.name]: {
      main: [
        [{ node: strategistProgress.name, type: "main", index: 0 }],
        [{ node: routeAudience.name, type: "main", index: 0 }],
      ],
    },
    [strategistProgress.name]: { main: [[{ node: runStrategist.name, type: "main", index: 0 }]] },
    [runStrategist.name]: { main: [[{ node: checkpointStrategist.name, type: "main", index: 0 }]] },
    [checkpointStrategist.name]: { main: [[{ node: saveStrategist.name, type: "main", index: 0 }]] },
    [saveStrategist.name]: { main: [[{ node: routeAudience.name, type: "main", index: 0 }]] },
    [routeAudience.name]: {
      main: [
        [{ node: audienceProgress.name, type: "main", index: 0 }],
        [{ node: routeGrowth.name, type: "main", index: 0 }],
      ],
    },
    [audienceProgress.name]: { main: [[{ node: runAudience.name, type: "main", index: 0 }]] },
    [runAudience.name]: { main: [[{ node: checkpointAudience.name, type: "main", index: 0 }]] },
    [checkpointAudience.name]: { main: [[{ node: saveAudience.name, type: "main", index: 0 }]] },
    [saveAudience.name]: { main: [[{ node: routeGrowth.name, type: "main", index: 0 }]] },
    [routeGrowth.name]: {
      main: [
        [{ node: growthProgress.name, type: "main", index: 0 }],
        [{ node: routeHooks.name, type: "main", index: 0 }],
      ],
    },
    [growthProgress.name]: { main: [[{ node: runGrowth.name, type: "main", index: 0 }]] },
    [runGrowth.name]: { main: [[{ node: checkpointGrowth.name, type: "main", index: 0 }]] },
    [checkpointGrowth.name]: { main: [[{ node: saveGrowth.name, type: "main", index: 0 }]] },
    [saveGrowth.name]: { main: [[{ node: routeHooks.name, type: "main", index: 0 }]] },
    [routeHooks.name]: {
      main: [
        [{ node: hooksProgress.name, type: "main", index: 0 }],
        [{ node: routeFacebook.name, type: "main", index: 0 }],
      ],
    },
    [hooksProgress.name]: { main: [[{ node: runHooks.name, type: "main", index: 0 }]] },
    [runHooks.name]: { main: [[{ node: checkpointHooks.name, type: "main", index: 0 }]] },
    [checkpointHooks.name]: { main: [[{ node: saveHooks.name, type: "main", index: 0 }]] },
    [saveHooks.name]: { main: [[{ node: routeFacebook.name, type: "main", index: 0 }]] },
    [routeFacebook.name]: {
      main: [
        [{ node: facebookProgress.name, type: "main", index: 0 }],
        [{ node: routeLinkedIn.name, type: "main", index: 0 }],
      ],
    },
    [facebookProgress.name]: { main: [[{ node: runFacebook.name, type: "main", index: 0 }]] },
    [runFacebook.name]: { main: [[{ node: checkpointFacebook.name, type: "main", index: 0 }]] },
    [checkpointFacebook.name]: { main: [[{ node: saveFacebook.name, type: "main", index: 0 }]] },
    [saveFacebook.name]: { main: [[{ node: routeLinkedIn.name, type: "main", index: 0 }]] },
    [routeLinkedIn.name]: {
      main: [
        [{ node: linkedinProgress.name, type: "main", index: 0 }],
        [{ node: routeCalendar.name, type: "main", index: 0 }],
      ],
    },
    [linkedinProgress.name]: { main: [[{ node: runLinkedIn.name, type: "main", index: 0 }]] },
    [runLinkedIn.name]: { main: [[{ node: checkpointLinkedIn.name, type: "main", index: 0 }]] },
    [checkpointLinkedIn.name]: { main: [[{ node: saveLinkedIn.name, type: "main", index: 0 }]] },
    [saveLinkedIn.name]: { main: [[{ node: routeCalendar.name, type: "main", index: 0 }]] },
    [routeCalendar.name]: {
      main: [
        [{ node: calendarProgress.name, type: "main", index: 0 }],
        [{ node: routeCopywriter.name, type: "main", index: 0 }],
      ],
    },
    [calendarProgress.name]: { main: [[{ node: runCalendar.name, type: "main", index: 0 }]] },
    [runCalendar.name]: { main: [[{ node: checkpointCalendar.name, type: "main", index: 0 }]] },
    [checkpointCalendar.name]: { main: [[{ node: saveCalendar.name, type: "main", index: 0 }]] },
    [saveCalendar.name]: { main: [[{ node: routeCopywriter.name, type: "main", index: 0 }]] },
    [routeCopywriter.name]: {
      main: [
        [{ node: copywriterProgress.name, type: "main", index: 0 }],
        [{ node: routeCreative.name, type: "main", index: 0 }],
      ],
    },
    [copywriterProgress.name]: { main: [[{ node: runCopywriter.name, type: "main", index: 0 }]] },
    [runCopywriter.name]: { main: [[{ node: checkpointCopywriter.name, type: "main", index: 0 }]] },
    [checkpointCopywriter.name]: { main: [[{ node: saveCopywriter.name, type: "main", index: 0 }]] },
    [saveCopywriter.name]: { main: [[{ node: routeCreative.name, type: "main", index: 0 }]] },
    [routeCreative.name]: {
      main: [
        [{ node: creativeProgress.name, type: "main", index: 0 }],
        [{ node: synthesisProgress.name, type: "main", index: 0 }],
      ],
    },
    [creativeProgress.name]: { main: [[{ node: runCreative.name, type: "main", index: 0 }]] },
    [runCreative.name]: { main: [[{ node: checkpointCreative.name, type: "main", index: 0 }]] },
    [checkpointCreative.name]: { main: [[{ node: saveCreative.name, type: "main", index: 0 }]] },
    [saveCreative.name]: { main: [[{ node: synthesisProgress.name, type: "main", index: 0 }]] },
    [synthesisProgress.name]: { main: [[{ node: buildSynthesisPrompt.name, type: "main", index: 0 }]] },
    [buildSynthesisPrompt.name]: { main: [[{ node: director.name, type: "main", index: 0 }]] },
    [resumeModel.name]: { ai_languageModel: [[{ node: director.name, type: "ai_languageModel", index: 0 }]] },
    [director.name]: { main: [[{ node: sanitizer.name, type: "main", index: 0 }]] },
    [sanitizer.name]: { main: [[{ node: buildPayload.name, type: "main", index: 0 }]] },
    [buildPayload.name]: { main: [[{ node: saveArtifact.name, type: "main", index: 0 }]] },
    [saveArtifact.name]: { main: [[{ node: createDriveFile.name, type: "main", index: 0 }]] },
    [createDriveFile.name]: { main: [[{ node: buildDocumentIndex.name, type: "main", index: 0 }]] },
    [buildDocumentIndex.name]: { main: [[{ node: indexDocument.name, type: "main", index: 0 }]] },
    [indexDocument.name]: { main: [[{ node: completionProgress.name, type: "main", index: 0 }]] },
    [completionProgress.name]: { main: [[{ node: markFinalStatus.name, type: "main", index: 0 }]] },
  };

  return {
    ...existing,
    name: RESUME_WORKFLOW_NAME,
    nodes,
    connections,
    settings: { ...(existing.settings || {}), executionOrder: "v1" },
  };
}

function patchMainWorkflow(mainWorkflow, resumeWorkflowId) {
  const names = new Set([
    "Resume Request Router",
    "Route Resume Request?",
    "Resume Add Progress",
    "Launch Resume Worker",
    "Format Resume Chat Response",
  ]);
  mainWorkflow.nodes = mainWorkflow.nodes.filter((node) => !names.has(node.name));
  for (const name of names) delete mainWorkflow.connections?.[name];

  const router = codeNode(
    "Resume Request Router",
    `const input = $input.first().json || {};
const chatInput = String(input.chatInput || input.message || input.request_message || '').trim();
const jobMatch = chatInput.match(/\\bjob_[a-z0-9]+_[a-z0-9]+\\b/i);
const resumeLike = /\\b(reprends|reprendre|relance|relancer|retry|recommence|continue|poursuis|resume)\\b/i.test(chatInput);
const resume_job_id = jobMatch ? jobMatch[0] : '';
const should_resume = Boolean(resume_job_id && resumeLike);
return [{ json: { ...input, should_resume, resume_job_id, resume_request: chatInput } }];`,
    [-900, -120],
  );
  const route = ifNode("Route Resume Request?", "={{ $json.should_resume }}", [-600, -120]);
  const addProgress = supabaseNode(
    "Resume Add Progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Resume Request Router').first().json.resume_job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Resume Request Router').first().json.project_slug || '' }}" },
      { fieldId: "status", fieldValue: "running" },
      { fieldId: "message", fieldValue: "Reprise ciblée demandée depuis le chat. Le worker va lire les checkpoints." },
      { fieldId: "percent_estimate", fieldValue: "5" },
      { fieldId: "current_phase", fieldValue: "resume_requested" },
      { fieldId: "active_agents", fieldValue: "={{ ['resume_worker'] }}" },
    ],
    [-300, -520],
    { node: { continueOnFail: true } },
  );
  const launch = {
    id: nodeId(),
    name: "Launch Resume Worker",
    type: "n8n-nodes-base.executeWorkflow",
    typeVersion: 1.2,
    position: [0, -520],
    parameters: {
      workflowId: { __rl: true, mode: "id", value: resumeWorkflowId, cachedResultName: RESUME_WORKFLOW_NAME },
      workflowInputs: {
        mappingMode: "defineBelow",
        value: {
          job_id: "={{ $('Resume Request Router').first().json.resume_job_id }}",
          project_slug: "={{ $('Resume Request Router').first().json.project_slug || '' }}",
          resume_request: "={{ $('Resume Request Router').first().json.resume_request }}",
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
    "Format Resume Chat Response",
    `const resume = $('Resume Request Router').first().json;
const output = [
  "Je reprends le chantier.",
  "",
  "Identifiant : **" + resume.resume_job_id + "**.",
  "",
  "Je vais relire les checkpoints agents, relancer seulement ce qui manque, puis recréer le livrable final."
].join('\\n');
return [{ json: { output, job_id: resume.resume_job_id, project_slug: resume.project_slug || '', status: 'running', is_safe_public_response: true } }];`,
    [300, -520],
  );

  mainWorkflow.nodes.push(router, route, addProgress, launch, format);
  mainWorkflow.connections = mainWorkflow.connections || {};
  mainWorkflow.connections["Quick Async Router"] = { main: [[{ node: router.name, type: "main", index: 0 }]] };
  mainWorkflow.connections[router.name] = { main: [[{ node: route.name, type: "main", index: 0 }]] };
  mainWorkflow.connections[route.name] = {
    main: [
      [{ node: addProgress.name, type: "main", index: 0 }],
      [{ node: "Route Status Request?", type: "main", index: 0 }],
    ],
  };
  mainWorkflow.connections[addProgress.name] = { main: [[{ node: launch.name, type: "main", index: 0 }]] };
  mainWorkflow.connections[launch.name] = { main: [[{ node: format.name, type: "main", index: 0 }]] };
  mainWorkflow.connections[format.name] = { main: [[{ node: "Public Response Leak Guard", type: "main", index: 0 }]] };

  return mainWorkflow;
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

  const mainWorkflow = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${MAIN_WORKFLOW_ID}`);
  const existingRef = await findWorkflowByName(baseUrl, apiKey, RESUME_WORKFLOW_NAME);
  let savedResume;
  if (existingRef?.id) {
    const existing = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${existingRef.id}`);
    savedResume = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${existingRef.id}`, {
      method: "PUT",
      body: JSON.stringify(workflowPayload(buildResumeWorkflow(mainWorkflow, existing))),
    });
  } else {
    savedResume = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows", {
      method: "POST",
      body: JSON.stringify(workflowPayload(buildResumeWorkflow(mainWorkflow))),
    });
  }
  const resumeId = savedResume.id || existingRef?.id;
  const patchedMain = patchMainWorkflow(mainWorkflow, resumeId);
  await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${MAIN_WORKFLOW_ID}`, {
    method: "PUT",
    body: JSON.stringify(workflowPayload(patchedMain)),
  });

  console.log(`resume_worker=${resumeId}`);
  console.log("resume_runtime=installed");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
