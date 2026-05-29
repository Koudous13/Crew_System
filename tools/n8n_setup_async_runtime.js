const fs = require("fs");
const crypto = require("crypto");

const MAIN_WORKFLOW_ID = "U3eGOTVq0DenA2pm";
const WORKER_WORKFLOW_ID = "7VRaCvaGkBQHFGAL";
const WORKER_WORKFLOW_NAME = "CS_ASYNC_JOB_WORKER";
const SUPABASE_CREDENTIAL = { id: "OMiEiywYcayYYI4W", name: "Supabase Crew System" };
const GOOGLE_DRIVE_CREDENTIAL = { id: "fXAOobHIOV39kLNd", name: "Google Drive Crew System" };
const AGENT_WORKFLOWS = {
  fileArchitect: { id: "gnw2DA536SBmH12K", name: "CS_AGENT_FILE_ARCHITECT" },
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

const PROJECT_STRUCTURE_FOLDERS = [
  { path: "brief", name: "brief", parent: "" },
  { path: "strategy", name: "strategy", parent: "" },
  { path: "calendar", name: "calendar", parent: "" },
  { path: "platforms", name: "platforms", parent: "" },
  { path: "creative", name: "creative", parent: "" },
  { path: "outputs", name: "outputs", parent: "" },
  { path: "performance", name: "performance", parent: "" },
  { path: "reviews", name: "reviews", parent: "" },
  { path: "memory", name: "memory", parent: "" },
  { path: "logs", name: "logs", parent: "" },
  { path: "archive", name: "archive", parent: "" },
  { path: "versions", name: "versions", parent: "" },
  { path: "brief/source_materials", name: "source_materials", parent: "brief" },
  { path: "brief/versions", name: "versions", parent: "brief" },
  { path: "strategy/versions", name: "versions", parent: "strategy" },
  { path: "calendar/campaign_calendars", name: "campaign_calendars", parent: "calendar" },
  { path: "calendar/versions", name: "versions", parent: "calendar" },
  { path: "platforms/versions", name: "versions", parent: "platforms" },
  { path: "creative/asset_briefs", name: "asset_briefs", parent: "creative" },
  { path: "outputs/campaign_packs", name: "campaign_packs", parent: "outputs" },
  { path: "outputs/batches", name: "batches", parent: "outputs" },
  { path: "outputs/revisions", name: "revisions", parent: "outputs" },
  { path: "outputs/exports", name: "exports", parent: "outputs" },
  { path: "outputs/visuals", name: "visuals", parent: "outputs" },
  { path: "performance/reports", name: "reports", parent: "performance" },
  { path: "performance/raw", name: "raw", parent: "performance" },
  { path: "reviews/quality_reviews", name: "quality_reviews", parent: "reviews" },
  { path: "logs/jobs", name: "jobs", parent: "logs" },
  { path: "archive/documents", name: "documents", parent: "archive" },
  { path: "archive/jobs", name: "jobs", parent: "archive" },
  { path: "archive/outputs", name: "outputs", parent: "archive" },
];

const PROJECT_INITIAL_FILE_NODE_NAMES = [
  "Setup Build initial project files",
  "Setup Create initial project files",
];

const AGENT_DOCUMENT_POLICIES = {
  file_architect: {
    role: "Architecture documentaire et structure projet.",
    read_files: [
      "README.md",
      "manifest.json",
      "brief/original_brief.md",
      "brief/normalized_brief.json",
      "brief/assumptions.md",
      "logs/decisions.md",
    ],
    required_reads: ["brief/original_brief.md", "brief/normalized_brief.json", "manifest.json"],
    write_files: ["logs/file_architecture.md"],
  },
  strategist: {
    role: "Diagnostic stratégique, positionnement et architecture d'influence.",
    read_files: [
      "README.md",
      "manifest.json",
      "brief/original_brief.md",
      "brief/normalized_brief.json",
      "brief/assumptions.md",
      "logs/decisions.md",
    ],
    read_prefixes: ["strategy/versions/"],
    required_reads: ["brief/normalized_brief.json"],
    write_files: [
      "strategy/strategic_diagnosis.md",
      "strategy/positioning.md",
      "strategy/influence_architecture.md",
    ],
  },
  audience_psychologist: {
    role: "Intelligence audience, douleurs, objections, langage et tensions humaines.",
    read_files: [
      "brief/normalized_brief.json",
      "strategy/positioning.md",
      "strategy/strategic_diagnosis.md",
      "logs/decisions.md",
    ],
    required_reads: ["brief/normalized_brief.json", "strategy/strategic_diagnosis.md"],
    write_files: ["strategy/audience_intelligence.md"],
  },
  growth_hacker: {
    role: "Boucles growth, amplification, conversion, DM, commentaires et experiments.",
    read_files: [
      "brief/normalized_brief.json",
      "strategy/positioning.md",
      "strategy/strategic_diagnosis.md",
      "strategy/audience_intelligence.md",
      "platforms/facebook_strategy.md",
      "platforms/linkedin_strategy.md",
      "calendar/annual_editorial_calendar.md",
      "logs/decisions.md",
    ],
    required_reads: ["strategy/strategic_diagnosis.md", "strategy/audience_intelligence.md"],
    write_files: ["strategy/growth_system.md"],
  },
  hook_master: {
    role: "Hooks, accroches, systèmes de messages et scroll-stoppers.",
    read_files: [
      "brief/normalized_brief.json",
      "strategy/strategic_diagnosis.md",
      "strategy/audience_intelligence.md",
      "strategy/growth_system.md",
      "calendar/annual_editorial_calendar.md",
      "logs/decisions.md",
    ],
    required_reads: ["strategy/audience_intelligence.md"],
    write_files: ["strategy/message_system.md"],
  },
  facebook_native_agent: {
    role: "Stratégie Facebook native : émotion, proximité, conversation et formats.",
    read_files: [
      "strategy/positioning.md",
      "strategy/strategic_diagnosis.md",
      "strategy/audience_intelligence.md",
      "strategy/growth_system.md",
      "strategy/message_system.md",
      "calendar/annual_editorial_calendar.md",
      "creative/visual_direction.md",
      "logs/decisions.md",
    ],
    required_reads: ["strategy/audience_intelligence.md", "strategy/growth_system.md"],
    write_files: ["platforms/facebook_strategy.md"],
  },
  linkedin_native_agent: {
    role: "Stratégie LinkedIn native : autorité, preuve, point de vue et conversion douce.",
    read_files: [
      "strategy/positioning.md",
      "strategy/strategic_diagnosis.md",
      "strategy/audience_intelligence.md",
      "strategy/growth_system.md",
      "strategy/message_system.md",
      "calendar/annual_editorial_calendar.md",
      "creative/visual_direction.md",
      "logs/decisions.md",
    ],
    required_reads: ["strategy/audience_intelligence.md", "strategy/growth_system.md"],
    write_files: ["platforms/linkedin_strategy.md"],
  },
  calendar_architect: {
    role: "Calendrier éditorial annuel, arcs de campagne et séquences longues.",
    read_files: [
      "strategy/strategic_diagnosis.md",
      "strategy/positioning.md",
      "strategy/audience_intelligence.md",
      "strategy/growth_system.md",
      "platforms/facebook_strategy.md",
      "platforms/linkedin_strategy.md",
      "creative/visual_direction.md",
      "logs/decisions.md",
    ],
    read_prefixes: ["outputs/campaign_packs/"],
    required_reads: ["strategy/audience_intelligence.md", "strategy/growth_system.md"],
    write_files: ["calendar/annual_editorial_calendar.md"],
    write_prefixes: ["calendar/campaign_calendars/"],
  },
  copywriter: {
    role: "Production finale de posts, captions, scripts et briefs associés.",
    read_files: [
      "strategy/strategic_diagnosis.md",
      "strategy/positioning.md",
      "strategy/audience_intelligence.md",
      "strategy/growth_system.md",
      "strategy/message_system.md",
      "calendar/annual_editorial_calendar.md",
      "platforms/facebook_strategy.md",
      "platforms/linkedin_strategy.md",
      "creative/visual_direction.md",
      "logs/decisions.md",
    ],
    read_prefixes: ["outputs/campaign_packs/"],
    required_reads: ["strategy/audience_intelligence.md", "calendar/annual_editorial_calendar.md"],
    write_prefixes: ["outputs/batches/"],
  },
  creative_director: {
    role: "Direction visuelle, vidéo, asset briefs et cohérence créative.",
    read_files: [
      "brief/normalized_brief.json",
      "strategy/strategic_diagnosis.md",
      "strategy/positioning.md",
      "strategy/audience_intelligence.md",
      "strategy/growth_system.md",
      "platforms/facebook_strategy.md",
      "platforms/linkedin_strategy.md",
      "calendar/annual_editorial_calendar.md",
      "logs/decisions.md",
    ],
    read_prefixes: ["brief/source_materials/", "outputs/batches/"],
    required_reads: ["strategy/audience_intelligence.md"],
    write_files: ["creative/visual_direction.md", "creative/video_strategy.md"],
    write_prefixes: ["creative/asset_briefs/"],
  },
};

for (const policy of Object.values(AGENT_DOCUMENT_POLICIES)) {
  policy.read_files = [
    "base_strategique_initiale.md",
    "base_strategique.md",
    ...(policy.read_files || []),
  ];
}

function projectStructureNodeName(path) {
  return `Setup Folder ${path.replace(/\//g, " - ")}`;
}

function workerProjectStructureNodeName(path) {
  return `Worker Folder ${path.replace(/\//g, " - ")}`;
}

function projectStructureNodeNames() {
  return PROJECT_STRUCTURE_FOLDERS.map((folder) => projectStructureNodeName(folder.path));
}

function workerProjectStructureNodeNames() {
  return PROJECT_STRUCTURE_FOLDERS.map((folder) => workerProjectStructureNodeName(folder.path));
}

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

function inferAgentIdFromRunNodeName(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("file architect")) return "file_architect";
  if (value.includes("strategist")) return "strategist";
  if (value.includes("audience")) return "audience_psychologist";
  if (value.includes("growth")) return "growth_hacker";
  if (value.includes("hook")) return "hook_master";
  if (value.includes("facebook")) return "facebook_native_agent";
  if (value.includes("linkedin")) return "linkedin_native_agent";
  if (value.includes("calendar")) return "calendar_architect";
  if (value.includes("copywriter")) return "copywriter";
  if (value.includes("creative")) return "creative_director";
  return "";
}

function agentWorkflowNode(name, agentWorkflow, position, expectedOutput, previousAgentOutputsExpression, explicitAgentId = "") {
  const policyAgentId = explicitAgentId || inferAgentIdFromRunNodeName(name);
  const contextSummaryExpression =
    `={{ (() => { try { const base = $('Build Project Context Package').first().json || {}; const scoped = (base.agent_contexts || {})[${JSON.stringify(policyAgentId)}] || {}; return scoped.summary || base.context_summary || $('Prepare Worker Input').first().json.context_summary || ''; } catch (error) { return $('Prepare Worker Input').first().json.context_summary || ''; } })() }}`;
  const documentWorkspaceExpression =
    `={{ (() => { try { const base = $('Build Project Context Package').first().json || {}; const scoped = (base.agent_contexts || {})[${JSON.stringify(policyAgentId)}] || {}; return scoped.document_workspace || ''; } catch (error) { return ''; } })() }}`;
  const constraintsExpression =
    `={{ (() => { const generic = 'Travail en francais. Intensite strategique forte, utile et defendable. Pas de spam, pas de promesses inventees, pas de JSON dans le livrable final.'; try { const policy = (($('Build Project Context Package').first().json.agent_tool_policies || {})[${JSON.stringify(policyAgentId)}]) || {}; const readable = [...(policy.read_files || []), ...(policy.read_prefixes || []).map((path) => path + '*')]; const writable = [...(policy.write_files || []), ...(policy.write_prefixes || []).map((path) => path + '*')]; return [generic, 'Politique outillage agent: lecture autorisee=' + readable.join(', '), 'ecriture autorisee=' + writable.join(', '), 'Lis d abord document_workspace quand il existe; appuie ton travail sur les fichiers autorises charges, pas seulement sur le resume.', 'Si un fichier requis manque, signale-le dans questions_for_director sans inventer.'].join('\\n'); } catch (error) { return generic; } })() }}`;
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
          context_summary: contextSummaryExpression,
          document_workspace: documentWorkspaceExpression,
          previous_agent_outputs: previousAgentOutputsExpression || "",
          platform_context: "Facebook, LinkedIn",
          constraints: constraintsExpression,
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

function agentCanonicalPayloadNode(name, agentId, sourceNodeName, folderPath, fileNameTemplate, documentType, documentTitle, position, includeKeys = []) {
  return codeNode(
    name,
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return { ok: false, error: error.message }; }
}
function pickPayload(value) {
  if (value && value.output && typeof value.output === 'object') return value.output;
  return value || {};
}
function clean(value) {
  return String(value || '').replace(/\\s+$/gm, '').trim();
}
function safe(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}
function titleize(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\\b\\w/g, (letter) => letter.toUpperCase());
}
function renderValue(value, level = 3) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') return '- ' + JSON.stringify(item, null, 2).replace(/\\n/g, '\\n  ');
        return '- ' + String(item);
      })
      .join('\\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, nested]) => nested !== null && nested !== undefined && nested !== '')
      .map(([nestedKey, nestedValue]) => '#'.repeat(Math.min(level, 5)) + ' ' + titleize(nestedKey) + '\\n\\n' + renderValue(nestedValue, level + 1))
      .join('\\n\\n');
  }
  return String(value);
}
function markdownFromPayload(title, agentId, payload, base) {
  const ignored = new Set(['status', 'format_valid', 'invalid_reasons', 'self_evaluation']);
  const preferredKeys = ${JSON.stringify(includeKeys)};
  const keys = preferredKeys.length
    ? [...new Set(['handoff_summary', ...preferredKeys, 'questions_for_director', 'risk_flags', 'downstream_instructions'])]
    : Object.keys(payload || {});
  const entries = keys.map((key) => [key, payload?.[key]]);
  const sections = entries
    .filter(([key, value]) => !ignored.has(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => '## ' + titleize(key) + '\\n\\n' + renderValue(value, 3))
    .filter((section) => section.trim());
  const header = [
    '# ' + title,
    '',
    '- Projet : ' + base.project_slug,
    '- Job : ' + base.job_id,
    '- Agent : ' + agentId,
    '- Généré le : ' + new Date().toISOString(),
    ''
  ].join('\\n');
  if (sections.length) return header + sections.join('\\n\\n');
  return header + '## Résultat\\n\\n' + clean(payload?.handoff_summary || payload?.summary || 'Aucun contenu exploitable retourné par cet agent.');
}
const base = (() => {
  try { return $('Worker Merge project structure context').first().json || {}; }
  catch (error) {}
  try { return $('Build Project Context Package').first().json || {}; }
  catch (error) { return $('Prepare Worker Input').first().json || {}; }
})();
const raw = readNode(${JSON.stringify(sourceNodeName)});
const payload = pickPayload(raw);
const registry = base.project_folder_registry || {};
const folderPath = ${JSON.stringify(folderPath)};
const configuredName = ${JSON.stringify(fileNameTemplate)};
const safeJob = safe(base.job_id || 'job_unknown');
const fileName = configuredName.replace('{job_id}', safeJob);
const folder_id = registry[folderPath] || registry[''] || base.project_folder_id || 'root';
const relative_path = (folderPath ? folderPath + '/' : '') + fileName;
const policies = base.agent_tool_policies || {};
const policy = policies[${JSON.stringify(agentId)}] || {};
function normalizePattern(pattern) {
  return String(pattern || '').replace('{job_id}', safeJob);
}
function writeAllowed(relativePath) {
  const files = (policy.write_files || []).map(normalizePattern);
  const prefixes = (policy.write_prefixes || []).map(normalizePattern);
  if (!files.length && !prefixes.length) return true;
  return files.includes(relativePath) || prefixes.some((prefix) => relativePath.startsWith(prefix));
}
if (!writeAllowed(relative_path)) {
  throw new Error('Agent writer blocked: ${agentId} cannot write ' + relative_path);
}
const path = 'projects/' + base.project_slug + '/' + relative_path;
const title = ${JSON.stringify(documentTitle)};
const content = markdownFromPayload(title, ${JSON.stringify(agentId)}, payload, base);
return [{ json: {
  document_id: 'document_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  artifact_id: 'artifact_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  project_slug: base.project_slug,
  job_id: base.job_id,
  agent_id: ${JSON.stringify(agentId)},
  storage_provider: 'google_drive',
  path,
  title,
  document_type: ${JSON.stringify(documentType)},
  status: 'ready_to_write',
  content_type: 'text/markdown',
  file_name: fileName,
  folder_id,
  content,
  metadata: {
    generated_by: 'agent_canonical_writer',
    agent_id: ${JSON.stringify(agentId)},
    agent_policy_applied: true,
    allowed_write_path: relative_path,
    source_node: ${JSON.stringify(sourceNodeName)},
    folder_path: folderPath,
    job_route: base.job_route || ''
  }
} }];`,
    position,
  );
}

function indexAgentCanonicalDocumentNode(name, payloadNodeName, driveNodeName, position) {
  return supabaseNode(
    name,
    "create",
    "crew_documents",
    [
      { fieldId: "document_id", fieldValue: `={{ $('${payloadNodeName}').first().json.document_id }}` },
      { fieldId: "project_slug", fieldValue: `={{ $('${payloadNodeName}').first().json.project_slug }}` },
      { fieldId: "job_id", fieldValue: `={{ $('${payloadNodeName}').first().json.job_id }}` },
      { fieldId: "artifact_id", fieldValue: `={{ $('${payloadNodeName}').first().json.artifact_id }}` },
      { fieldId: "storage_provider", fieldValue: "google_drive" },
      { fieldId: "path", fieldValue: `={{ $('${payloadNodeName}').first().json.path }}` },
      { fieldId: "title", fieldValue: `={{ $('${payloadNodeName}').first().json.title }}` },
      { fieldId: "document_type", fieldValue: `={{ $('${payloadNodeName}').first().json.document_type }}` },
      { fieldId: "status", fieldValue: "={{ ($json.id || $json.fileId || $json.file_id) ? 'ready' : 'saved_without_drive' }}" },
      { fieldId: "content_type", fieldValue: `={{ $('${payloadNodeName}').first().json.content_type }}` },
      { fieldId: "drive_file_id", fieldValue: "={{ $json.id || $json.fileId || $json.file_id || '' }}" },
      { fieldId: "drive_url", fieldValue: "={{ $json.webViewLink || $json.webContentLink || $json.url || (($json.id || $json.fileId || $json.file_id) ? 'https://drive.google.com/file/d/' + ($json.id || $json.fileId || $json.file_id) + '/view' : '') }}" },
      {
        fieldId: "metadata",
        fieldValue: `={{ { ...($('${payloadNodeName}').first().json.metadata || {}), folder_id: $('${payloadNodeName}').first().json.folder_id || '', drive_node: '${driveNodeName}' } }}`,
      },
    ],
    position,
    { node: { continueOnFail: true, retryOnFail: false } },
  );
}

function saveAgentCanonicalArtifactNode(name, payloadNodeName, position) {
  return supabaseNode(
    name,
    "create",
    "crew_artifacts",
    [
      { fieldId: "artifact_id", fieldValue: `={{ $('${payloadNodeName}').first().json.artifact_id }}` },
      { fieldId: "job_id", fieldValue: `={{ $('${payloadNodeName}').first().json.job_id }}` },
      { fieldId: "project_slug", fieldValue: `={{ $('${payloadNodeName}').first().json.project_slug }}` },
      { fieldId: "path", fieldValue: `={{ $('${payloadNodeName}').first().json.path }}` },
      { fieldId: "status", fieldValue: "ready" },
      { fieldId: "content_type", fieldValue: `={{ $('${payloadNodeName}').first().json.content_type }}` },
      { fieldId: "content", fieldValue: `={{ $('${payloadNodeName}').first().json.content }}` },
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
        mode: "id",
        value: "={{ $('Build Artifact And Completion Payload').first().json.folder_id || 'root' }}",
        cachedResultName: "Project folder",
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

function googleDriveCreateFolderNode(name, folderName, parentFolderExpression, position) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    position,
    parameters: {
      resource: "folder",
      name: folderName,
      driveId: {
        __rl: true,
        mode: "list",
        value: "My Drive",
        cachedResultName: "My Drive",
      },
      folderId: {
        __rl: true,
        mode: "id",
        value: parentFolderExpression,
        cachedResultName: "Parent folder",
      },
      options: { simplifyOutput: false },
    },
    credentials: { googleDriveOAuth2Api: GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
  };
}

function googleDriveCreateTextFromCurrentItemNode(name, position, fallbackFolderExpression = "'root'") {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    position,
    parameters: {
      resource: "file",
      operation: "createFromText",
      content: "={{ $json.content }}",
      name: "={{ $json.file_name }}",
      driveId: {
        __rl: true,
        mode: "list",
        value: "My Drive",
        cachedResultName: "My Drive",
      },
      folderId: {
        __rl: true,
        mode: "id",
        value: `={{ $json.folder_id || ${fallbackFolderExpression} }}`,
        cachedResultName: "Target folder",
      },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
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
function slugify(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90);
}
function shortText(value, limit = 220) {
  const text = clean(value).replace(/\\s+/g, ' ');
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}
const request_message = clean(query.request_message || query.user_request || query.message || query.chatInput || '');
const raw_project_slug = clean(query.project_slug || query.projectSlug || '');
const raw_project_name = clean(query.project_name || query.projectName || '');
const project_slug = raw_project_slug || slugify(raw_project_name);
const project_name = raw_project_name || (project_slug ? project_slug.replace(/_/g, ' ') : '');
const description = clean(query.project_description || query.description || (project_slug ? 'Projet ' + project_name + ' piloté par Crew_System.' : ''));
const job_type = clean(query.job_type || query.jobType || 'async_agentic_job');
const context_summary = clean(query.context_summary || query.context || '');
const expected_output = clean(query.expected_output || query.livrable || 'Livrable final en Markdown lisible, exploitable et sans JSON brut.');
const job_id = clean(query.job_id) || 'job_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10);
const queued_message = "J'ai lancé le chantier en arrière-plan. Les agents vont travailler proprement et le livrable sera sauvegardé dès qu'il est prêt.";
const should_start = Boolean(request_message && project_slug);
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
return [{ json: { ...query, job_id, project_slug, project_name, description, request_message, job_type, context_summary, expected_output, queued_message, worker_prompt, should_start, public_summary: shortText(request_message) } }];`,
    [260, 0],
  );
  const routeHasProject = ifNode("Route Async Tool Has Project?", "={{ $json.should_start }}", [520, 0]);
  const formatMissingProject = codeNode(
    "Format Missing Project Response",
    `return [{ json: {
  ok: false,
  tool: 'cs_async_start_job',
  status: 'needs_project',
  message: "Projet actif non identifié. Je ne lance pas de chantier long sans project_slug.",
  user_message: "Je dois d'abord savoir sur quel projet travailler. Donne-moi le nom ou le slug du projet, ou dis-moi que c'est un nouveau projet à créer.",
  next_step: "Identifier ou créer le projet actif avant de lancer le chantier."
} }];`,
    [560, 260],
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
    [820, 0],
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
    [1120, 0],
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
      { fieldId: "message", fieldValue: "={{ $('Prepare Async Job').first().json.job_type === 'strategic_base_builder' ? 'Projet créé. Le worker prépare la structure canonique et la base profonde.' : 'Chantier créé. Le worker agentique va prendre le relais.' }}" },
      { fieldId: "percent_estimate", fieldValue: "1" },
      { fieldId: "current_phase", fieldValue: "queued" },
      { fieldId: "active_agents", fieldValue: "={{ ['director_async_worker'] }}" },
    ],
    [1420, 0],
  );
  const launchWorker = {
    id: nodeId(),
    name: "Launch Async Worker",
    type: "n8n-nodes-base.executeWorkflow",
    typeVersion: 1.2,
    position: [1720, 0],
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
    [2020, 0],
  );

  return {
    nodes: [trigger, prepare, routeHasProject, formatMissingProject, ensureProject, createJob, addQueuedProgress, launchWorker, formatResponse],
    connections: {
      [trigger.name]: { main: [[{ node: prepare.name, type: "main", index: 0 }]] },
      [prepare.name]: { main: [[{ node: routeHasProject.name, type: "main", index: 0 }]] },
      [routeHasProject.name]: {
        main: [
          [{ node: ensureProject.name, type: "main", index: 0 }],
          [{ node: formatMissingProject.name, type: "main", index: 0 }],
        ],
      },
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
const project_slug = input.project_slug || 'project_unresolved';
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
          "Tu es le Worker asynchrone de Crew_System.\n\nTu ne discutes pas directement avec l'utilisateur. Tu exécutes un job déjà créé par le Directeur pour un projet actif précis.\n\nRègles strictes :\n1. Utilise le job_id et le project_slug fournis.\n2. Ne crée pas un nouveau job.\n3. N'invente jamais l'identité du porteur, la marque, la cible ou les plateformes : utilise seulement le contexte projet fourni ou lu dans Supabase/Google Drive.\n4. Appelle les sous-agents pertinents selon la demande.\n5. Tu peux utiliser Supabase pour lire contexte, décisions, documents et artifacts.\n6. Tu peux utiliser Google Drive si un document doit être créé ou lu.\n7. Retourne seulement un livrable final Markdown lisible, sans JSON brut, sans notes internes, sans brouillon.\n8. Ta sortie finale doit commencer directement par un titre Markdown de niveau 1, par exemple `# Chantier Stratégique...`.\n9. Si une information manque, produis quand même une première version utile et liste les questions restantes à la fin.\n10. Ne dis pas que tu as sauvegardé un document : la sauvegarde finale est faite par les nodes déterministes après ta sortie.",
      },
    },
  };
  const sanitizer = codeNode(
    "Worker Markdown Sanitizer",
    `let output = String($json.output || $json.text || $json.response || '').trim();
let base = {};
try { base = $('Build Worker Synthesis Prompt').first().json || {}; } catch (error) { base = {}; }
var request = String(base.request_message || '').toLowerCase();
var allowSimulation = /\\b(simul|ficti|invent|stress[- ]?test complet|offre fictive|donnees fictives|donn.e.s fictives)\\b/i.test(request);
var agentOutputs = base.agent_outputs && typeof base.agent_outputs === 'object' ? base.agent_outputs : {};
var needsContext = Object.values(agentOutputs).some((agent) => String(agent?.status || '').toLowerCase() === 'needs_context');
var looksSimulated = /(?:offre simul|cible prioritaire\\s*:\\s*operations managers|cadre strat.*mode stress-test|simulation de donn|donn.*inject|offre fictive|cible fictive)/i.test(output);
function bullets(values) {
  const flat = values.flat().filter(Boolean).map((value) => String(value).trim()).filter(Boolean);
  return flat.length ? flat.map((value) => '- ' + value).join('\\n') : '- Offre exacte.\\n- Cible prioritaire.\\n- Promesse centrale.\\n- Preuves disponibles.\\n- Contraintes de ton, plateformes, volume et calendrier.';
}
function safeMissingContextDocument() {
  const questions = Object.values(agentOutputs).map((agent) => Array.isArray(agent?.questions_for_director) ? agent.questions_for_director : []);
  const summaries = Object.entries(agentOutputs)
    .map(([agentId, agent]) => ({ agentId, summary: String(agent?.handoff_summary || '').trim(), status: String(agent?.status || '').trim() }))
    .filter((entry) => entry.summary);
  const lines = [
    '# Base stratégique - ' + (base.project_slug || 'projet'),
    '',
    '## Statut',
    'La structure documentaire du projet est prête, mais la matière stratégique réelle est insuffisante pour produire une base profonde fiable.',
    '',
    '## Ce qui est confirmé',
    '- Projet : ' + (base.project_slug || 'non renseigné'),
    '- Dossier documentaire : créé ou résolu.',
    '- Agents consultés : ' + (Array.isArray(base.agents_used) ? base.agents_used.join(', ') : Object.keys(agentOutputs).join(', ')),
    '',
    '## Synthèse des agents',
    ...(summaries.length ? summaries.map((entry) => '- ' + entry.agentId + ' (' + (entry.status || 'status inconnu') + ') : ' + entry.summary) : ['- Les agents demandent plus de contexte avant de produire une stratégie définitive.']),
    '',
    '## Informations manquantes',
    bullets(questions),
    '',
    '## Prochaine étape logique',
    'Donner les informations métier réelles du projet : offre, cible, promesse, preuves, modèle économique, contraintes de ton, plateformes visées et objectifs. Ensuite Crew_System pourra relancer les agents et produire une base stratégique profonde sans inventer de contexte.'
  ];
  return lines.join('\\n');
}
if (!allowSimulation && needsContext && looksSimulated) {
  output = safeMissingContextDocument();
}
const h1 = output.search(/(^|\\n)#\\s+/);
if (h1 > 0) {
  output = output.slice(h1).trim();
}
output = output
  .replace(/^\\*{3,}\\s*/g, '')
  .replace(/^(?:All agents have completed[\\s\\S]*?)(?=#\\s+)/i, '')
  .replace(/^(?:J'ai termin[eé][\\s\\S]*?)(?=#\\s+)/i, '')
  .trim();
var request = String(base.request_message || '').toLowerCase();
var allowSimulation = /\\b(simul|ficti|invent|stress[- ]?test complet|offre fictive|donnees fictives|donn.e.s fictives)\\b/i.test(request);
var agentOutputs = base.agent_outputs && typeof base.agent_outputs === 'object' ? base.agent_outputs : {};
var needsContext = Object.values(agentOutputs).some((agent) => String(agent?.status || '').toLowerCase() === 'needs_context');
var looksSimulated = /(?:offre simul|cible prioritaire\\s*:\\s*operations managers|cadre strat.*mode stress-test|simulation de donn|donn.*inject|offre fictive|cible fictive)/i.test(output);
function bullets(values) {
  const flat = values.flat().filter(Boolean).map((value) => String(value).trim()).filter(Boolean);
  return flat.length ? flat.map((value) => '- ' + value).join('\\n') : '- Offre exacte.\\n- Cible prioritaire.\\n- Promesse centrale.\\n- Preuves disponibles.\\n- Contraintes de ton, plateformes, volume et calendrier.';
}
function safeMissingContextDocument() {
  const questions = Object.values(agentOutputs).map((agent) => Array.isArray(agent?.questions_for_director) ? agent.questions_for_director : []);
  const summaries = Object.entries(agentOutputs)
    .map(([agentId, agent]) => ({ agentId, summary: String(agent?.handoff_summary || '').trim(), status: String(agent?.status || '').trim() }))
    .filter((entry) => entry.summary);
  const lines = [
    '# Base stratégique - ' + (base.project_slug || 'projet'),
    '',
    '## Statut',
    'La structure documentaire du projet est prête, mais la matière stratégique réelle est insuffisante pour produire une base profonde fiable.',
    '',
    '## Ce qui est confirmé',
    '- Projet : ' + (base.project_slug || 'non renseigné'),
    '- Dossier documentaire : créé ou résolu.',
    '- Agents consultés : ' + (Array.isArray(base.agents_used) ? base.agents_used.join(', ') : Object.keys(agentOutputs).join(', ')),
    '',
    '## Synthèse des agents',
    ...(summaries.length ? summaries.map((entry) => '- ' + entry.agentId + ' (' + (entry.status || 'status inconnu') + ') : ' + entry.summary) : ['- Les agents demandent plus de contexte avant de produire une stratégie définitive.']),
    '',
    '## Informations manquantes',
    bullets(questions),
    '',
    '## Prochaine étape logique',
    'Donner les informations métier réelles du projet : offre, cible, promesse, preuves, modèle économique, contraintes de ton, plateformes visées et objectifs. Ensuite Crew_System pourra relancer les agents et produire une base stratégique profonde sans inventer de contexte.'
  ];
  return lines.join('\\n');
}
if (!allowSimulation && needsContext && looksSimulated) {
  output = safeMissingContextDocument();
}
return [{ json: { output } }];`,
    [1020, 0],
  );
  const buildPayload = codeNode(
    "Build Artifact And Completion Payload",
    `const output = String($json.output || $json.public_candidate || $json.text || '').trim();
let base = {};
try { base = $('Prepare Worker Input').first().json || {}; } catch (error) { base = {}; }
const job_id = base.job_id || 'job_unknown';
const project_slug = base.project_slug || 'project_unresolved';
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
const project_slug = String(input.project_slug || '').trim();
if (!project_slug) {
  throw new Error('project_slug is required for async worker.');
}
const job_id = input.job_id || 'job_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10);
const request_message = input.request_message || input.chatInput || '';
const raw_job_type = input.job_type || 'async_agentic_job';
const context = input.context_summary || '';
const expected_output = input.expected_output || 'Livrable final Markdown lisible.';
function parseObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}
const project_folder_registry = parseObject(input.project_folder_registry);
const project_folder_urls = parseObject(input.project_folder_urls);
const normalized = [request_message, raw_job_type, expected_output].join(' ').toLowerCase();
const hasFacebook = /\\b(facebook|fb|meta)\\b/i.test(normalized);
const hasLinkedIn = /\\b(linkedin|linked ?in)\\b/i.test(normalized);
const noSpecificPlatform = !hasFacebook && !hasLinkedIn;
const wantsCalendar = /calendrier|editorial|éditorial|annuel|annuelle|sur 1 an|12 mois|52 semaines|arcs? de contenu|planning/i.test(normalized);
const wantsBatch = /\\b(batch|mini[- ]?batch|posts?|publications?|contenus?|semaine|30\\s+|70\\s+|scripts?|captions?)\\b/i.test(normalized)
  || /\\b(?:facebook|linkedin|linked ?in)\\b[\\s\\S]{0,80}\\b(?:posts?|publications?|contenus?)\\b/i.test(normalized)
  || /\\b(?:posts?|publications?|contenus?)\\b[\\s\\S]{0,80}\\b(?:facebook|linkedin|linked ?in)\\b/i.test(normalized);
const wantsVisual = /\\b(visuels?|images?|creatives?|créatives?|video|vidéo|briefs? visuels?)\\b/i.test(normalized);
const strategicBaseReference = /\\b(base strat[eé]gique)\\b[\\s\\S]{0,80}\\b(existante?|existants?|déjà|disponible|utilise(?:r)?|lis|lire|base-toi|basant|partir)\\b/i.test(normalized)
  || /\\b(utilise(?:r)?|lis|lire|base-toi|basant|partir)\\b[\\s\\S]{0,80}\\b(base strat[eé]gique)\\b/i.test(normalized);
const wantsStrategicBase = !strategicBaseReference && /base strat[eé]gique|strategic[_ -]?base|campaign pack|nouveau projet|nouvel espace|dossier drive|dossier google drive|espace de travail|structure projet/i.test(normalized);
const wantsPlatformWork = wantsCalendar || wantsBatch || hasFacebook || hasLinkedIn;
const fallback_job_route = wantsCalendar && !wantsBatch
  ? 'annual_calendar'
  : wantsBatch
    ? 'content_batch'
    : wantsVisual
      ? 'creative_batch'
      : wantsStrategicBase
        ? 'strategic_base_builder'
        : 'strategy_brief';
const canonicalJobTypes = new Set(['strategic_base_builder', 'annual_calendar', 'content_batch', 'creative_batch', 'strategy_brief']);
const job_route = canonicalJobTypes.has(raw_job_type) ? raw_job_type : fallback_job_route;
const job_type = job_route;
const should_run_file_architect = job_route === 'strategic_base_builder';
const should_run_strategist = true;
const should_run_audience = true;
const should_run_growth = true;
const should_run_hook_master = job_route === 'content_batch' || job_route === 'creative_batch';
const should_run_facebook_native = job_route !== 'strategic_base_builder' && wantsPlatformWork && (hasFacebook || noSpecificPlatform);
const should_run_linkedin_native = job_route !== 'strategic_base_builder' && wantsPlatformWork && (hasLinkedIn || noSpecificPlatform);
const should_run_calendar_architect = job_route === 'annual_calendar';
const should_run_copywriter = job_route === 'content_batch';
const should_run_creative_director = wantsVisual || job_route === 'content_batch' || job_route === 'creative_batch';
const agents_used = [
  should_run_file_architect ? 'file_architect' : null,
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
  'Projet actif: ' + project_slug + '.',
  'Ne suppose jamais l identite du porteur, la marque, la cible ou les plateformes.',
  'Utilise le contexte fourni, les documents du projet, les sorties agents et les donnees lues dans Supabase/Google Drive.',
  'Si une information strategique manque, produis une version utile puis liste les questions restantes.'
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
  should_run_file_architect,
  should_run_strategist,
  should_run_audience,
  should_run_growth,
  should_run_hook_master,
  should_run_facebook_native,
  should_run_linkedin_native,
  should_run_calendar_architect,
  should_run_copywriter,
  should_run_creative_director,
  project_folder_registry,
  project_folder_urls,
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
  const contextProgress = progressNode(
    "Progress Project Context Loader",
    14,
    "loading_context",
    "Le Context Loader lit le projet, les documents, les decisions et les anciens livrables utiles.",
    ["context_loader"],
    [680, 0],
  );
  const loadProjectContextProject = supabaseGetAllNode(
    "Context Load crew_projects",
    "crew_projects",
    1,
    "={{ 'project_slug=eq.' + $('Prepare Worker Input').first().json.project_slug }}",
    [980, -520],
  );
  const loadProjectContextDocuments = supabaseGetAllNode(
    "Context Load crew_documents",
    "crew_documents",
    15,
    "={{ 'project_slug=eq.' + $('Prepare Worker Input').first().json.project_slug }}",
    [980, -360],
  );
  const loadProjectContextArtifacts = supabaseGetAllNode(
    "Context Load crew_artifacts",
    "crew_artifacts",
    12,
    "={{ 'project_slug=eq.' + $('Prepare Worker Input').first().json.project_slug }}",
    [980, -200],
  );
  const loadProjectContextDecisions = supabaseGetAllNode(
    "Context Load crew_decisions",
    "crew_decisions",
    12,
    "={{ 'project_slug=eq.' + $('Prepare Worker Input').first().json.project_slug }}",
    [980, -40],
  );
  const loadProjectContextAgentRuns = supabaseGetAllNode(
    "Context Load crew_agent_runs",
    "crew_agent_runs",
    30,
    "={{ 'project_slug=eq.' + $('Prepare Worker Input').first().json.project_slug }}",
    [980, 120],
  );
  const loadProjectContextJobs = supabaseGetAllNode(
    "Context Load crew_jobs",
    "crew_jobs",
    150,
    "={{ 'project_slug=eq.' + $('Prepare Worker Input').first().json.project_slug }}",
    [980, 280],
  );
  const buildProjectContextPackage = codeNode(
    "Build Project Context Package",
    `function rowsFromNode(name) {
  try {
    return $(name).all().map((item) => item.json || {}).filter((row) => Object.keys(row).length > 0);
  } catch (error) {
    return [];
  }
}
function asTime(row) {
  return new Date(row.updated_at || row.completed_at || row.created_at || row.started_at || 0).getTime() || 0;
}
function sortRecent(rows) {
  return [...rows].sort((a, b) => asTime(b) - asTime(a));
}
function clip(value, limit = 1400) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '');
  const clean = text.replace(/\\s+/g, ' ').trim();
  return clean.length > limit ? clean.slice(0, limit - 1) + '…' : clean;
}
function clipBlock(value, limit = 7000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '', null, 2);
  const clean = text.replace(/\\r/g, '').replace(/\\n{4,}/g, '\\n\\n\\n').trim();
  return clean.length > limit ? clean.slice(0, limit - 1) + '\\n...' : clean;
}
function summarizeArtifact(row) {
  return {
    artifact_id: row.artifact_id || '',
    job_id: row.job_id || '',
    path: row.path || '',
    status: row.status || '',
    content_type: row.content_type || '',
    summary: clip(row.content || row.summary || row.assistant_message || '', 1800),
    updated_at: row.updated_at || row.created_at || ''
  };
}
function summarizeDocument(row) {
  return {
    document_id: row.document_id || '',
    title: row.title || row.path || 'Document',
    document_type: row.document_type || '',
    status: row.status || '',
    path: row.path || '',
    drive_url: row.drive_url || '',
    metadata: row.metadata || {},
    updated_at: row.updated_at || row.created_at || ''
  };
}
function summarizeDecision(row) {
  return {
    decision_id: row.decision_id || '',
    title: row.title || row.decision_type || 'Decision',
    summary: clip(row.summary || row.decision || row.content || row.reason || row.metadata || '', 900),
    created_at: row.created_at || ''
  };
}
function summarizeAgentRun(row) {
  return {
    agent_id: row.agent_id || '',
    status: row.status || '',
    output_summary: clip(row.output_summary || row.handoff?.handoff_summary || row.handoff || '', 1100),
    quality_score: row.quality_score ?? null,
    confidence_score: row.confidence_score ?? null,
    completed_at: row.completed_at || row.updated_at || row.created_at || ''
  };
}
function latestByAgent(rows) {
  const latest = {};
  for (const row of sortRecent(rows)) {
    const agentId = row.agent_id || '';
    if (!agentId || latest[agentId]) continue;
    latest[agentId] = summarizeAgentRun(row);
  }
  return latest;
}
const base = $('Prepare Worker Input').first().json || {};
const project = rowsFromNode('Context Load crew_projects')[0] || {};
const allDocumentRows = sortRecent(rowsFromNode('Context Load crew_documents'));
const allArtifactRows = sortRecent(rowsFromNode('Context Load crew_artifacts'));
const documents = allDocumentRows.slice(0, 30).map(summarizeDocument);
const artifacts = allArtifactRows.slice(0, 12).map(summarizeArtifact);
const decisions = sortRecent(rowsFromNode('Context Load crew_decisions')).slice(0, 8).map(summarizeDecision);
const agent_memory = latestByAgent(rowsFromNode('Context Load crew_agent_runs'));
const allJobRows = sortRecent(rowsFromNode('Context Load crew_jobs'));
const jobsById = {};
for (const row of allJobRows) {
  if (row.job_id) jobsById[row.job_id] = row;
}
function parseObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}
function normalizeId(value) {
  return String(value || '').trim();
}
function plainText(value) {
  return String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
}
function negatesProjectCreation(value) {
  const text = plainText(value);
  return /\\b(?:ne|n[' ]?)\\s*(?:me\\s+)?(?:cree|creer|creez)?\\s*pas\\s+(?:de\\s+)?(?:nouveau\\s+)?projet\\b/i.test(text)
    || /\\bsans\\s+(?:creer|creation\\s+(?:dun\\s+|de\\s+))?(?:de\\s+)?(?:nouveau\\s+)?projet\\b/i.test(text)
    || /\\b(?:ne|n[' ]?)\\s*(?:re)?initialise\\s*pas\\s+(?:le\\s+)?projet\\b/i.test(text);
}
function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
const baseRegistry = parseObject(base.project_folder_registry);
const baseUrls = parseObject(base.project_folder_urls);
const rootCandidates = [];
const invalidRootCandidates = [];
function addRootCandidate({ id, url = '', source, confidence, row = {}, registry = {}, urls = {} }) {
  const normalizedId = normalizeId(id);
  if (!normalizedId || normalizedId === 'root') return;
  const sourceJob = row.job_id ? jobsById[row.job_id] || {} : {};
  if (/^setup\\./.test(source) && negatesProjectCreation(sourceJob.request_message || row.request_message || '')) {
    invalidRootCandidates.push({
      id: normalizedId,
      source,
      reason: 'negated_project_creation_request',
      path: row.path || '',
      job_id: row.job_id || '',
      updated_at: row.updated_at || row.created_at || ''
    });
    return;
  }
  rootCandidates.push({
    id: normalizedId,
    url: normalizeId(url),
    source,
    confidence,
    path: row.path || '',
    document_type: row.document_type || '',
    title: row.title || row.path || '',
    updated_at: row.updated_at || row.created_at || '',
    time: asTime(row),
    registry: isObject(registry) ? registry : {},
    urls: isObject(urls) ? urls : {}
  });
}
if (normalizeId(base.project_folder_id)) {
  addRootCandidate({
    id: base.project_folder_id,
    source: 'input.project_folder_id',
    confidence: 100,
    registry: baseRegistry,
    urls: baseUrls
  });
}
if (normalizeId(baseRegistry[''])) {
  addRootCandidate({
    id: baseRegistry[''],
    url: baseUrls[''] || '',
    source: 'input.project_folder_registry',
    confidence: 100,
    registry: baseRegistry,
    urls: baseUrls
  });
}
for (const row of allDocumentRows) {
  const metadata = parseObject(row.metadata);
  const registry = parseObject(metadata.folder_registry);
  const urls = parseObject(metadata.folder_urls);
  const path = row.path || '';
  const generatedBy = String(metadata.generated_by || '').trim();
  const isSetupDocument = generatedBy === 'project_setup'
    || /base_strategique_initiale\\.md$/i.test(path);
  const isRootLevelDocument = /(^|\\/)(base_strategique(?:_initiale)?\\.md|README\\.md|manifest\\.json)$/i.test(path)
    || /^async_jobs\\/[^/]+\\/final\\.md$/i.test(path);
  if (normalizeId(registry[''])) {
    addRootCandidate({
      id: registry[''],
      url: urls[''] || metadata.folder_url || '',
      source: isSetupDocument ? 'setup.folder_registry' : 'document.folder_registry',
      confidence: isSetupDocument ? 95 : 70,
      row,
      registry,
      urls
    });
  }
  if (isSetupDocument && normalizeId(metadata.folder_id)) {
    addRootCandidate({
      id: metadata.folder_id,
      url: metadata.folder_url || '',
      source: 'setup.folder_id',
      confidence: 90,
      row,
      registry,
      urls
    });
  }
  if (!isSetupDocument && isRootLevelDocument && normalizeId(metadata.folder_id)) {
    addRootCandidate({
      id: metadata.folder_id,
      url: metadata.folder_url || '',
      source: 'document.root_folder_id',
      confidence: 80,
      row,
      registry,
      urls
    });
  }
}
rootCandidates.sort((a, b) => {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return a.time - b.time;
});
const canonicalRoot = rootCandidates[0]?.id || '';
const canonicalSource = rootCandidates[0] || {};
const distinctRoots = [...new Set(rootCandidates.map((candidate) => candidate.id))];
const folder_conflicts = distinctRoots.length > 1
  ? rootCandidates
      .filter((candidate, index, array) => array.findIndex((item) => item.id === candidate.id) === index)
      .map((candidate) => ({
        folder_id: candidate.id,
        source: candidate.source,
        confidence: candidate.confidence,
        path: candidate.path,
        updated_at: candidate.updated_at
      }))
  : [];
const folder_resolution_blocked = base.job_route !== 'strategic_base_builder' && (!canonicalRoot || folder_conflicts.length > 0);
const folder_registry = {};
const folder_urls = {};
function mergeRegistry(registry, urls) {
  if (isObject(registry)) Object.assign(folder_registry, registry);
  if (isObject(urls)) Object.assign(folder_urls, urls);
}
if (canonicalRoot) {
  for (const candidate of rootCandidates) {
    if (candidate.id === canonicalRoot) {
      mergeRegistry(candidate.registry, candidate.urls);
    }
  }
  folder_registry[''] = canonicalRoot;
  if (canonicalSource.url) folder_urls[''] = canonicalSource.url;
}
if (!canonicalRoot) {
  mergeRegistry(baseRegistry, baseUrls);
}
const recent_jobs = sortRecent(rowsFromNode('Context Load crew_jobs')).slice(0, 5).map((row) => ({
  job_id: row.job_id || '',
  status: row.status || '',
  current_phase: row.current_phase || '',
  request: clip(row.request_message || '', 500),
  updated_at: row.updated_at || row.completed_at || row.created_at || ''
}));
const missing_context = [];
if (!project.project_slug) missing_context.push('Projet non trouve dans crew_projects, utilisation du contexte stable.');
if (!documents.length) missing_context.push('Aucun document indexe trouve dans crew_documents.');
if (!artifacts.length) missing_context.push('Aucun ancien livrable exploitable trouve dans crew_artifacts.');
if (folder_conflicts.length) missing_context.push('Plusieurs dossiers Drive candidats detectes. Racine canonique retenue: ' + canonicalRoot + '.');
if (invalidRootCandidates.length) missing_context.push('Certains dossiers candidats ont ete ignores car ils proviennent de demandes qui interdisaient la creation d un nouveau projet.');
if (folder_resolution_blocked) missing_context.push('Resolution du dossier projet bloquee pour eviter une ecriture dans un mauvais dossier Drive.');
const AGENT_TOOL_POLICIES = ${JSON.stringify(AGENT_DOCUMENT_POLICIES)};
function relativeProjectPath(path) {
  const value = String(path || '').replace(/^\\/+/, '');
  const prefix = 'projects/' + base.project_slug + '/';
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
function matchesAnyPath(path, exactFiles = [], prefixes = []) {
  const relative = relativeProjectPath(path);
  return exactFiles.includes(relative) || prefixes.some((prefix) => relative.startsWith(prefix));
}
function buildReadableFileWorkspace(agentId, artifactRows, requiredReads, totalLimit = 36000, perFileLimit = 9000) {
  const files = [];
  let remaining = totalLimit;
  for (const row of artifactRows) {
    if (remaining <= 600) break;
    const relative = relativeProjectPath(row.path);
    const content = clipBlock(row.content || row.summary || row.assistant_message || '', Math.min(perFileLimit, remaining));
    if (!content) continue;
    remaining -= content.length;
    files.push({
      path: relative,
      source_path: row.path || '',
      artifact_id: row.artifact_id || '',
      job_id: row.job_id || '',
      status: row.status || '',
      content_type: row.content_type || '',
      content,
      truncated: content.endsWith('...'),
      updated_at: row.updated_at || row.created_at || ''
    });
  }
  const header = [
    '--- WORKSPACE DOCUMENTAIRE AUTORISE POUR ' + agentId + ' ---',
    'Lis ces fichiers comme ta base de travail. Utilise uniquement ce qui est ecrit ici ou dans les sorties agents precedentes.',
    'Si un fichier requis manque, signale-le dans questions_for_director au lieu d inventer.',
    requiredReads.length ? 'Fichiers requis par ta mission: ' + requiredReads.join(', ') : '',
    files.length ? 'Fichiers charges integralement ou avec coupe controlee: ' + files.map((file) => file.path).join(', ') : 'Aucun contenu de fichier autorise charge.'
  ].filter(Boolean).join('\\n');
  const body = files.map((file) => [
    '',
    '## Fichier: ' + file.path,
    file.truncated ? '_Note systeme: contenu coupe car trop long. Demande une lecture ciblee si le detail manque._' : '',
    '--- DEBUT CONTENU ---',
    file.content,
    '--- FIN CONTENU ---'
  ].filter(Boolean).join('\\n')).join('\\n');
  return {
    files,
    text: [header, body].filter(Boolean).join('\\n'),
    total_loaded_characters: files.reduce((sum, file) => sum + file.content.length, 0),
    total_files_loaded: files.length,
    total_limit: totalLimit,
    per_file_limit: perFileLimit
  };
}
function buildAgentContext(agentId, policy) {
  const readFiles = policy.read_files || [];
  const readPrefixes = policy.read_prefixes || [];
  const writable = [
    ...(policy.write_files || []),
    ...(policy.write_prefixes || []).map((path) => path + '*')
  ];
  const readableDocumentRows = allDocumentRows.filter((doc) => matchesAnyPath(doc.path, readFiles, readPrefixes)).slice(0, 40);
  const readableArtifactRows = allArtifactRows.filter((artifact) => matchesAnyPath(artifact.path, readFiles, readPrefixes)).slice(0, 24);
  const readableDocuments = readableDocumentRows.map(summarizeDocument);
  const readableArtifacts = readableArtifactRows.slice(0, 12).map(summarizeArtifact);
  const availablePaths = new Set([
    ...allDocumentRows.map((doc) => relativeProjectPath(doc.path)),
    ...allArtifactRows.map((artifact) => relativeProjectPath(artifact.path))
  ]);
  const setupGeneratedFiles = new Set([
    'README.md',
    'manifest.json',
    'brief/original_brief.md',
    'brief/normalized_brief.json',
    'brief/assumptions.md',
    'logs/decisions.md',
    'memory/brand_memory.md',
    'memory/audience_memory.md',
    'memory/decision_memory.md',
    'performance/learnings.md'
  ]);
  const missingRequiredReads = (policy.required_reads || []).filter((path) => {
    if (availablePaths.has(path)) return false;
    return !(base.job_route === 'strategic_base_builder' && setupGeneratedFiles.has(path));
  });
  const documentWorkspace = buildReadableFileWorkspace(agentId, readableArtifactRows, policy.required_reads || []);
  const setupGeneratedReadable = base.job_route === 'strategic_base_builder'
    ? [...setupGeneratedFiles].filter((path) => readFiles.includes(path))
    : [];
  const summary = [
    '--- CONTEXTE AUTORISE POUR ' + agentId + ' ---',
    'Role: ' + (policy.role || agentId),
    'Projet: ' + (project.project_name || base.project_slug) + ' (' + base.project_slug + ')',
    canonicalRoot ? 'Dossier Drive canonique: ' + canonicalRoot : '',
    'Lecture autorisee: ' + [...readFiles, ...readPrefixes.map((path) => path + '*')].join(', '),
    'Ecriture autorisee: ' + writable.join(', '),
    readableDocuments.length ? 'Documents autorises indexes:\\n' + readableDocuments.map((doc) => '- ' + doc.title + ' | ' + relativeProjectPath(doc.path) + ' | ' + (doc.drive_url || '')).join('\\n') : 'Documents autorises indexes: aucun document exact trouve.',
    setupGeneratedReadable.length ? 'Fichiers crees par le setup avant execution agent:\\n' + setupGeneratedReadable.map((path) => '- ' + path).join('\\n') : '',
    readableArtifacts.length ? 'Extraits autorises recents:\\n' + readableArtifacts.map((artifact) => '- ' + relativeProjectPath(artifact.path) + ' | ' + artifact.status + ' | ' + artifact.summary).join('\\n') : '',
    documentWorkspace.total_files_loaded ? 'Workspace documentaire charge: ' + documentWorkspace.total_files_loaded + ' fichier(s), ' + documentWorkspace.total_loaded_characters + ' caracteres disponibles pour lecture ciblee.' : 'Workspace documentaire charge: aucun contenu complet disponible.',
    missingRequiredReads.length ? 'Fichiers requis non indexes ou encore absents:\\n' + missingRequiredReads.map((path) => '- ' + path).join('\\n') : '',
    decisions.length ? 'Decisions recentes:\\n' + decisions.map((decision) => '- ' + decision.title + ' | ' + decision.summary).join('\\n') : '',
    agent_memory[agentId] ? 'Memoire recente de cet agent: ' + agent_memory[agentId].status + ' | ' + agent_memory[agentId].output_summary : '',
    'Demande utilisateur: ' + clip(base.request_message || '', 1400)
  ].filter(Boolean).join('\\n');
  return {
    agent_id: agentId,
    role: policy.role || '',
    read_files: readFiles,
    read_prefixes: readPrefixes,
    required_reads: policy.required_reads || [],
    write_files: policy.write_files || [],
    write_prefixes: policy.write_prefixes || [],
    readable_documents: readableDocuments,
    readable_artifacts: readableArtifacts,
    readable_files: documentWorkspace.files.map(({ content, ...file }) => ({ ...file, content_preview: clip(content, 700) })),
    document_workspace: documentWorkspace.text,
    document_workspace_stats: {
      total_files_loaded: documentWorkspace.total_files_loaded,
      total_loaded_characters: documentWorkspace.total_loaded_characters,
      total_limit: documentWorkspace.total_limit,
      per_file_limit: documentWorkspace.per_file_limit
    },
    missing_required_reads: missingRequiredReads,
    summary: clip(summary, 12000)
  };
}
const agent_contexts = Object.fromEntries(
  Object.entries(AGENT_TOOL_POLICIES).map(([agentId, policy]) => [agentId, buildAgentContext(agentId, policy)])
);
const project_context_package = {
  project: {
    project_slug: project.project_slug || base.project_slug,
    project_name: project.project_name || '',
    description: project.description || ''
  },
  loaded_at: new Date().toISOString(),
  job_route: base.job_route,
  source_counts: {
    documents: documents.length,
    artifacts: artifacts.length,
    decisions: decisions.length,
    agent_runs: Object.keys(agent_memory).length,
    recent_jobs: recent_jobs.length
  },
  documents,
  agent_contexts,
  agent_tool_policies: AGENT_TOOL_POLICIES,
  folder_registry,
  folder_urls,
  folder_root_resolution: {
    canonical_folder_id: canonicalRoot,
    canonical_source: canonicalSource.source || '',
    candidates: rootCandidates.slice(0, 8).map((candidate) => ({
      folder_id: candidate.id,
      source: candidate.source,
      confidence: candidate.confidence,
      path: candidate.path,
      updated_at: candidate.updated_at
    })),
    conflicts: folder_conflicts
  },
  invalid_root_candidates: invalidRootCandidates,
  folder_resolution_blocked,
  recent_artifacts: artifacts,
  recent_decisions: decisions,
  agent_memory,
  recent_jobs,
  missing_context
};
const contextLines = [
  base.context_summary || '',
  '',
  '--- CONTEXTE PROJET CHARGE AUTOMATIQUEMENT ---',
  'Projet: ' + (project.project_name || base.project_slug) + ' (' + base.project_slug + ')',
  project.description ? 'Description projet: ' + clip(project.description, 900) : '',
  canonicalRoot ? 'Dossier Drive canonique: ' + canonicalRoot + ' (' + (canonicalSource.source || 'source inconnue') + ')' : '',
  folder_conflicts.length ? 'Conflits de dossiers detectes:\\n' + folder_conflicts.map((item) => '- ' + item.folder_id + ' | ' + item.source + ' | ' + item.path).join('\\n') : '',
  invalidRootCandidates.length ? 'Dossiers candidats ignores:\\n' + invalidRootCandidates.map((item) => '- ' + item.id + ' | ' + item.reason + ' | ' + item.path).join('\\n') : '',
  documents.length ? 'Documents indexes utiles:\\n' + documents.map((doc) => '- ' + doc.title + ' | ' + doc.document_type + ' | ' + (doc.drive_url || doc.path)).join('\\n') : '',
  artifacts.length ? 'Anciens livrables recents:\\n' + artifacts.map((artifact) => '- ' + artifact.path + ' | ' + artifact.status + ' | ' + artifact.summary).join('\\n') : '',
  decisions.length ? 'Decisions recentes:\\n' + decisions.map((decision) => '- ' + decision.title + ' | ' + decision.summary).join('\\n') : '',
  Object.keys(agent_memory).length ? 'Memoire agents recente:\\n' + Object.values(agent_memory).map((run) => '- ' + run.agent_id + ' | ' + run.status + ' | ' + run.output_summary).join('\\n') : '',
  recent_jobs.length ? 'Derniers jobs projet:\\n' + recent_jobs.map((job) => '- ' + job.job_id + ' | ' + job.status + ' | ' + job.request).join('\\n') : '',
  missing_context.length ? 'Contexte manquant:\\n' + missing_context.map((item) => '- ' + item).join('\\n') : ''
].filter(Boolean).join('\\n');
return [{ json: {
  ...base,
  project_context_loaded: true,
  project_context_package,
  agent_contexts,
  agent_tool_policies: AGENT_TOOL_POLICIES,
  project_folder_registry: folder_registry,
  project_folder_urls: folder_urls,
  folder_root_conflicts: folder_conflicts,
  invalid_root_candidates: invalidRootCandidates,
  folder_resolution_blocked,
  project_folder_id: canonicalRoot || folder_registry[''] || '',
  context_summary: clip(contextLines, 16000)
} }];`,
    [1280, 0],
  );
  const routeFolderResolutionBlocked = ifNode(
    "Route Folder Resolution Blocked?",
    "={{ $('Build Project Context Package').first().json.folder_resolution_blocked === true }}",
    [1400, -760],
  );
  const markFolderResolutionFailed = supabaseNode(
    "Mark Folder Resolution Failed",
    "update",
    "crew_jobs",
    [
      { fieldId: "status", fieldValue: "failed" },
      { fieldId: "assistant_message", fieldValue: "={{ 'Je stoppe ce chantier pour protéger le projet : aucun dossier Drive canonique fiable n a été confirmé. Il faut d abord réparer ou choisir la racine projet avant de produire de nouveaux documents.' }}" },
      { fieldId: "error", fieldValue: "={{ 'Dossier projet non fiable: aucun dossier canonique valide confirme. Conflits=' + JSON.stringify($('Build Project Context Package').first().json.folder_root_conflicts || []) + ' Candidats_ignores=' + JSON.stringify($('Build Project Context Package').first().json.invalid_root_candidates || []) }}" },
      { fieldId: "percent_estimate", fieldValue: "100" },
      { fieldId: "current_phase", fieldValue: "folder_resolution_blocked" },
      { fieldId: "completed_at", fieldValue: "={{ new Date().toISOString() }}" },
    ],
    [1700, -860],
    { parameters: { filterType: "string", filterString: "={{ 'job_id=eq.' + $('Build Project Context Package').first().json.job_id }}" } },
  );
  const addFolderResolutionFailedProgress = supabaseNode(
    "Add Folder Resolution Failed Progress",
    "create",
    "crew_progress_events",
    [
      { fieldId: "event_id", fieldValue: "={{ 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10) }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Build Project Context Package').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Build Project Context Package').first().json.project_slug }}" },
      { fieldId: "status", fieldValue: "failed" },
      { fieldId: "message", fieldValue: "={{ 'Racine Drive non fiable. Le worker a stoppé le chantier pour éviter d écrire au mauvais endroit.' }}" },
      { fieldId: "percent_estimate", fieldValue: "100" },
      { fieldId: "current_phase", fieldValue: "folder_resolution_blocked" },
      { fieldId: "active_agents", fieldValue: "={{ [] }}" },
    ],
    [2000, -860],
  );
  const routeEnsureProjectStructure = ifNode(
    "Route Ensure Project Structure?",
    "={{ $('Build Project Context Package').first().json.job_route === 'strategic_base_builder' && !(($('Build Project Context Package').first().json.project_folder_registry || {}).strategy) }}",
    [1400, -520],
  );
  const workerStructureFolderNodes = PROJECT_STRUCTURE_FOLDERS.map((folder, index) => {
    const parentExpression = folder.parent
      ? `={{ $('${workerProjectStructureNodeName(folder.parent)}').first().json.id || $('${workerProjectStructureNodeName(folder.parent)}').first().json.fileId || $('${workerProjectStructureNodeName(folder.parent)}').first().json.file_id || $('Build Project Context Package').first().json.project_folder_id || 'root' }}`
      : "={{ $('Build Project Context Package').first().json.project_folder_id || 'root' }}";
    return googleDriveCreateFolderNode(
      workerProjectStructureNodeName(folder.path),
      folder.name,
      parentExpression,
      [1660 + (index % 4) * 300, -760 + Math.floor(index / 4) * 150],
    );
  });
  const workerStructureRegistryEntries = PROJECT_STRUCTURE_FOLDERS.map((folder) => ({
    path: folder.path,
    node: workerProjectStructureNodeName(folder.path),
  }));
  const workerBuildStructureRegistry = codeNode(
    "Worker Build project structure registry",
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return {}; }
}
function idFrom(node) {
  return node.id || node.fileId || node.file_id || '';
}
function urlFrom(node, id) {
  return node.webViewLink || node.webContentLink || node.url || (id ? 'https://drive.google.com/drive/folders/' + id : '');
}
const base = $('Build Project Context Package').first().json || {};
const rootId = base.project_folder_id || (base.project_folder_registry || {})[''] || '';
const rootUrl = (base.project_folder_urls || {})[''] || (rootId ? 'https://drive.google.com/drive/folders/' + rootId : '');
const entries = ${JSON.stringify(workerStructureRegistryEntries)};
const folders = { ...(base.project_folder_registry || {}), '': rootId };
const folder_urls = { ...(base.project_folder_urls || {}), '': rootUrl };
for (const entry of entries) {
  const node = readNode(entry.node);
  const folderId = idFrom(node);
  if (folderId) {
    folders[entry.path] = folderId;
    folder_urls[entry.path] = urlFrom(node, folderId);
  }
}
return [{ json: {
  ...base,
  project_folder_id: rootId,
  project_folder_url: rootUrl,
  folders,
  folder_urls,
  created_at: new Date().toISOString()
} }];`,
    [2920, -520],
  );
  const workerBuildInitialFiles = codeNode(
    "Worker Build initial project files",
    `const base = $('Worker Build project structure registry').first().json || {};
const folders = base.folders || {};
const rootId = base.project_folder_id || folders[''] || 'root';
function folderId(path) {
  return folders[path] || rootId;
}
function clean(value) {
  return String(value || '').trim();
}
const now = new Date().toISOString();
const projectName = clean(base.project_context_package?.project?.project_name) || clean(base.project_slug);
const projectSlug = clean(base.project_slug);
const request = clean(base.request_message) || 'Non renseignée.';
const files = [
  {
    path: 'README.md',
    file_name: 'README.md',
    folder_id: folderId(''),
    document_type: 'project_readme',
    content: ['# ' + projectName, '', 'Espace de travail Crew_System pour le projet ' + projectSlug + '.', '', '## Demande initiale', request, '', '## Structure', 'Le worker a créé l’arborescence canonique du projet en arrière-plan.', '', '## Prochaine étape logique', 'Enrichir la base stratégique avec les preuves, offres, cibles et contraintes réelles.'].join('\\n')
  },
  {
    path: 'manifest.json',
    file_name: 'manifest.json',
    folder_id: folderId(''),
    document_type: 'project_manifest',
    content: JSON.stringify({ schema_version: '1.0', project_slug: projectSlug, project_name: projectName, status: 'active', created_at: now, folders: Object.keys(folders).sort() }, null, 2)
  },
  {
    path: 'brief/original_brief.md',
    file_name: 'original_brief.md',
    folder_id: folderId('brief'),
    document_type: 'original_brief',
    content: ['# Brief Original', '', request].join('\\n')
  },
  {
    path: 'brief/assumptions.md',
    file_name: 'assumptions.md',
    folder_id: folderId('brief'),
    document_type: 'assumptions',
    content: ['# Hypotheses De Depart', '', '- Les informations encore absentes devront etre confirmees avant les productions sensibles.', '- Les agents doivent produire une version utile sans inventer les preuves, prix, resultats ou contraintes inconnues.'].join('\\n')
  },
  {
    path: 'brief/normalized_brief.json',
    file_name: 'normalized_brief.json',
    folder_id: folderId('brief'),
    document_type: 'normalized_brief',
    content: JSON.stringify({ project_slug: projectSlug, project_name: projectName, request, created_at: now }, null, 2)
  },
  {
    path: 'logs/decisions.md',
    file_name: 'decisions.md',
    folder_id: folderId('logs'),
    document_type: 'decision_log',
    content: ['# Journal Des Décisions', '', '- ' + now + ' : création asynchrone de la structure canonique du projet.'].join('\\n')
  },
  {
    path: 'memory/brand_memory.md',
    file_name: 'brand_memory.md',
    folder_id: folderId('memory'),
    document_type: 'brand_memory',
    content: ['# Mémoire De Marque', '', 'À compléter avec le ton, les offres, les preuves et les contraintes du projet.'].join('\\n')
  },
  {
    path: 'memory/audience_memory.md',
    file_name: 'audience_memory.md',
    folder_id: folderId('memory'),
    document_type: 'audience_memory',
    content: ['# Mémoire Audience', '', 'À enrichir avec les douleurs, objections, désirs, mots exacts et segments.'].join('\\n')
  },
  {
    path: 'memory/decision_memory.md',
    file_name: 'decision_memory.md',
    folder_id: folderId('memory'),
    document_type: 'decision_memory',
    content: ['# Memoire Des Decisions', '', 'Les choix strategiques importants seront resumes ici pour eviter de refaire les memes arbitrages.'].join('\\n')
  },
  {
    path: 'performance/learnings.md',
    file_name: 'learnings.md',
    folder_id: folderId('performance'),
    document_type: 'performance_learnings',
    content: ['# Apprentissages Performance', '', 'Les retours terrain, signaux de contenus et lecons de campagnes seront consolides ici.'].join('\\n')
  }
];
return files.map((file) => ({ json: {
  ...file,
  project_slug: projectSlug,
  job_id: base.job_id,
  content_type: file.file_name.endsWith('.json') ? 'application/json' : 'text/markdown'
} }));`,
    [3220, -520],
  );
  const workerCreateInitialFiles = googleDriveCreateTextFromCurrentItemNode(
    "Worker Create initial project files",
    [3520, -520],
    "($('Worker Build project structure registry').first().json.project_folder_id || 'root')",
  );
  const workerMergeStructureContext = codeNode(
    "Worker Merge project structure context",
    `const base = $('Build Project Context Package').first().json || {};
let registry = {};
try { registry = $('Worker Build project structure registry').first().json || {}; } catch (error) { registry = {}; }
const folders = registry.folders || base.project_folder_registry || {};
const folder_urls = registry.folder_urls || base.project_folder_urls || {};
return [{ json: {
  ...base,
  project_folder_registry: folders,
  project_folder_urls: folder_urls,
  project_folder_id: registry.project_folder_id || base.project_folder_id || folders[''] || '',
  context_summary: [
    base.context_summary || '',
    Object.keys(folders).length ? 'Structure canonique Drive disponible: ' + Object.keys(folders).sort().join(', ') : ''
  ].filter(Boolean).join('\\n')
} }];`,
    [3820, -520],
  );
  const routeFileArchitect = ifNode(
    "Route File Architect?",
    "={{ $('Prepare Worker Input').first().json.should_run_file_architect }}",
    [1400, -260],
  );
  const fileArchitectProgress = progressNode(
    "Progress File Architect Started",
    18,
    "file_architect",
    "Agent File Architect en cours : structure du projet, dossier, documents lisibles et contrat de base stratégique.",
    ["file_architect"],
    [1520, -220],
  );
  const runFileArchitect = agentWorkflowNode(
    "Run File Architect Agent",
    AGENT_WORKFLOWS.fileArchitect,
    [1820, -220],
    "Architecture documentaire du projet : base stratégique, dossiers, fichiers Markdown, index, règles de nommage, versioning et informations manquantes.",
    "={{ JSON.stringify({ project_context: $('Build Project Context Package').first().json.project_context_package || {} }) }}",
  );
  const checkpointFileArchitect = agentCheckpointNode(
    "Checkpoint File Architect Agent Run",
    "file_architect",
    "Run File Architect Agent",
    [1960, -40],
  );
  const saveFileArchitectRun = saveAgentRunNode("Save File Architect Agent Run", [2120, -40]);
  const fileArchitectCanonicalPayload = agentCanonicalPayloadNode(
    "Build File Architect Canonical Document",
    "file_architect",
    "Run File Architect Agent",
    "logs",
    "file_architecture.md",
    "project_file_plan",
    "Architecture Documentaire",
    [2280, -40],
    ["project_file_plan", "folder_structure", "documents_to_create", "versioning_rules", "missing_information"],
  );
  const fileArchitectCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save File Architect Canonical Artifact",
    "Build File Architect Canonical Document",
    [2360, -40],
  );
  const fileArchitectCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create File Architect Canonical Markdown",
    [2440, -40],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const fileArchitectCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index File Architect Canonical Document",
    "Build File Architect Canonical Document",
    "Create File Architect Canonical Markdown",
    [2600, -40],
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
    "={{ JSON.stringify({ project_context: $('Build Project Context Package').first().json.project_context_package || {}, file_architect: $('Prepare Worker Input').first().json.should_run_file_architect ? ($('Run File Architect Agent').first().json.output || $('Run File Architect Agent').first().json) : null }) }}",
  );
  const checkpointStrategist = agentCheckpointNode(
    "Checkpoint Strategist Agent Run",
    "strategist",
    "Run Strategist Agent",
    [1120, 220],
  );
  const saveStrategistRun = saveAgentRunNode("Save Strategist Agent Run", [1280, 220]);
  const strategistCanonicalPayload = agentCanonicalPayloadNode(
    "Build Strategist Canonical Document",
    "strategist",
    "Run Strategist Agent",
    "strategy",
    "strategic_diagnosis.md",
    "strategic_diagnosis",
    "Diagnostic Stratégique",
    [1440, 220],
    ["strategic_diagnosis", "hidden_problem", "perception_to_change", "decision_to_trigger", "strongest_leverage", "big_idea_seed"],
  );
  const strategistCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Strategist Canonical Artifact",
    "Build Strategist Canonical Document",
    [1520, 220],
  );
  const strategistCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Strategist Canonical Markdown",
    [1600, 220],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const strategistCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Strategist Canonical Document",
    "Build Strategist Canonical Document",
    "Create Strategist Canonical Markdown",
    [1760, 220],
  );
  const positioningCanonicalPayload = agentCanonicalPayloadNode(
    "Build Positioning Canonical Document",
    "strategist",
    "Run Strategist Agent",
    "strategy",
    "positioning.md",
    "positioning",
    "Positionnement",
    [1840, 220],
    ["positioning", "strategic_diagnosis", "perception_to_change", "decision_to_trigger", "big_idea_seed", "strongest_leverage"],
  );
  const positioningCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Positioning Canonical Artifact",
    "Build Positioning Canonical Document",
    [1920, 220],
  );
  const positioningCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Positioning Canonical Markdown",
    [2000, 220],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const positioningCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Positioning Canonical Document",
    "Build Positioning Canonical Document",
    "Create Positioning Canonical Markdown",
    [2160, 220],
  );
  const influenceCanonicalPayload = agentCanonicalPayloadNode(
    "Build Influence Canonical Document",
    "strategist",
    "Run Strategist Agent",
    "strategy",
    "influence_architecture.md",
    "influence_architecture",
    "Architecture D'Influence",
    [2240, 220],
    ["influence_architecture", "hidden_problem", "perception_to_change", "decision_to_trigger", "intensity_preservation", "downstream_instructions"],
  );
  const influenceCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Influence Canonical Artifact",
    "Build Influence Canonical Document",
    [2320, 220],
  );
  const influenceCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Influence Canonical Markdown",
    [2400, 220],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const influenceCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Influence Canonical Document",
    "Build Influence Canonical Document",
    "Create Influence Canonical Markdown",
    [2560, 220],
  );
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
    "={{ JSON.stringify({ file_architect: $('Prepare Worker Input').first().json.should_run_file_architect ? ($('Run File Architect Agent').first().json.output || $('Run File Architect Agent').first().json) : null, strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json }) }}",
  );
  const checkpointAudience = agentCheckpointNode(
    "Checkpoint Audience Agent Run",
    "audience_psychologist",
    "Run Audience Psychologist Agent",
    [1720, 220],
  );
  const saveAudienceRun = saveAgentRunNode("Save Audience Agent Run", [1880, 220]);
  const audienceCanonicalPayload = agentCanonicalPayloadNode(
    "Build Audience Canonical Document",
    "audience_psychologist",
    "Run Audience Psychologist Agent",
    "strategy",
    "audience_intelligence.md",
    "audience_intelligence",
    "Intelligence Audience",
    [2040, 220],
  );
  const audienceCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Audience Canonical Artifact",
    "Build Audience Canonical Document",
    [2120, 220],
  );
  const audienceCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Audience Canonical Markdown",
    [2200, 220],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const audienceCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Audience Canonical Document",
    "Build Audience Canonical Document",
    "Create Audience Canonical Markdown",
    [2360, 220],
  );
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
    "={{ JSON.stringify({ file_architect: $('Prepare Worker Input').first().json.should_run_file_architect ? ($('Run File Architect Agent').first().json.output || $('Run File Architect Agent').first().json) : null, strategist: $('Run Strategist Agent').first().json.output || $('Run Strategist Agent').first().json, audience: $('Run Audience Psychologist Agent').first().json.output || $('Run Audience Psychologist Agent').first().json }) }}",
  );
  const checkpointGrowth = agentCheckpointNode(
    "Checkpoint Growth Agent Run",
    "growth_hacker",
    "Run Growth Hacker Agent",
    [2320, 220],
  );
  const saveGrowthRun = saveAgentRunNode("Save Growth Agent Run", [2480, 220]);
  const growthCanonicalPayload = agentCanonicalPayloadNode(
    "Build Growth Canonical Document",
    "growth_hacker",
    "Run Growth Hacker Agent",
    "strategy",
    "growth_system.md",
    "growth_system",
    "Système Growth",
    [2640, 220],
  );
  const growthCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Growth Canonical Artifact",
    "Build Growth Canonical Document",
    [2720, 220],
  );
  const growthCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Growth Canonical Markdown",
    [2800, 220],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const growthCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Growth Canonical Document",
    "Build Growth Canonical Document",
    "Create Growth Canonical Markdown",
    [2960, 220],
  );
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
  const hooksCanonicalPayload = agentCanonicalPayloadNode(
    "Build Hook Canonical Document",
    "hook_master",
    "Run Hook Master Agent",
    "strategy",
    "message_system.md",
    "message_system",
    "Système De Messages Et Hooks",
    [3240, 220],
  );
  const hooksCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Hook Canonical Artifact",
    "Build Hook Canonical Document",
    [3320, 220],
  );
  const hooksCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Hook Canonical Markdown",
    [3400, 220],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const hooksCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Hook Canonical Document",
    "Build Hook Canonical Document",
    "Create Hook Canonical Markdown",
    [3560, 220],
  );
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
  const facebookCanonicalPayload = agentCanonicalPayloadNode(
    "Build Facebook Canonical Document",
    "facebook_native_agent",
    "Run Facebook Native Agent",
    "platforms",
    "facebook_strategy.md",
    "facebook_strategy",
    "Stratégie Facebook",
    [4280, -40],
  );
  const facebookCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Facebook Canonical Artifact",
    "Build Facebook Canonical Document",
    [4360, -40],
  );
  const facebookCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Facebook Canonical Markdown",
    [4440, -40],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const facebookCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Facebook Canonical Document",
    "Build Facebook Canonical Document",
    "Create Facebook Canonical Markdown",
    [4600, -40],
  );
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
  const linkedinCanonicalPayload = agentCanonicalPayloadNode(
    "Build LinkedIn Canonical Document",
    "linkedin_native_agent",
    "Run LinkedIn Native Agent",
    "platforms",
    "linkedin_strategy.md",
    "linkedin_strategy",
    "Stratégie LinkedIn",
    [5320, -40],
  );
  const linkedinCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save LinkedIn Canonical Artifact",
    "Build LinkedIn Canonical Document",
    [5400, -40],
  );
  const linkedinCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create LinkedIn Canonical Markdown",
    [5480, -40],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const linkedinCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index LinkedIn Canonical Document",
    "Build LinkedIn Canonical Document",
    "Create LinkedIn Canonical Markdown",
    [5640, -40],
  );
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
  const calendarCanonicalPayload = agentCanonicalPayloadNode(
    "Build Calendar Canonical Document",
    "calendar_architect",
    "Run Calendar Architect Agent",
    "calendar",
    "annual_editorial_calendar.md",
    "annual_editorial_calendar",
    "Calendrier Éditorial Annuel",
    [6360, -40],
  );
  const calendarCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Calendar Canonical Artifact",
    "Build Calendar Canonical Document",
    [6440, -40],
  );
  const calendarCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Calendar Canonical Markdown",
    [6520, -40],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const calendarCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Calendar Canonical Document",
    "Build Calendar Canonical Document",
    "Create Calendar Canonical Markdown",
    [6680, -40],
  );
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
  const copywriterCanonicalPayload = agentCanonicalPayloadNode(
    "Build Copywriter Canonical Document",
    "copywriter",
    "Run Copywriter Agent",
    "outputs/batches",
    "{job_id}_content_batch.md",
    "content_batch",
    "Batch De Contenus",
    [7400, -40],
  );
  const copywriterCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Copywriter Canonical Artifact",
    "Build Copywriter Canonical Document",
    [7480, -40],
  );
  const copywriterCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Copywriter Canonical Markdown",
    [7560, -40],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const copywriterCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Copywriter Canonical Document",
    "Build Copywriter Canonical Document",
    "Create Copywriter Canonical Markdown",
    [7720, -40],
  );
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
  const creativeCanonicalPayload = agentCanonicalPayloadNode(
    "Build Creative Canonical Document",
    "creative_director",
    "Run Creative Director Agent",
    "creative",
    "visual_direction.md",
    "visual_direction",
    "Direction Visuelle",
    [8440, -40],
  );
  const creativeCanonicalArtifact = saveAgentCanonicalArtifactNode(
    "Save Creative Canonical Artifact",
    "Build Creative Canonical Document",
    [8520, -40],
  );
  const creativeCanonicalDrive = googleDriveCreateTextFromCurrentItemNode(
    "Create Creative Canonical Markdown",
    [8600, -40],
    "($('Prepare Worker Input').first().json.project_folder_id || 'root')",
  );
  const creativeCanonicalIndex = indexAgentCanonicalDocumentNode(
    "Index Creative Canonical Document",
    "Build Creative Canonical Document",
    "Create Creative Canonical Markdown",
    [8760, -40],
  );
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
const base = (() => {
  try { return $('Worker Merge project structure context').first().json || {}; }
  catch (error) {}
  try { return $('Build Project Context Package').first().json || {}; }
  catch (error) { return $('Prepare Worker Input').first().json || {}; }
})();
const agent_outputs = {
  file_architect: base.should_run_file_architect ? pickAgentPayload(readNode('Run File Architect Agent')) : null,
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
  '- Integre uniquement les agents appeles pour cette route : architecture documentaire, strategie, psychologie audience, growth, plateformes, calendrier, copywriting et/ou direction creative selon le besoin.',
  '- Si la route est strategic_base_builder, produis une base strategique profonde : identite du projet, positionnement, cible, tensions psychologiques, promesse, offre, preuves, piliers de contenu, boucles growth, documents a maintenir, risques, informations manquantes et prochaine etape logique.',
  '- N invente jamais une offre, une cible, une promesse, des preuves, un marche, une marque ou un contexte metier si l utilisateur ne les a pas fournis explicitement.',
  '- N active jamais une simulation de donnees, une offre fictive ou un stress-test metier sauf si la demande utilisateur le demande clairement.',
  '- Si les sous-agents indiquent needs_context ou demandent des informations, respecte ce signal : produis une base de cadrage/structure, liste les inconnues, puis guide la prochaine question au lieu de combler par invention.',
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
          "Tu es le Directeur worker de Crew_System. Les sous-agents ont déjà été exécutés par des nodes déterministes. Tu ne dois pas inventer leurs sorties ni appeler des sous-agents. Tu ne dois jamais inventer une offre, une cible, une promesse, des preuves, un marché ou un contexte métier si l'utilisateur ne les a pas fournis. Si les agents signalent needs_context, tu dois respecter ce manque et poser les prochaines questions au lieu de simuler. Ton rôle est de consolider leurs résultats en un document final Markdown lisible, stratégique et exploitable. Tu peux utiliser Supabase ou Google Drive seulement si tu dois vérifier un contexte, mais tu ne dois pas créer le fichier final : un node déterministe le fera. Sortie stricte : Markdown public uniquement, commence par un titre H1, aucun JSON brut, aucune note interne, aucune trace technique.",
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
    `let output = String($json.output || $json.public_candidate || $json.text || '').trim();
let base = {};
try { base = $('Build Worker Synthesis Prompt').first().json || {}; } catch (error) { base = {}; }
var request = String(base.request_message || '').toLowerCase();
var allowSimulation = /\\b(simul|ficti|invent|stress[- ]?test complet|offre fictive|donnees fictives|donn.e.s fictives)\\b/i.test(request);
var agentOutputs = base.agent_outputs && typeof base.agent_outputs === 'object' ? base.agent_outputs : {};
var needsContext = Object.values(agentOutputs).some((agent) => String(agent?.status || '').toLowerCase() === 'needs_context');
var looksSimulated = /(?:offre simul|cible prioritaire\\s*:\\s*operations managers|cadre strat.*mode stress-test|simulation de donn|donn.*inject|offre fictive|cible fictive)/i.test(output);
function bullets(values) {
  const flat = values.flat().filter(Boolean).map((value) => String(value).trim()).filter(Boolean);
  return flat.length ? flat.map((value) => '- ' + value).join('\\n') : '- Offre exacte.\\n- Cible prioritaire.\\n- Promesse centrale.\\n- Preuves disponibles.\\n- Contraintes de ton, plateformes, volume et calendrier.';
}
function safeMissingContextDocument() {
  const questions = Object.values(agentOutputs).map((agent) => Array.isArray(agent?.questions_for_director) ? agent.questions_for_director : []);
  const summaries = Object.entries(agentOutputs)
    .map(([agentId, agent]) => ({ agentId, summary: String(agent?.handoff_summary || '').trim(), status: String(agent?.status || '').trim() }))
    .filter((entry) => entry.summary);
  const lines = [
    '# Base stratégique - ' + (base.project_slug || 'projet'),
    '',
    '## Statut',
    'La structure documentaire du projet est prête, mais la matière stratégique réelle est insuffisante pour produire une base profonde fiable.',
    '',
    '## Ce qui est confirmé',
    '- Projet : ' + (base.project_slug || 'non renseigné'),
    '- Dossier documentaire : créé ou résolu.',
    '- Agents consultés : ' + (Array.isArray(base.agents_used) ? base.agents_used.join(', ') : Object.keys(agentOutputs).join(', ')),
    '',
    '## Synthèse des agents',
    ...(summaries.length ? summaries.map((entry) => '- ' + entry.agentId + ' (' + (entry.status || 'status inconnu') + ') : ' + entry.summary) : ['- Les agents demandent plus de contexte avant de produire une stratégie définitive.']),
    '',
    '## Informations manquantes',
    bullets(questions),
    '',
    '## Prochaine étape logique',
    'Donner les informations métier réelles du projet : offre, cible, promesse, preuves, modèle économique, contraintes de ton, plateformes visées et objectifs. Ensuite Crew_System pourra relancer les agents et produire une base stratégique profonde sans inventer de contexte.'
  ];
  return lines.join('\\n');
}
if (!allowSimulation && needsContext && looksSimulated) {
  output = safeMissingContextDocument();
}
const job_id = base.job_id || 'job_unknown';
const project_slug = base.project_slug || 'project_unresolved';
const safeJob = String(job_id).replace(/[^a-zA-Z0-9_-]/g, '_');
const docs = Array.isArray(base.project_context_package?.documents) ? base.project_context_package.documents : [];
const folderDoc = docs.find((doc) => doc?.metadata?.folder_id || doc?.metadata?.folderId) || {};
const folder_id = base.project_folder_id || folderDoc.metadata?.folder_id || folderDoc.metadata?.folderId || '';
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
const isStrategicBase = base.job_route === 'strategic_base_builder';
const path = isStrategicBase
  ? 'projects/' + project_slug + '/base_strategique.md'
  : 'async_jobs/' + safeJob + '/final.md';
return [{ json: {
  job_id,
  project_slug,
  artifact_id: 'artifact_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  document_id: 'document_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  completion_event_id: 'event_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  path,
  folder_id,
  drive_file_name: isStrategicBase ? 'base_strategique.md' : 'final.md',
  document_title: isStrategicBase ? 'Base stratégique - ' + project_slug : 'Crew_System - Livrable final - ' + safeJob,
  document_type: isStrategicBase ? 'strategic_base' : 'markdown',
  content_type: 'text/markdown',
  content,
  status,
  assistant_message: content,
  percent_estimate: 100,
  current_phase: status === 'completed' ? 'completed' : 'failed',
  completion_message: status === 'completed' ? 'Job terminé. Le livrable final est disponible.' : 'Job terminé en erreur. Un diagnostic a été sauvegardé.',
  agents_used: Array.isArray(base.agents_used) && base.agents_used.length
    ? base.agents_used
    : (isStrategicBase ? ['file_architect','strategist','audience_psychologist','growth_hacker'] : ['strategist','audience_psychologist','growth_hacker']),
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
  document_type: payload.document_type || 'markdown',
  status: drive_file_id ? 'ready' : 'saved_without_drive',
  content_type: payload.content_type || 'text/markdown',
  drive_file_id,
  drive_url,
  metadata: { folder_id: payload.folder_id || '', generated_by: 'async_worker', job_route: payload.document_type || 'markdown' }
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
      { fieldId: "metadata", fieldValue: "={{ $('Build Document Index Payload').first().json.metadata }}" },
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
    contextProgress,
    loadProjectContextProject,
    loadProjectContextDocuments,
    loadProjectContextArtifacts,
    loadProjectContextDecisions,
    loadProjectContextAgentRuns,
    loadProjectContextJobs,
    buildProjectContextPackage,
    routeFolderResolutionBlocked,
    markFolderResolutionFailed,
    addFolderResolutionFailedProgress,
    routeEnsureProjectStructure,
    ...workerStructureFolderNodes,
    workerBuildStructureRegistry,
    workerBuildInitialFiles,
    workerCreateInitialFiles,
    workerMergeStructureContext,
    routeFileArchitect,
    fileArchitectProgress,
    runFileArchitect,
    checkpointFileArchitect,
    saveFileArchitectRun,
    fileArchitectCanonicalPayload,
    fileArchitectCanonicalArtifact,
    fileArchitectCanonicalDrive,
    fileArchitectCanonicalIndex,
    strategistProgress,
    runStrategist,
    checkpointStrategist,
    saveStrategistRun,
    strategistCanonicalPayload,
    strategistCanonicalArtifact,
    strategistCanonicalDrive,
    strategistCanonicalIndex,
    positioningCanonicalPayload,
    positioningCanonicalArtifact,
    positioningCanonicalDrive,
    positioningCanonicalIndex,
    influenceCanonicalPayload,
    influenceCanonicalArtifact,
    influenceCanonicalDrive,
    influenceCanonicalIndex,
    audienceProgress,
    runAudience,
    checkpointAudience,
    saveAudienceRun,
    audienceCanonicalPayload,
    audienceCanonicalArtifact,
    audienceCanonicalDrive,
    audienceCanonicalIndex,
    growthProgress,
    runGrowth,
    checkpointGrowth,
    saveGrowthRun,
    growthCanonicalPayload,
    growthCanonicalArtifact,
    growthCanonicalDrive,
    growthCanonicalIndex,
    routeHook,
    hooksProgress,
    runHooks,
    checkpointHooks,
    saveHooksRun,
    hooksCanonicalPayload,
    hooksCanonicalArtifact,
    hooksCanonicalDrive,
    hooksCanonicalIndex,
    routeFacebook,
    facebookProgress,
    runFacebook,
    checkpointFacebook,
    saveFacebookRun,
    facebookCanonicalPayload,
    facebookCanonicalArtifact,
    facebookCanonicalDrive,
    facebookCanonicalIndex,
    routeLinkedIn,
    linkedinProgress,
    runLinkedIn,
    checkpointLinkedIn,
    saveLinkedInRun,
    linkedinCanonicalPayload,
    linkedinCanonicalArtifact,
    linkedinCanonicalDrive,
    linkedinCanonicalIndex,
    routeCalendar,
    calendarProgress,
    runCalendar,
    checkpointCalendar,
    saveCalendarRun,
    calendarCanonicalPayload,
    calendarCanonicalArtifact,
    calendarCanonicalDrive,
    calendarCanonicalIndex,
    routeCopywriter,
    copywriterProgress,
    runCopywriter,
    checkpointCopywriter,
    saveCopywriterRun,
    copywriterCanonicalPayload,
    copywriterCanonicalArtifact,
    copywriterCanonicalDrive,
    copywriterCanonicalIndex,
    routeCreative,
    creativeProgress,
    runCreative,
    checkpointCreative,
    saveCreativeRun,
    creativeCanonicalPayload,
    creativeCanonicalArtifact,
    creativeCanonicalDrive,
    creativeCanonicalIndex,
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
  const contextLoaderNodeNames = new Set([
    note.name,
    trigger.name,
    prepare.name,
    markRunning.name,
    addRunningProgress.name,
    contextProgress.name,
    loadProjectContextProject.name,
    loadProjectContextDocuments.name,
    loadProjectContextArtifacts.name,
    loadProjectContextDecisions.name,
    loadProjectContextAgentRuns.name,
    loadProjectContextJobs.name,
    buildProjectContextPackage.name,
  ]);
  for (const node of nodes) {
    if (!contextLoaderNodeNames.has(node.name) && Array.isArray(node.position)) {
      node.position = [node.position[0] + 900, node.position[1]];
    }
  }
  const connections = {
    [trigger.name]: { main: [[{ node: prepare.name, type: "main", index: 0 }]] },
    [prepare.name]: { main: [[{ node: markRunning.name, type: "main", index: 0 }]] },
    [markRunning.name]: { main: [[{ node: addRunningProgress.name, type: "main", index: 0 }]] },
    [addRunningProgress.name]: { main: [[{ node: contextProgress.name, type: "main", index: 0 }]] },
    [contextProgress.name]: { main: [[{ node: loadProjectContextProject.name, type: "main", index: 0 }]] },
    [loadProjectContextProject.name]: { main: [[{ node: loadProjectContextDocuments.name, type: "main", index: 0 }]] },
    [loadProjectContextDocuments.name]: { main: [[{ node: loadProjectContextArtifacts.name, type: "main", index: 0 }]] },
    [loadProjectContextArtifacts.name]: { main: [[{ node: loadProjectContextDecisions.name, type: "main", index: 0 }]] },
    [loadProjectContextDecisions.name]: { main: [[{ node: loadProjectContextAgentRuns.name, type: "main", index: 0 }]] },
    [loadProjectContextAgentRuns.name]: { main: [[{ node: loadProjectContextJobs.name, type: "main", index: 0 }]] },
    [loadProjectContextJobs.name]: { main: [[{ node: buildProjectContextPackage.name, type: "main", index: 0 }]] },
    [buildProjectContextPackage.name]: { main: [[{ node: routeFolderResolutionBlocked.name, type: "main", index: 0 }]] },
    [routeFolderResolutionBlocked.name]: {
      main: [
        [{ node: markFolderResolutionFailed.name, type: "main", index: 0 }],
        [{ node: routeEnsureProjectStructure.name, type: "main", index: 0 }],
      ],
    },
    [markFolderResolutionFailed.name]: { main: [[{ node: addFolderResolutionFailedProgress.name, type: "main", index: 0 }]] },
    [routeEnsureProjectStructure.name]: {
      main: [
        [{ node: (workerStructureFolderNodes[0] || workerMergeStructureContext).name, type: "main", index: 0 }],
        [{ node: routeFileArchitect.name, type: "main", index: 0 }],
      ],
    },
    [routeFileArchitect.name]: {
      main: [
        [{ node: fileArchitectProgress.name, type: "main", index: 0 }],
        [{ node: strategistProgress.name, type: "main", index: 0 }],
      ],
    },
    [fileArchitectProgress.name]: { main: [[{ node: runFileArchitect.name, type: "main", index: 0 }]] },
    [runFileArchitect.name]: { main: [[{ node: checkpointFileArchitect.name, type: "main", index: 0 }]] },
    [checkpointFileArchitect.name]: { main: [[{ node: saveFileArchitectRun.name, type: "main", index: 0 }]] },
    [saveFileArchitectRun.name]: { main: [[{ node: fileArchitectCanonicalPayload.name, type: "main", index: 0 }]] },
    [fileArchitectCanonicalPayload.name]: { main: [[{ node: fileArchitectCanonicalArtifact.name, type: "main", index: 0 }]] },
    [fileArchitectCanonicalArtifact.name]: { main: [[{ node: fileArchitectCanonicalDrive.name, type: "main", index: 0 }]] },
    [fileArchitectCanonicalDrive.name]: { main: [[{ node: fileArchitectCanonicalIndex.name, type: "main", index: 0 }]] },
    [fileArchitectCanonicalIndex.name]: { main: [[{ node: strategistProgress.name, type: "main", index: 0 }]] },
    [strategistProgress.name]: { main: [[{ node: runStrategist.name, type: "main", index: 0 }]] },
    [runStrategist.name]: { main: [[{ node: checkpointStrategist.name, type: "main", index: 0 }]] },
    [checkpointStrategist.name]: { main: [[{ node: saveStrategistRun.name, type: "main", index: 0 }]] },
    [saveStrategistRun.name]: { main: [[{ node: strategistCanonicalPayload.name, type: "main", index: 0 }]] },
    [strategistCanonicalPayload.name]: { main: [[{ node: strategistCanonicalArtifact.name, type: "main", index: 0 }]] },
    [strategistCanonicalArtifact.name]: { main: [[{ node: strategistCanonicalDrive.name, type: "main", index: 0 }]] },
    [strategistCanonicalDrive.name]: { main: [[{ node: strategistCanonicalIndex.name, type: "main", index: 0 }]] },
    [strategistCanonicalIndex.name]: { main: [[{ node: positioningCanonicalPayload.name, type: "main", index: 0 }]] },
    [positioningCanonicalPayload.name]: { main: [[{ node: positioningCanonicalArtifact.name, type: "main", index: 0 }]] },
    [positioningCanonicalArtifact.name]: { main: [[{ node: positioningCanonicalDrive.name, type: "main", index: 0 }]] },
    [positioningCanonicalDrive.name]: { main: [[{ node: positioningCanonicalIndex.name, type: "main", index: 0 }]] },
    [positioningCanonicalIndex.name]: { main: [[{ node: influenceCanonicalPayload.name, type: "main", index: 0 }]] },
    [influenceCanonicalPayload.name]: { main: [[{ node: influenceCanonicalArtifact.name, type: "main", index: 0 }]] },
    [influenceCanonicalArtifact.name]: { main: [[{ node: influenceCanonicalDrive.name, type: "main", index: 0 }]] },
    [influenceCanonicalDrive.name]: { main: [[{ node: influenceCanonicalIndex.name, type: "main", index: 0 }]] },
    [influenceCanonicalIndex.name]: { main: [[{ node: audienceProgress.name, type: "main", index: 0 }]] },
    [audienceProgress.name]: { main: [[{ node: runAudience.name, type: "main", index: 0 }]] },
    [runAudience.name]: { main: [[{ node: checkpointAudience.name, type: "main", index: 0 }]] },
    [checkpointAudience.name]: { main: [[{ node: saveAudienceRun.name, type: "main", index: 0 }]] },
    [saveAudienceRun.name]: { main: [[{ node: audienceCanonicalPayload.name, type: "main", index: 0 }]] },
    [audienceCanonicalPayload.name]: { main: [[{ node: audienceCanonicalArtifact.name, type: "main", index: 0 }]] },
    [audienceCanonicalArtifact.name]: { main: [[{ node: audienceCanonicalDrive.name, type: "main", index: 0 }]] },
    [audienceCanonicalDrive.name]: { main: [[{ node: audienceCanonicalIndex.name, type: "main", index: 0 }]] },
    [audienceCanonicalIndex.name]: { main: [[{ node: growthProgress.name, type: "main", index: 0 }]] },
    [growthProgress.name]: { main: [[{ node: runGrowth.name, type: "main", index: 0 }]] },
    [runGrowth.name]: { main: [[{ node: checkpointGrowth.name, type: "main", index: 0 }]] },
    [checkpointGrowth.name]: { main: [[{ node: saveGrowthRun.name, type: "main", index: 0 }]] },
    [saveGrowthRun.name]: { main: [[{ node: growthCanonicalPayload.name, type: "main", index: 0 }]] },
    [growthCanonicalPayload.name]: { main: [[{ node: growthCanonicalArtifact.name, type: "main", index: 0 }]] },
    [growthCanonicalArtifact.name]: { main: [[{ node: growthCanonicalDrive.name, type: "main", index: 0 }]] },
    [growthCanonicalDrive.name]: { main: [[{ node: growthCanonicalIndex.name, type: "main", index: 0 }]] },
    [growthCanonicalIndex.name]: { main: [[{ node: routeHook.name, type: "main", index: 0 }]] },
    [routeHook.name]: {
      main: [
        [{ node: hooksProgress.name, type: "main", index: 0 }],
        [{ node: routeFacebook.name, type: "main", index: 0 }],
      ],
    },
    [hooksProgress.name]: { main: [[{ node: runHooks.name, type: "main", index: 0 }]] },
    [runHooks.name]: { main: [[{ node: checkpointHooks.name, type: "main", index: 0 }]] },
    [checkpointHooks.name]: { main: [[{ node: saveHooksRun.name, type: "main", index: 0 }]] },
    [saveHooksRun.name]: { main: [[{ node: hooksCanonicalPayload.name, type: "main", index: 0 }]] },
    [hooksCanonicalPayload.name]: { main: [[{ node: hooksCanonicalArtifact.name, type: "main", index: 0 }]] },
    [hooksCanonicalArtifact.name]: { main: [[{ node: hooksCanonicalDrive.name, type: "main", index: 0 }]] },
    [hooksCanonicalDrive.name]: { main: [[{ node: hooksCanonicalIndex.name, type: "main", index: 0 }]] },
    [hooksCanonicalIndex.name]: { main: [[{ node: routeFacebook.name, type: "main", index: 0 }]] },
    [routeFacebook.name]: {
      main: [
        [{ node: facebookProgress.name, type: "main", index: 0 }],
        [{ node: routeLinkedIn.name, type: "main", index: 0 }],
      ],
    },
    [facebookProgress.name]: { main: [[{ node: runFacebook.name, type: "main", index: 0 }]] },
    [runFacebook.name]: { main: [[{ node: checkpointFacebook.name, type: "main", index: 0 }]] },
    [checkpointFacebook.name]: { main: [[{ node: saveFacebookRun.name, type: "main", index: 0 }]] },
    [saveFacebookRun.name]: { main: [[{ node: facebookCanonicalPayload.name, type: "main", index: 0 }]] },
    [facebookCanonicalPayload.name]: { main: [[{ node: facebookCanonicalArtifact.name, type: "main", index: 0 }]] },
    [facebookCanonicalArtifact.name]: { main: [[{ node: facebookCanonicalDrive.name, type: "main", index: 0 }]] },
    [facebookCanonicalDrive.name]: { main: [[{ node: facebookCanonicalIndex.name, type: "main", index: 0 }]] },
    [facebookCanonicalIndex.name]: { main: [[{ node: routeLinkedIn.name, type: "main", index: 0 }]] },
    [routeLinkedIn.name]: {
      main: [
        [{ node: linkedinProgress.name, type: "main", index: 0 }],
        [{ node: routeCalendar.name, type: "main", index: 0 }],
      ],
    },
    [linkedinProgress.name]: { main: [[{ node: runLinkedIn.name, type: "main", index: 0 }]] },
    [runLinkedIn.name]: { main: [[{ node: checkpointLinkedIn.name, type: "main", index: 0 }]] },
    [checkpointLinkedIn.name]: { main: [[{ node: saveLinkedInRun.name, type: "main", index: 0 }]] },
    [saveLinkedInRun.name]: { main: [[{ node: linkedinCanonicalPayload.name, type: "main", index: 0 }]] },
    [linkedinCanonicalPayload.name]: { main: [[{ node: linkedinCanonicalArtifact.name, type: "main", index: 0 }]] },
    [linkedinCanonicalArtifact.name]: { main: [[{ node: linkedinCanonicalDrive.name, type: "main", index: 0 }]] },
    [linkedinCanonicalDrive.name]: { main: [[{ node: linkedinCanonicalIndex.name, type: "main", index: 0 }]] },
    [linkedinCanonicalIndex.name]: { main: [[{ node: routeCalendar.name, type: "main", index: 0 }]] },
    [routeCalendar.name]: {
      main: [
        [{ node: calendarProgress.name, type: "main", index: 0 }],
        [{ node: routeCopywriter.name, type: "main", index: 0 }],
      ],
    },
    [calendarProgress.name]: { main: [[{ node: runCalendar.name, type: "main", index: 0 }]] },
    [runCalendar.name]: { main: [[{ node: checkpointCalendar.name, type: "main", index: 0 }]] },
    [checkpointCalendar.name]: { main: [[{ node: saveCalendarRun.name, type: "main", index: 0 }]] },
    [saveCalendarRun.name]: { main: [[{ node: calendarCanonicalPayload.name, type: "main", index: 0 }]] },
    [calendarCanonicalPayload.name]: { main: [[{ node: calendarCanonicalArtifact.name, type: "main", index: 0 }]] },
    [calendarCanonicalArtifact.name]: { main: [[{ node: calendarCanonicalDrive.name, type: "main", index: 0 }]] },
    [calendarCanonicalDrive.name]: { main: [[{ node: calendarCanonicalIndex.name, type: "main", index: 0 }]] },
    [calendarCanonicalIndex.name]: { main: [[{ node: routeCopywriter.name, type: "main", index: 0 }]] },
    [routeCopywriter.name]: {
      main: [
        [{ node: copywriterProgress.name, type: "main", index: 0 }],
        [{ node: routeCreative.name, type: "main", index: 0 }],
      ],
    },
    [copywriterProgress.name]: { main: [[{ node: runCopywriter.name, type: "main", index: 0 }]] },
    [runCopywriter.name]: { main: [[{ node: checkpointCopywriter.name, type: "main", index: 0 }]] },
    [checkpointCopywriter.name]: { main: [[{ node: saveCopywriterRun.name, type: "main", index: 0 }]] },
    [saveCopywriterRun.name]: { main: [[{ node: copywriterCanonicalPayload.name, type: "main", index: 0 }]] },
    [copywriterCanonicalPayload.name]: { main: [[{ node: copywriterCanonicalArtifact.name, type: "main", index: 0 }]] },
    [copywriterCanonicalArtifact.name]: { main: [[{ node: copywriterCanonicalDrive.name, type: "main", index: 0 }]] },
    [copywriterCanonicalDrive.name]: { main: [[{ node: copywriterCanonicalIndex.name, type: "main", index: 0 }]] },
    [copywriterCanonicalIndex.name]: { main: [[{ node: routeCreative.name, type: "main", index: 0 }]] },
    [routeCreative.name]: {
      main: [
        [{ node: creativeProgress.name, type: "main", index: 0 }],
        [{ node: synthesisProgress.name, type: "main", index: 0 }],
      ],
    },
    [creativeProgress.name]: { main: [[{ node: runCreative.name, type: "main", index: 0 }]] },
    [runCreative.name]: { main: [[{ node: checkpointCreative.name, type: "main", index: 0 }]] },
    [checkpointCreative.name]: { main: [[{ node: saveCreativeRun.name, type: "main", index: 0 }]] },
    [saveCreativeRun.name]: { main: [[{ node: creativeCanonicalPayload.name, type: "main", index: 0 }]] },
    [creativeCanonicalPayload.name]: { main: [[{ node: creativeCanonicalArtifact.name, type: "main", index: 0 }]] },
    [creativeCanonicalArtifact.name]: { main: [[{ node: creativeCanonicalDrive.name, type: "main", index: 0 }]] },
    [creativeCanonicalDrive.name]: { main: [[{ node: creativeCanonicalIndex.name, type: "main", index: 0 }]] },
    [creativeCanonicalIndex.name]: { main: [[{ node: synthesisProgress.name, type: "main", index: 0 }]] },
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
  for (let index = 0; index < workerStructureFolderNodes.length; index += 1) {
    const current = workerStructureFolderNodes[index];
    const next = workerStructureFolderNodes[index + 1] || workerBuildStructureRegistry;
    connections[current.name] = {
      main: [[{ node: next.name, type: "main", index: 0 }]],
    };
  }
  connections[workerBuildStructureRegistry.name] = {
    main: [[{ node: workerBuildInitialFiles.name, type: "main", index: 0 }]],
  };
  connections[workerBuildInitialFiles.name] = {
    main: [[{ node: workerCreateInitialFiles.name, type: "main", index: 0 }]],
  };
  connections[workerCreateInitialFiles.name] = {
    main: [[{ node: workerMergeStructureContext.name, type: "main", index: 0 }]],
  };
  connections[workerMergeStructureContext.name] = {
    main: [[{ node: routeFileArchitect.name, type: "main", index: 0 }]],
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
          project_slug: { type: "string", description: "Slug du projet actif. Obligatoire pour lancer un chantier long." },
          project_name: { type: "string", description: "Nom lisible du projet si nouveau." },
          request_message: { type: "string", description: "Demande utilisateur complète à traiter en arrière-plan." },
          job_type: { type: "string", description: "Type de chantier : strategy, content_batch, calendar, revision, document_creation, etc." },
          context_summary: { type: "string", description: "Contexte utile deja compris ou lu." },
          expected_output: { type: "string", description: "Livrable final attendu." },
        },
        required: ["project_slug", "request_message"],
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
function slugify(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90);
}
function extractProjectSlug(text) {
  const explicit = text.match(/\\b(?:project_slug|slug)\\s*[:=]\\s*["'\`]?([a-z0-9][a-z0-9_-]{1,80})/i);
  if (explicit) return explicit[1].toLowerCase();
  const quoted = text.match(/\\b(?:projet|project)\\s+["'\`]([^"'\`]{2,80})["'\`]/i);
  if (quoted) return slugify(quoted[1]);
  const namedSafeAscii = text.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').match(/\\b(?:projet|project)\\s+(?:nomme|appele|intitule|nommee|appelee|intitulee)\\s+([^.!?\\n]{2,60})/i);
  if (namedSafeAscii) return slugify(namedSafeAscii[1]);
  const namedSafe = text.match(/\\b(?:projet|project)\\s+(?:nomme|appele|intitule|nommee|appelee|intitulee|nommé|appelé|intitulé|nommée|appelée|intitulée)\\s+([^.!?\\n]{2,60})/i);
  if (namedSafe) return slugify(namedSafe[1]);
  const named = text.match(/\\b(?:projet|project)\\s+(?:nomm[eé]|appel[eé]|intitul[eé])\\s+([a-zA-Z0-9À-ÿ][a-zA-Z0-9À-ÿ _.-]{1,60})/i);
  if (named) return slugify(named[1]);
  const called = text.match(/\\b(?:projet|project)\\s+(?:qui\\s+)?(?:s[' ]appelle|appele|nomme|intitule)\\s+([^.!?\\n]{2,60})/i);
  if (called) return slugify(called[1]);
  const colonNamed = text.match(/\\b(?:projet|project)\\s*[:=]\\s*([^.!?\\n]{2,60})/i);
  if (colonNamed) return slugify(colonNamed[1]);
  const simple = text.match(/\\b(?:sur|pour|du|de)\\s+(?:le\\s+)?projet\\s+([a-zA-Z0-9][a-zA-Z0-9_-]{1,80})\\b/i);
  if (simple) return simple[1].toLowerCase();
  const slugLike = text.match(/\\b[a-z][a-z0-9]+(?:_[a-z0-9]+)+\\b/i);
  return slugLike ? slugLike[0].toLowerCase() : '';
}
const launchLike = /\\b(lance|lancer|d[eé]marre|d[eé]marrer|pr[eé]pare|pr[eé]parer|cr[eé]e|cr[eé]er|g[eé]n[eè]re|g[eé]n[eé]rer|produis|produire|fais|faire)\\b/i.test(chatInput);
const statusLike = /\\b(o[uù] en est|statut|status|avancement|progression|termin[eé]|livrable pr[eê]t|job[_ -]?id)\\b/i.test(chatInput) && !launchLike;
const jobMatch = chatInput.match(/\\bjob_[a-z0-9]+_[a-z0-9]+\\b/i);
const status_job_id = jobMatch ? jobMatch[0] : '';
const project_slug = extractProjectSlug(chatInput);
const has_project_context = Boolean(project_slug);
const plainInput = chatInput.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const negatedProjectCreation = /\\b(?:ne|n[' ]?)\\s*(?:me\\s+)?(?:cree|creer|creez)?\\s*pas\\s+(?:de\\s+)?(?:nouveau\\s+)?projet\\b/i.test(plainInput)
  || /\\bsans\\s+(?:creer|creation\\s+(?:dun\\s+|de\\s+))?(?:de\\s+)?(?:nouveau\\s+)?projet\\b/i.test(plainInput)
  || /\\b(?:ne|n[' ]?)\\s*(?:re)?initialise\\s*pas\\s+(?:le\\s+)?projet\\b/i.test(plainInput);
const rawExplicitNewProject = /\\b(nouveau projet|nouvel espace|cr[eé]e(?:r)?\\s+(?:un\\s+)?(?:nouveau\\s+)?projet|cr[eé]ation\\s+(?:d['’]un\\s+|de\\s+)?(?:nouveau\\s+)?projet|initialise(?:r)?\\s+(?:un\\s+)?projet)\\b/i.test(chatInput);
const explicitNewProject = rawExplicitNewProject && !negatedProjectCreation;
const existingProjectReference = /\\b(?:pour|sur|dans|du|de)\\s+(?:le\\s+)?projet\\b/i.test(chatInput) && !explicitNewProject;
const productionCommand = /\\b(?:je veux|j'aimerais|jaimerais|besoin de|il me faut|cree|creer|creez|genere|generer|produis|produire|redige|rediger|ecris|ecrire|donne(?:-|\\s*)moi|sors|sortir|prepare|preparer|fais|faire)\\b/i.test(plainInput);
const contentObject = /\\b(?:batch|mini[- ]?batch|posts?|publications?|contenus?|scripts?|captions?|carrousels?|threads?)\\b/i.test(plainInput)
  || /\\b(?:facebook|linkedin|linked ?in)\\b[\\s\\S]{0,80}\\b(?:posts?|publications?|contenus?)\\b/i.test(plainInput)
  || /\\b(?:posts?|publications?|contenus?)\\b[\\s\\S]{0,80}\\b(?:facebook|linkedin|linked ?in)\\b/i.test(plainInput);
const contentVolumeOrWindow = /\\b(?:\\d{1,3})\\s+(?:publications|posts|contenus)\\b/i.test(plainInput)
  || /\\b(?:pour|sur)\\s+(?:la\\s+)?semaine\\b/i.test(plainInput)
  || /\\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\b/i.test(plainInput);
const contentIntent = contentObject && (productionCommand || contentVolumeOrWindow);
const calendarIntent = /\\b(calendrier|planning|planification|annuel|annuelle|12\\s+mois|52\\s+semaines|arcs?\\s+de\\s+contenu|editorial|[eé]ditorial)\\b/i.test(chatInput);
const visualIntent = /\\b(visuels?|images?|cr[eé]atives?|creatives?|briefs?\\s+visuels?|vid[eé]os?|reels?|shorts?)\\b/i.test(chatInput);
const platformIntent = /\\b(facebook|linkedin|linked ?in)\\b/i.test(chatInput);
const naturalProjectIntro = /\\b(?:j'ai|jai|nous avons|on a|voici|je lance|je veux lancer|je veux creer|je veux monter|mon projet|notre projet|idee de projet|idee business|idee de saas|idee d'application)\\b[\\s\\S]{0,140}\\b(?:projet|saas|application|offre|business|marque|service|produit)\\b/i.test(plainInput)
  || /\\b(?:projet|saas|application|offre|business|marque|service|produit)\\b[\\s\\S]{0,80}\\b(?:objectif|cible|promesse|positionnement|facebook|linkedin|contenu|communication|growth|audience)\\b/i.test(plainInput);
const richProjectInfo = chatInput.length >= 180
  || /\\b(?:offre|cible|objectif|promesse|positionnement|audience|persona|probleme|douleur|preuve|concurrents?|marche|facebook|linkedin|growth|communication|strategie|automatisation|n8n|python|application|saas)\\b/i.test(plainInput);
const projectOnboardingIntent = !negatedProjectCreation
  && !existingProjectReference
  && (explicitNewProject || (naturalProjectIntro && richProjectInfo));
const strategicBaseReference = /\\b(base strat[eé]gique)\\b[\\s\\S]{0,80}\\b(existante?|existants?|d[eé]j[aà]|disponible|utilise(?:r)?|lis|lire|base-toi|basant|partir)\\b/i.test(chatInput)
  || /\\b(utilise(?:r)?|lis|lire|base-toi|basant|partir)\\b[\\s\\S]{0,80}\\b(base strat[eé]gique)\\b/i.test(chatInput);
const strategicBaseBuildIntent = !strategicBaseReference && /\\b(base strat[eé]gique|strat[eé]gie profonde|socle strat[eé]gique|campaign pack)\\b/i.test(chatInput)
  && /\\b(cr[eé]e(?:r)?|construis(?:re)?|g[eé]n[eè]re(?:r)?|pr[eé]pare(?:r)?|r[eé]alise(?:r)?|lance(?:r)?)\\b/i.test(chatInput);
const productionIntent = contentIntent || calendarIntent || visualIntent;
const setupArtifactRequest = /\\b(dossier google drive|dossier drive|espace de travail|structure canonique|structure documentaire)\\b/i.test(chatInput)
  && /\\b(cr[eé]e(?:r)?|initialise(?:r)?|pr[eé]pare(?:r)?|structure(?:r)?|construis(?:re)?|mets?\\s+en\\s+place)\\b/i.test(chatInput)
  && !negatedProjectCreation
  && !productionIntent;
const setupLike = projectOnboardingIntent || (!existingProjectReference && setupArtifactRequest);
function resolveLockedRoute() {
  if (setupLike) return { job_type: 'strategic_base_builder', reason: projectOnboardingIntent ? 'project_onboarding_context' : 'workspace_setup' };
  if (contentIntent) return { job_type: 'content_batch', reason: 'content_terms_win_over_context_terms' };
  if (calendarIntent) return { job_type: 'annual_calendar', reason: 'calendar_terms' };
  if (visualIntent) return { job_type: 'creative_batch', reason: 'visual_terms_without_content_batch' };
  if (strategicBaseBuildIntent) return { job_type: 'strategic_base_builder', reason: 'strategic_base_build' };
  if (/\\b(strat[eé]gie|positionnement|growth|croissance|analyse|diagnostic|plan)\\b/i.test(chatInput)) return { job_type: 'strategy_brief', reason: 'strategy_terms' };
  return { job_type: 'direct_chat', reason: 'no_heavy_route_detected' };
}
const routeDecision = resolveLockedRoute();
const resolved_job_type = routeDecision.job_type;
const routing_intent_flags = {
  explicitNewProject,
  negatedProjectCreation,
  existingProjectReference,
  naturalProjectIntro,
  richProjectInfo,
  projectOnboardingIntent,
  contentIntent,
  calendarIntent,
  visualIntent,
  platformIntent,
  strategicBaseReference,
  strategicBaseBuildIntent,
  setupLike,
  route_reason: routeDecision.reason
};
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
const should_status = Boolean(chatInput) && statusLike && (Boolean(status_job_id) || has_project_context);
const should_setup = Boolean(chatInput) && has_project_context && setupLike;
const routeNeedsAsync = resolved_job_type !== 'direct_chat';
const should_async = Boolean(chatInput) && has_project_context && !should_status && !should_setup && (routeNeedsAsync || heavyPatterns.some((pattern) => pattern.test(chatInput)));
const job_id = 'job_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10);
const project_name = project_slug ? project_slug.replace(/_/g, ' ') : '';
const description = project_slug ? 'Projet ' + project_name + ' piloté par Crew_System.' : '';
const project_folder_name = project_slug ? 'Crew_System - ' + project_name : '';
const job_type = should_setup
  ? 'strategic_base_builder'
  : (routeNeedsAsync ? resolved_job_type : 'strategy_brief');
const expected_output = should_setup
  ? 'Base stratégique profonde en Markdown lisible : positionnement, cible, psychologie, offre, preuves, piliers de contenu, boucles growth, risques et prochaines questions.'
  : (job_type === 'content_batch'
    ? 'Batch de contenus final en Markdown lisible, avec posts, adaptations plateforme et brief visuel si demandé.'
    : job_type === 'annual_calendar'
      ? 'Calendrier éditorial structuré en Markdown lisible.'
      : job_type === 'creative_batch'
        ? 'Brief créatif et direction visuelle en Markdown lisible.'
        : /markdown|document|livrable/i.test(chatInput)
    ? 'Document Markdown final, lisible, structuré, sans JSON brut.'
        : 'Livrable final clair, exploitable et sauvegardé.');
const context_summary = project_slug
  ? (should_setup
    ? 'Nouveau projet ou base stratégique demandée: ' + project_slug + '. Le dossier Drive et une base initiale sont créés avant le worker. Le worker doit produire la base stratégique profonde comme prochaine étape logique.'
    : 'Projet actif résolu par le routeur rapide: ' + project_slug + '. Routage verrouillé: ' + job_type + ' (' + routeDecision.reason + '). Le worker doit lire le contexte projet disponible avant de produire.')
  : '';
const queued_message = should_setup
  ? "C'est créé et lancé. La base stratégique profonde est en cours de construction."
  : "C'est lancé. Les agents travaillent en arrière-plan et le livrable sera sauvegardé dès qu'il est prêt.";
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
return [{ json: { ...input, should_status, should_setup, should_async, status_job_id, job_id, project_slug, project_name, project_folder_name, description, request_message: chatInput, job_type, route_locked: true, route_reason: routeDecision.reason, routing_intent_flags, context_summary, expected_output, queued_message, worker_prompt } }];`,
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
  const setupRoute = {
    id: nodeId(),
    name: "Route Project Setup Request?",
    type: "n8n-nodes-base.if",
    typeVersion: 1,
    position: [-580, -120],
    parameters: {
      conditions: {
        boolean: [
          {
            value1: "={{ $json.should_setup }}",
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
  loading_context: 'chargement du contexte projet',
  running: 'en cours',
  completed: 'terminé',
  failed: 'échoué',
  cancelled: 'annulé',
};
const phaseLabels = {
  queued: 'en attente',
  preparing_agents: 'préparation des agents',
  file_architect: 'architecture documentaire',
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
  file_architect: 'File Architect',
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
  const wantsStrategicBase = /base strat[eé]gique|strategic_base_builder|strategic[_ -]?base|nouveau projet|dossier drive|espace de travail/.test(text);
  const hasFacebook = /facebook|\\bfb\\b/.test(text);
  const hasLinkedIn = /linkedin|linked in/.test(text);
  const wantsBatch = /batch|publications?|posts?|contenus?|semaine|\\b30\\b|\\b70\\b/.test(text);
  const wantsCalendar = /calendrier|editorial|annuel|annee|year|12 mois/.test(text);
  const wantsCreative = /visuel|image|creative|creatif|direction creative/.test(text);
  if (wantsStrategicBase) return 'strategic_base_builder';
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
  if (route === 'strategic_base_builder') {
    return ['file_architect', 'strategist', 'audience_psychologist', 'growth_hacker'];
  }
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
const latestAgents = latestAgentRows(agentRows);
let inferredRoute = inferRoute(job);
if (latestAgents.file_architect) inferredRoute = 'strategic_base_builder';
const expectedAgents = routeAgents(inferredRoute, job);
const displayAgentRows = expectedAgents
  .map((agentId) => latestAgents[agentId])
  .filter(Boolean);
const fallbackAgentRows = Object.values(latestAgents);
const agentLines = (displayAgentRows.length ? displayAgentRows : fallbackAgentRows).map((agent) => {
  const label = agentLabels[agent.agent_id] || agent.agent_id || 'Agent';
  let summary = humanize(agent.output_summary || '').replace(/\\s+/g, ' ').trim();
  const contextMissing = /\\b(?:contexte|boite noire|boîte noire|absence|manque|non disponible|impossible sans|aucun document|aucun ancien livrable)\\b/i.test(summary);
  const status = contextMissing
    ? 'à compléter'
    : (agentStatusLabels[agent.status] || agent.status || 'inconnu');
  if (contextMissing) {
    summary = 'Base stratégique insuffisante pour produire une analyse fiable. Complète le projet avec l’offre, la cible, la promesse et les preuves disponibles.';
  }
  const englishSummary = /\\b(?:initial|strategic framework|mission is|transform|technical validation|setup|target audience|value proposition|operational|framework)\\b/i.test(summary);
  if (englishSummary) {
    summary = 'Analyse en cours à partir de la base stratégique. Le système transforme le contexte projet en recommandations exploitables.';
  }
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
  const setupEnsureProject = supabaseNode(
    "Setup Ensure crew_project",
    "create",
    "crew_projects",
    [
      { fieldId: "project_slug", fieldValue: "={{ $('Quick Async Router').first().json.project_slug }}" },
      { fieldId: "project_name", fieldValue: "={{ $('Quick Async Router').first().json.project_name }}" },
      { fieldId: "description", fieldValue: "={{ $('Quick Async Router').first().json.description }}" },
    ],
    [-300, 40],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const setupCreateJob = supabaseNode(
    "Setup Create async crew_job",
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
    [-60, 40],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const setupCreateFolder = {
    id: nodeId(),
    name: "Setup Create project folder",
    type: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    position: [0, 40],
    parameters: {
      resource: "folder",
      name: "={{ $('Quick Async Router').first().json.project_folder_name }}",
      driveId: { __rl: true, mode: "list", value: "My Drive", cachedResultName: "My Drive" },
      folderId: { __rl: true, mode: "id", value: "root", cachedResultName: "/ (Root folder)" },
      options: { simplifyOutput: false },
    },
    credentials: { googleDriveOAuth2Api: GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
  };
  const setupStructureFolderNodes = PROJECT_STRUCTURE_FOLDERS.map((folder, index) => {
    const parentExpression = folder.parent
      ? `={{ $('${projectStructureNodeName(folder.parent)}').first().json.id || $('${projectStructureNodeName(folder.parent)}').first().json.fileId || $('${projectStructureNodeName(folder.parent)}').first().json.file_id || $('Setup Create project folder').first().json.id || 'root' }}`
      : "={{ $('Setup Create project folder').first().json.id || $('Setup Create project folder').first().json.fileId || $('Setup Create project folder').first().json.file_id || 'root' }}";
    return googleDriveCreateFolderNode(
      projectStructureNodeName(folder.path),
      folder.name,
      parentExpression,
      [300 + (index % 4) * 300, 180 + Math.floor(index / 4) * 150],
    );
  });
  const structureRegistryEntries = PROJECT_STRUCTURE_FOLDERS.map((folder) => ({
    path: folder.path,
    node: projectStructureNodeName(folder.path),
  }));
  const setupBuildStructureRegistry = codeNode(
    "Setup Build project structure registry",
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return {}; }
}
function idFrom(node) {
  return node.id || node.fileId || node.file_id || '';
}
function urlFrom(node, id) {
  return node.webViewLink || node.webContentLink || node.url || (id ? 'https://drive.google.com/drive/folders/' + id : '');
}
const router = $('Quick Async Router').first().json || {};
const root = readNode('Setup Create project folder');
const rootId = idFrom(root);
const rootUrl = urlFrom(root, rootId);
const entries = ${JSON.stringify(structureRegistryEntries)};
const folders = { '': rootId };
const folder_urls = { '': rootUrl };
for (const entry of entries) {
  const node = readNode(entry.node);
  const folderId = idFrom(node);
  if (folderId) {
    folders[entry.path] = folderId;
    folder_urls[entry.path] = urlFrom(node, folderId);
  }
}
return [{ json: {
  project_slug: router.project_slug,
  job_id: router.job_id,
  project_folder_id: rootId,
  project_folder_url: rootUrl,
  folders,
  folder_urls,
  created_at: new Date().toISOString()
} }];`,
    [1500, 40],
  );
  const setupBuildInitialFiles = codeNode(
    "Setup Build initial project files",
    `const router = $('Quick Async Router').first().json || {};
const registry = $('Setup Build project structure registry').first().json || {};
const folders = registry.folders || {};
const rootId = registry.project_folder_id || folders[''] || 'root';
function folderId(path) {
  return folders[path] || rootId;
}
function clean(value) {
  return String(value || '').trim();
}
const now = new Date().toISOString();
const projectName = clean(router.project_name) || clean(router.project_slug);
const projectSlug = clean(router.project_slug);
const request = clean(router.request_message) || 'Non renseignée.';
const manifest = {
  schema_version: '1.0',
  project_slug: projectSlug,
  project_name: projectName,
  status: 'active',
  created_at: now,
  updated_at: now,
  key_files: {
    readme: 'README.md',
    original_brief: 'brief/original_brief.md',
    assumptions: 'brief/assumptions.md',
    normalized_brief: 'brief/normalized_brief.json',
    strategic_diagnosis: 'strategy/strategic_diagnosis.md',
    audience_intelligence: 'strategy/audience_intelligence.md',
    positioning: 'strategy/positioning.md',
    influence_architecture: 'strategy/influence_architecture.md',
    message_system: 'strategy/message_system.md',
    growth_system: 'strategy/growth_system.md',
    annual_calendar: 'calendar/annual_editorial_calendar.md',
    facebook_strategy: 'platforms/facebook_strategy.md',
    linkedin_strategy: 'platforms/linkedin_strategy.md',
    visual_direction: 'creative/visual_direction.md',
    risk_review: 'reviews/risk_review.md',
    brand_memory: 'memory/brand_memory.md',
    audience_memory: 'memory/audience_memory.md',
    decision_memory: 'memory/decision_memory.md'
  },
  folders: Object.keys(folders).sort()
};
const files = [
  {
    path: 'README.md',
    file_name: 'README.md',
    folder_id: folderId(''),
    document_type: 'project_readme',
    content: [
      '# ' + projectName,
      '',
      'Espace de travail Crew_System pour le projet ' + projectSlug + '.',
      '',
      '## Demande initiale',
      request,
      '',
      '## Rôle de ce dossier',
      '- Centraliser la base stratégique du projet.',
      '- Stocker les documents Markdown lisibles produits par les agents.',
      '- Garder une mémoire de décisions, contenus, calendriers et revues qualité.',
      '',
      '## Prochaine étape logique',
      'Construire ou enrichir la base stratégique profonde avec les agents spécialisés.'
    ].join('\\n')
  },
  {
    path: 'manifest.json',
    file_name: 'manifest.json',
    folder_id: folderId(''),
    document_type: 'project_manifest',
    content: JSON.stringify(manifest, null, 2)
  },
  {
    path: 'brief/original_brief.md',
    file_name: 'original_brief.md',
    folder_id: folderId('brief'),
    document_type: 'original_brief',
    content: ['# Brief Original', '', request].join('\\n')
  },
  {
    path: 'brief/assumptions.md',
    file_name: 'assumptions.md',
    folder_id: folderId('brief'),
    document_type: 'assumptions',
    content: ['# Hypothèses De Départ', '', '- Les informations encore absentes devront être confirmées avant les productions sensibles.', '- Les agents doivent produire une version utile même si tout le contexte n’est pas encore complet.'].join('\\n')
  },
  {
    path: 'brief/normalized_brief.json',
    file_name: 'normalized_brief.json',
    folder_id: folderId('brief'),
    document_type: 'normalized_brief',
    content: JSON.stringify({ project_slug: projectSlug, project_name: projectName, request, created_at: now }, null, 2)
  },
  {
    path: 'logs/decisions.md',
    file_name: 'decisions.md',
    folder_id: folderId('logs'),
    document_type: 'decision_log',
    content: ['# Journal Des Décisions', '', '- ' + now + ' : création de l’espace projet et de sa structure canonique.'].join('\\n')
  },
  {
    path: 'memory/brand_memory.md',
    file_name: 'brand_memory.md',
    folder_id: folderId('memory'),
    document_type: 'brand_memory',
    content: ['# Mémoire De Marque', '', 'À compléter à partir de la base stratégique, des preuves, du ton, des offres et des contraintes du projet.'].join('\\n')
  },
  {
    path: 'memory/audience_memory.md',
    file_name: 'audience_memory.md',
    folder_id: folderId('memory'),
    document_type: 'audience_memory',
    content: ['# Mémoire Audience', '', 'À enrichir avec les douleurs, objections, désirs, mots exacts, segments et signaux de marché.'].join('\\n')
  },
  {
    path: 'memory/decision_memory.md',
    file_name: 'decision_memory.md',
    folder_id: folderId('memory'),
    document_type: 'decision_memory',
    content: ['# Mémoire Des Décisions', '', 'Les choix stratégiques importants seront résumés ici pour éviter de refaire les mêmes arbitrages.'].join('\\n')
  },
  {
    path: 'performance/learnings.md',
    file_name: 'learnings.md',
    folder_id: folderId('performance'),
    document_type: 'performance_learnings',
    content: ['# Apprentissages Performance', '', 'Les retours terrain, signaux de contenus et leçons de campagnes seront consolidés ici.'].join('\\n')
  }
];
return files.map((file) => ({ json: {
  ...file,
  project_slug: projectSlug,
  job_id: router.job_id,
  content_type: file.file_name.endsWith('.json') ? 'application/json' : 'text/markdown'
} }));`,
    [1800, 40],
  );
  const setupCreateInitialFiles = googleDriveCreateTextFromCurrentItemNode(
    "Setup Create initial project files",
    [2100, 40],
    "($('Setup Build project structure registry').first().json.project_folder_id || 'root')",
  );
  const setupBuildBasePayload = codeNode(
    "Setup Build strategic base payload",
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return {}; }
}
function clean(value) {
  return String(value || '').trim();
}
const router = $('Quick Async Router').first().json || {};
const folder = readNode('Setup Create project folder');
const registry = readNode('Setup Build project structure registry');
const folder_id = registry.project_folder_id || folder.id || folder.fileId || folder.file_id || '';
const folder_url = registry.project_folder_url || folder.webViewLink || folder.url || (folder_id ? 'https://drive.google.com/drive/folders/' + folder_id : '');
const now = new Date().toISOString();
const projectName = clean(router.project_name) || clean(router.project_slug);
const request = clean(router.request_message);
const content = [
  '# Base Stratégique - ' + projectName,
  '',
  '## Statut',
  '- Projet créé ou confirmé dans Crew_System.',
  '- Dossier Google Drive créé pour centraliser les documents lisibles.',
  '- Cette base est une première version de cadrage. Elle devra être enrichie avec les offres, preuves, cibles détaillées, objections et contraintes réelles.',
  '',
  '## Demande initiale',
  request || 'Non renseignée.',
  '',
  '## Objectif détecté',
  'Structurer le projet, préparer la stratégie de communication, puis lancer un chantier agentique en arrière-plan.',
  '',
  '## Informations déjà disponibles',
  '- Nom du projet : ' + projectName,
  '- Slug : ' + clean(router.project_slug),
  '- Description : ' + (clean(router.description) || 'À compléter.'),
  '',
  '## Informations à compléter',
  '- Offre exacte.',
  '- Cible prioritaire.',
  '- Promesse centrale.',
  '- Preuves disponibles.',
  '- Contraintes de ton, plateforme, volume et calendrier.',
  '',
  '## Prochaine étape logique',
  'Le worker agentique doit lire cette base, consulter les agents utiles et produire le livrable demandé en Markdown.'
].join('\\n');
return [{ json: {
  project_slug: router.project_slug,
  job_id: router.job_id,
  artifact_id: 'artifact_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  document_id: 'document_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2,10),
  path: 'projects/' + router.project_slug + '/base_strategique_initiale.md',
  title: 'Base stratégique initiale - ' + projectName,
  drive_file_name: 'base_strategique_initiale.md',
  folder_id,
  folder_url,
  project_folder_registry: registry.folders || {},
  project_folder_urls: registry.folder_urls || {},
  content_type: 'text/markdown',
  content,
  created_at: now
} }];`,
    [2400, 40],
  );
  const setupCreateBaseDoc = {
    id: nodeId(),
    name: "Setup Create strategic base Markdown",
    type: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    position: [2700, 40],
    parameters: {
      resource: "file",
      operation: "createFromText",
      content: "={{ $('Setup Build strategic base payload').first().json.content }}",
      name: "={{ $('Setup Build strategic base payload').first().json.drive_file_name }}",
      driveId: { __rl: true, mode: "list", value: "My Drive", cachedResultName: "My Drive" },
      folderId: {
        __rl: true,
        mode: "id",
        value: "={{ $('Setup Build strategic base payload').first().json.folder_id || 'root' }}",
        cachedResultName: "Setup project folder",
      },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
  };
  const setupSaveBaseArtifact = supabaseNode(
    "Setup Save strategic base artifact",
    "create",
    "crew_artifacts",
    [
      { fieldId: "artifact_id", fieldValue: "={{ $('Setup Build strategic base payload').first().json.artifact_id }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Setup Build strategic base payload').first().json.job_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Setup Build strategic base payload').first().json.project_slug }}" },
      { fieldId: "path", fieldValue: "={{ $('Setup Build strategic base payload').first().json.path }}" },
      { fieldId: "status", fieldValue: "ready" },
      { fieldId: "content_type", fieldValue: "text/markdown" },
      { fieldId: "content", fieldValue: "={{ $('Setup Build strategic base payload').first().json.content }}" },
    ],
    [3000, 40],
    { node: { continueOnFail: true, retryOnFail: false } },
  );
  const setupBuildDocumentIndex = codeNode(
    "Setup Build document index payload",
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return {}; }
}
const payload = $('Setup Build strategic base payload').first().json || {};
const drive = readNode('Setup Create strategic base Markdown');
const drive_file_id = drive.id || drive.fileId || drive.file_id || '';
const drive_url = drive.webViewLink || drive.webContentLink || drive.url || (drive_file_id ? 'https://drive.google.com/file/d/' + drive_file_id + '/view' : '');
return [{ json: {
  ...payload,
  storage_provider: 'google_drive',
  document_type: 'strategic_base',
  status: drive_file_id ? 'ready' : 'saved_without_drive',
  drive_file_id,
  drive_url,
  metadata: {
    folder_id: payload.folder_id || '',
    folder_url: payload.folder_url || '',
    folder_registry: payload.project_folder_registry || {},
    folder_urls: payload.project_folder_urls || {},
    generated_by: 'project_setup'
  }
} }];`,
    [3300, 40],
  );
  const setupIndexBaseDoc = supabaseNode(
    "Setup Index strategic base document",
    "create",
    "crew_documents",
    [
      { fieldId: "document_id", fieldValue: "={{ $('Setup Build document index payload').first().json.document_id }}" },
      { fieldId: "project_slug", fieldValue: "={{ $('Setup Build document index payload').first().json.project_slug }}" },
      { fieldId: "job_id", fieldValue: "={{ $('Setup Build document index payload').first().json.job_id }}" },
      { fieldId: "artifact_id", fieldValue: "={{ $('Setup Build document index payload').first().json.artifact_id }}" },
      { fieldId: "storage_provider", fieldValue: "={{ $('Setup Build document index payload').first().json.storage_provider }}" },
      { fieldId: "path", fieldValue: "={{ $('Setup Build document index payload').first().json.path }}" },
      { fieldId: "title", fieldValue: "={{ $('Setup Build document index payload').first().json.title }}" },
      { fieldId: "document_type", fieldValue: "={{ $('Setup Build document index payload').first().json.document_type }}" },
      { fieldId: "status", fieldValue: "={{ $('Setup Build document index payload').first().json.status }}" },
      { fieldId: "content_type", fieldValue: "={{ $('Setup Build document index payload').first().json.content_type }}" },
      { fieldId: "drive_file_id", fieldValue: "={{ $('Setup Build document index payload').first().json.drive_file_id }}" },
      { fieldId: "drive_url", fieldValue: "={{ $('Setup Build document index payload').first().json.drive_url }}" },
      { fieldId: "metadata", fieldValue: "={{ $('Setup Build document index payload').first().json.metadata }}" },
    ],
    [3600, 40],
    { node: { continueOnFail: true, retryOnFail: false } },
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
      { fieldId: "message", fieldValue: "={{ $('Quick Async Router').first().json.should_setup ? 'Projet créé : dossier Drive, structure canonique et base stratégique initiale créés. Le worker prépare la base profonde.' : 'Chantier créé. Le worker agentique va prendre le relais.' }}" },
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
          project_folder_id: "={{ $('Quick Async Router').first().json.should_setup ? ($('Setup Build strategic base payload').first().json.folder_id || '') : '' }}",
          project_folder_registry: "={{ $('Quick Async Router').first().json.should_setup ? ($('Setup Build strategic base payload').first().json.project_folder_registry || {}) : {} }}",
          project_folder_urls: "={{ $('Quick Async Router').first().json.should_setup ? ($('Setup Build strategic base payload').first().json.project_folder_urls || {}) : {} }}",
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
    `function readNode(name) {
  try { return $(name).first().json || {}; } catch (error) { return {}; }
}
const job = $('Quick Async Router').first().json;
const setup = job.should_setup ? readNode('Setup Build document index payload') : {};
const lines = job.should_setup
  ? [
      "C'est créé et lancé.",
      "",
      "Projet : **" + job.project_name + "**.",
      "Dossier Drive : " + (setup.folder_url || "créé, lien en cours d'indexation"),
      "Base stratégique : " + (setup.drive_url || "créée en Markdown, lien en cours d'indexation"),
      "Structure canonique : créée dans le dossier Drive.",
      "",
      "Identifiant du chantier : **" + job.job_id + "**.",
      "",
      "Les agents travaillent maintenant en arrière-plan à partir de cette base. Tu peux me demander l'avancement avec cet identifiant."
    ]
  : [
      "C'est lancé.",
      "",
      "Identifiant du chantier : **" + job.job_id + "**.",
      "",
      "Les agents vont travailler en arrière-plan et produire le livrable demandé. Tu peux me demander l'avancement avec cet identifiant."
    ];
return [{ json: { output: lines.join('\\n'), job_id: job.job_id, project_slug: job.project_slug, status: 'queued', is_safe_public_response: true } }];`,
    [760, -320],
  );
  return {
    router,
    statusRoute,
    setupRoute,
    loadStatusJobs,
    selectStatusJob,
    loadStatusProgress,
    loadStatusAgentRuns,
    loadStatusDocuments,
    formatStatus,
    setupEnsureProject,
    setupCreateJob,
    setupCreateFolder,
    setupStructureFolderNodes,
    setupBuildStructureRegistry,
    setupBuildInitialFiles,
    setupCreateInitialFiles,
    setupBuildBasePayload,
    setupCreateBaseDoc,
    setupSaveBaseArtifact,
    setupBuildDocumentIndex,
    setupIndexBaseDoc,
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
  const projectBlock = `\n\nMODELE OPERATOIRE DES PROJETS\nCrew_System n'est attaché à aucune personne précise. L'utilisateur peut être n'importe qui. Le projet actif est l'unité de travail.\n\nDéfinition d'un projet :\n- un project_slug stable ;\n- un nom lisible ;\n- une base stratégique ;\n- un dossier Google Drive ;\n- des documents Markdown lisibles ;\n- des jobs, décisions, artifacts et événements dans Supabase ;\n- une mémoire opérationnelle liée au projet, pas à une personne par défaut.\n\nRègles strictes :\n- Ne suppose jamais que l'utilisateur est une personne, une marque ou un projet donné.\n- Ne cite jamais un projet historique comme contexte par défaut.\n- Résous d'abord le projet actif avant tout travail durable.\n- Si le projet est ambigu, pose une seule question claire pour choisir ou créer le projet.\n- Si le projet est nouveau, propose de créer le projet puis son dossier documentaire.\n- Si le projet existe mais n'a pas de base stratégique, la prochaine étape logique est de créer ou compléter cette base.\n- Si la demande est lourde et que le project_slug n'est pas résolu, ne lance pas cs_async_start_job. Demande d'abord le projet actif.\n- Quand tu appelles cs_async_start_job, project_slug est obligatoire.\n\nGoogle Drive :\n- Avant de créer un document ou une base, cherche le dossier projet avec cs_drive_search_project_folders.\n- Si aucun dossier fiable n'existe et que le projet doit être structuré, crée-le avec cs_drive_create_project_folder.\n- Ne crée pas de doublon si un dossier projet existe déjà.\n- Crée uniquement des documents Markdown lisibles et utiles pour l'utilisateur.\n\nSupabase :\n- Utilise Supabase pour l'état opérationnel : projets, jobs, décisions, progression, artifacts et index documentaire.\n- Utilise Google Drive pour les documents lisibles.\n\nFin de réponse :\n- Pour toute réponse importante, indique la prochaine étape logique de façon simple.\n- Ne montre jamais JSON brut, prompts internes, traces techniques ou raisonnement caché.`;
  const legacyPersonalName = "Kou" + "dous";
  const legacyFullName = legacyPersonalName + " DA" + "OUDA";
  const legacyProjectTitle = "Le " + ("Ro" + "bot");
  const legacyProjectSlug = "le_" + ("ro" + "bot");
  const legacyProjectFullSlug = legacyPersonalName.toLowerCase() + "_da" + "ouda_" + legacyProjectSlug;
  const legacyProjectBlockTitle = "COUCHE CONTEXTE OBLIGATOIRE - PROJET " + legacyProjectTitle.toUpperCase();
  let cleaned = String(systemMessage || "")
    .replace(/(?:^|\n\n)MODE ASYNCHRONE OBLIGATOIRE[\s\S]*?(?=\n\nMODELE OPERATOIRE DES PROJETS|\n\nOUTILS SUPABASE DISPONIBLES|\n\nOUTILS GOOGLE DRIVE DISPONIBLES|$)/, "")
    .replace(/(?:^|\n\n)MODELE OPERATOIRE DES PROJETS[\s\S]*?(?=\n\nMODE ASYNCHRONE OBLIGATOIRE|\n\nOUTILS SUPABASE DISPONIBLES|\n\nOUTILS GOOGLE DRIVE DISPONIBLES|$)/, "")
    .replace(/(?:^|\n\n)SUITE LOGIQUE - BASE STRATEGIQUE[\s\S]*?(?=\n\nREGLE D'AMBIGUITE PROJET|\n\nMODE ASYNCHRONE OBLIGATOIRE|\n\nOUTILS SUPABASE DISPONIBLES|\n\nOUTILS GOOGLE DRIVE DISPONIBLES|$)/, "")
    .replace(new RegExp("(?:^|\\n\\n)" + legacyProjectBlockTitle + "[\\s\\S]*?(?=\\n\\nREGLE STRICTE HOOKS \\+ STRATEGIE|\\n\\nOUTILS SUPABASE DISPONIBLES|\\n\\nOUTILS GOOGLE DRIVE DISPONIBLES|$)"), "")
    .replace(new RegExp("\\b" + legacyProjectFullSlug + "\\b", "gi"), "le projet actif")
    .replace(new RegExp("\\b" + legacyProjectSlug + "\\b", "gi"), "le projet actif")
    .replace(new RegExp("\\b" + legacyFullName + "\\b", "g"), "l'utilisateur")
    .replace(new RegExp("\\b" + legacyPersonalName + "\\b", "g"), "l'utilisateur")
    .replace(new RegExp("\\b" + legacyProjectTitle + "\\b", "g"), "le projet actif");
  const projectAmbiguityBlock = `\n\nREGLE D'AMBIGUITE PROJET\nSi la demande est durable mais que le projet actif n'est pas clair, ne liste pas les projets historiques par defaut. Demande simplement le nom ou le slug du projet, ou propose de creer un nouveau projet. Liste les projets existants uniquement si l'utilisateur demande explicitement la liste.`;
  const strategicBaseBuilderBlock = `\n\nSUITE LOGIQUE - BASE STRATEGIQUE\nQuand un projet vient d'être créé, ou quand il n'a pas encore de base stratégique fiable, la prochaine étape normale est de construire une base stratégique profonde.\n\nProcess attendu :\n1. Résoudre ou créer le projet actif.\n2. Créer ou retrouver son dossier Google Drive.\n3. Créer une base stratégique initiale Markdown lisible si elle n'existe pas.\n4. Lancer le chantier \`strategic_base_builder\` pour produire la base profonde avec File Architect, Strategist, Audience Psychologist et Growth Hacker.\n\nLa base stratégique profonde doit cadrer : positionnement, cible, psychologie, offre, promesse, preuves, piliers de contenu, boucles growth, risques, documents à maintenir et questions restantes.\n\nNe présente jamais cette étape comme optionnelle si l'utilisateur veut construire un projet durablement : guide-le vers elle simplement.`;
  const blocks = `${projectBlock}${strategicBaseBuilderBlock}${projectAmbiguityBlock}${asyncBlock}`;
  if (cleaned.includes("OUTILS SUPABASE DISPONIBLES")) {
    return cleaned.replace("\n\nOUTILS SUPABASE DISPONIBLES", `${blocks}\n\nOUTILS SUPABASE DISPONIBLES`);
  }
  return `${cleaned}${blocks}`;
}

function publicResponseLeakGuardCode() {
  return `const item = $input.first();
function asText(value) {
  return String(value ?? '').trim();
}
function normalizePublic(text) {
  return asText(text)
    .replace(/^\\s*(?:final answer|final response|response|answer|réponse finale|reponse finale)\\s*[:\\-]\\s*/i, '')
    .replace(/^[\\"'“”]+|[\\"'“”]+$/g, '')
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim();
}
if (item.json.is_safe_public_response === true) {
  return [{ json: { output: normalizePublic(item.json.output ?? item.json.public_candidate ?? item.json.text) } }];
}
let output = normalizePublic(item.json.public_candidate ?? item.json.output ?? item.json.text);
const fallbackNeedsProject = [
  "Je peux lancer ce chantier, mais il me manque le projet actif.",
  "",
  "Donne-moi le nom ou le slug du projet, puis je crée ou retrouve son espace de travail avant de lancer les agents."
].join('\\n');
const fallbackGeneric = "Je garde les notes internes hors du chat. Reformule-moi le projet actif et le livrable attendu, puis je reprends proprement.";
const internalPattern = /(?:request_message|User wants|User asked|User is asking|The request is|This is a|Response Strategy|\\bAsk\\s*:|\\bResponse\\s*:|Final plan|Acknowledge|Ask for|Ask the user|Next step|Next action|Goal\\s*:|Context\\s*:|Constraints?\\s*:|Draft\\s*\\d*|Final Polish|Self-Correction|Final check|Structure of (?:my|the) response|The response looks solid|I\\s+(?:should|will|would|need|have to|must|can now|can't)|Wait\\b|Maybe\\b|Actually\\b|Let's\\b|tool returned|workflow JSON|n8n-nodes|system instructions?|developer message|scratchpad|internal reasoning|reasoning trace|chain of thought|format_valid|invalid_reasons?|missing_required_fields|raw_output|parse_strategy|objet JSON|JSON valide|credential|api key|token|provider|backend|sub-agent|sous-agent)/i;
const englishMetaPattern = /(?:^|\\b)(?:Present|Group|Highlight|Briefly|Add|Tell him|Question|Expected Output|Check JSON|No internal details|Natural French|Exactly \\d+|Public response|Technical note|Agent Choice|Tool call|Workflow|Silent Expansion|Direct Diagnosis|Strategic Shift|Psychological Angle|What to avoid|The Pivot|The Core Concept|The Language|List the existing projects)(?:\\b|$)/i;
const legacyName = 'Kou' + 'dous';
const legacyFull = legacyName + ' DA' + 'OUDA';
const legacyTitle = 'Le ' + ('Ro' + 'bot');
const legacySlug = 'le_' + ('ro' + 'bot');
const legacyFullSlug = legacyName.toLowerCase() + '_da' + 'ouda_' + legacySlug;
const legacyPublicPattern = new RegExp('\\\\b(?:' + [legacySlug, legacyFullSlug, legacyName, legacyFull, legacyTitle].join('|') + ')\\\\b', 'i');
const frenchSignal = /(?:[àâçéèêëîïôùûüÿœÀÂÇÉÈÊËÎÏÔÙÛÜŸŒ]|\\b(?:Je|Tu|Nous|Voici|Oui|Non|Pour|Dans|Sur|Avec|Sans|Donne|Partage|Projet|projet|stratégie|strategie|calendrier|livrable|cible|objectif|chantier|espace|travail|document|agents|créer|creer|lancer|réponse|reponse|étape|etape|dossier)\\b)/;
function isJsonish(text) {
  return /^\\s*[\\[{]/.test(text) || /"(?:output|tool|rows|credentials?|nodes?|connections?|format_valid|invalid_reasons)"\\s*:/.test(text);
}
function isMetaLine(line) {
  const cleaned = line
    .replace(/^\\s*[*-]\\s+/, '')
    .replace(/^\\s*\\d+[.)]\\s+/, '')
    .trim();
  if (!cleaned) return true;
  if (internalPattern.test(cleaned) || englishMetaPattern.test(cleaned) || legacyPublicPattern.test(cleaned) || isJsonish(cleaned)) return true;
  if (/^(?:Who|What|Why|How|When|Where|The|This|It|No|Check|Maybe|Actually|Acknowledge|Ask|Tell|Add|Group|Present)\\b/i.test(cleaned) && !frenchSignal.test(cleaned)) return true;
  if (/^\\*?Wait\\*?/i.test(cleaned)) return true;
  if (/^[-*]\\s+/.test(line) && !frenchSignal.test(cleaned)) return true;
  return false;
}
function stripMeta(text) {
  let value = normalizePublic(text)
    .replace(/\\r/g, '')
    .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, '')
    .replace(/\\*Wait\\*[\\s\\S]*$/i, '')
    .trim();
  const responseMarker = value.match(/(?:Final plan\\s*:\\s*)?Response\\s*:\\s*/i);
  if (responseMarker && responseMarker.index >= 0) {
    value = value.slice(responseMarker.index + responseMarker[0].length).trim();
  }
  const lines = value
    .split(/\\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isMetaLine(line))
    .map((line) => line.replace(/^\\s*[*]\\s+/, '').trim());
  const deduped = [];
  const seen = new Set();
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[\\s.,;:!?'"*\\-]+/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(line);
    }
  }
  return normalizePublic(deduped.join('\\n'));
}
function quotedCandidates(text) {
  const matches = [];
  const regex = /"([^"]{40,3000})"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}
function scoreCandidate(text) {
  const cleaned = normalizePublic(text);
  if (!cleaned || isJsonish(cleaned) || legacyPublicPattern.test(cleaned)) return -100000;
  let score = cleaned.length;
  if (frenchSignal.test(cleaned)) score += 500;
  if (/^(?:Je|Tu|Voici|C'est|Pour|Donne|Partage|Oui|Non)\\b/i.test(cleaned)) score += 400;
  if (internalPattern.test(cleaned) || englishMetaPattern.test(cleaned)) score -= 5000;
  return score;
}
const quoted = quotedCandidates(output);
const rawLooksInternal = internalPattern.test(output) || englishMetaPattern.test(output) || /["“”].{20,}["“”][\\s\\S]*["“”].{20,}["“”]/.test(output);
const candidatePool = rawLooksInternal && quoted.length ? quoted : [output, ...quoted];
const candidates = candidatePool
  .map(stripMeta)
  .filter(Boolean)
  .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
output = candidates[0] || '';
const requestLooksHeavyWithoutProject = /(?:arri[eè]re[- ]plan|strat[eé]gie compl[eè]te|calendrier|livrable|batch|document markdown)/i.test(asText(item.json.output ?? item.json.text ?? ''));
if (!output || scoreCandidate(output) < 0 || internalPattern.test(output) || englishMetaPattern.test(output) || isJsonish(output)) {
  output = requestLooksHeavyWithoutProject ? fallbackNeedsProject : fallbackGeneric;
}
return [{ json: { output } }];`;
}

function patchPublicResponseLeakGuard(workflow) {
  const guard = workflow.nodes.find((node) => node.name === "Public Response Leak Guard");
  if (!guard) return workflow;
  guard.parameters = guard.parameters || {};
  guard.parameters.jsCode = publicResponseLeakGuardCode();
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
    "Route Project Setup Request?",
    "Setup Ensure crew_project",
    "Setup Create async crew_job",
    "Setup Create project folder",
    ...projectStructureNodeNames(),
    ...PROJECT_INITIAL_FILE_NODE_NAMES,
    "Setup Build project structure registry",
    "Setup Build strategic base payload",
    "Setup Create strategic base Markdown",
    "Setup Save strategic base artifact",
    "Setup Build document index payload",
    "Setup Index strategic base document",
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
    fast.setupRoute,
    fast.setupEnsureProject,
    fast.setupCreateJob,
    fast.setupCreateFolder,
    ...fast.setupStructureFolderNodes,
    fast.setupBuildStructureRegistry,
    fast.setupBuildInitialFiles,
    fast.setupCreateInitialFiles,
    fast.setupBuildBasePayload,
    fast.setupCreateBaseDoc,
    fast.setupSaveBaseArtifact,
    fast.setupBuildDocumentIndex,
    fast.setupIndexBaseDoc,
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
      [{ node: fast.setupRoute.name, type: "main", index: 0 }],
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
  mainWorkflow.connections[fast.setupRoute.name] = {
    main: [
      [{ node: fast.setupEnsureProject.name, type: "main", index: 0 }],
      [{ node: fast.route.name, type: "main", index: 0 }],
    ],
  };
  mainWorkflow.connections[fast.setupEnsureProject.name] = {
    main: [[{ node: fast.setupCreateJob.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.setupCreateJob.name] = {
    main: [[{ node: fast.setupCreateFolder.name, type: "main", index: 0 }]],
  };
  const firstSetupStructureNode = fast.setupStructureFolderNodes[0]?.name || fast.setupBuildStructureRegistry.name;
  mainWorkflow.connections[fast.setupCreateFolder.name] = {
    main: [[{ node: firstSetupStructureNode, type: "main", index: 0 }]],
  };
  for (let index = 0; index < fast.setupStructureFolderNodes.length; index += 1) {
    const current = fast.setupStructureFolderNodes[index];
    const next = fast.setupStructureFolderNodes[index + 1] || fast.setupBuildStructureRegistry;
    mainWorkflow.connections[current.name] = {
      main: [[{ node: next.name, type: "main", index: 0 }]],
    };
  }
  mainWorkflow.connections[fast.setupBuildStructureRegistry.name] = {
    main: [[{ node: fast.setupBuildInitialFiles.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.setupBuildInitialFiles.name] = {
    main: [[{ node: fast.setupCreateInitialFiles.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.setupCreateInitialFiles.name] = {
    main: [[{ node: fast.setupBuildBasePayload.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.setupBuildBasePayload.name] = {
    main: [[{ node: fast.setupCreateBaseDoc.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.setupCreateBaseDoc.name] = {
    main: [[{ node: fast.setupSaveBaseArtifact.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.setupSaveBaseArtifact.name] = {
    main: [[{ node: fast.setupBuildDocumentIndex.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.setupBuildDocumentIndex.name] = {
    main: [[{ node: fast.setupIndexBaseDoc.name, type: "main", index: 0 }]],
  };
  mainWorkflow.connections[fast.setupIndexBaseDoc.name] = {
    main: [[{ node: fast.addProgress.name, type: "main", index: 0 }]],
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
