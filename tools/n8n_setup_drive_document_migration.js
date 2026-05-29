const fs = require("fs");
const crypto = require("crypto");

const WORKFLOW_NAME = "CS_MIGRATE_DRIVE_DOCUMENTS";
const WEBHOOK_PATH = "crew-system-drive-migration-9d4f0c8b";
const SUPABASE_CREDENTIAL = { id: "OMiEiywYcayYYI4W", name: "Supabase Crew System" };
const GOOGLE_DRIVE_CREDENTIAL = { id: "fXAOobHIOV39kLNd", name: "Google Drive Crew System" };
const LEGACY_PROJECT_SLUG = process.env.CREW_LEGACY_PROJECT_SLUG || "legacy_project";

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

function nodeId() {
  return crypto.randomUUID();
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
    waitBetweenTries: 1500,
  };
}

function getAllNode(name, tableId, filterString, position) {
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
      returnAll: true,
      filterType: "string",
      filterString,
    },
    credentials: { supabaseApi: SUPABASE_CREDENTIAL },
    alwaysOutputData: true,
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

function buildWorkflow() {
  const webhook = {
    id: nodeId(),
    name: "Migration Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1,
    position: [0, 0],
    webhookId: WEBHOOK_PATH,
    parameters: {
      path: WEBHOOK_PATH,
      options: {
        responseData: "{\"status\":\"migration_started\"}",
      },
    },
  };

  const loadDocuments = getAllNode(
    "Load crew_documents",
    "crew_documents",
    `project_slug=eq.${LEGACY_PROJECT_SLUG}`,
    [280, -140],
  );
  const loadArtifacts = getAllNode(
    "Load crew_artifacts",
    "crew_artifacts",
    `project_slug=eq.${LEGACY_PROJECT_SLUG}`,
    [560, -140],
  );
  const buildItems = codeNode(
    "Build Migration Items",
    `function rows(name) {
  try { return $(name).all().map((item) => item.json || {}).filter((row) => Object.keys(row).length); }
  catch (error) { return []; }
}
function safeFileName(value) {
  return String(value || 'document.md')
    .replace(/[\\\\/:*?"<>|]+/g, '-')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 140);
}
const docs = rows('Load crew_documents')
  .filter((doc) => doc.project_slug === ${JSON.stringify(LEGACY_PROJECT_SLUG)})
  .filter((doc) => {
    const metadata = doc.metadata || {};
    const alreadyMigrated = metadata.migrated_to_credential === 'Google Drive Crew System' || Boolean(metadata.migrated_to_crew_drive_at);
    return doc.drive_file_id
      && doc.status !== 'migrated_to_crew_drive'
      && !alreadyMigrated;
  });
const artifacts = rows('Load crew_artifacts');
const artifactsById = new Map(artifacts.map((artifact) => [artifact.artifact_id, artifact]));
const artifactsByJobAndPath = new Map(artifacts.map((artifact) => [artifact.job_id + '|' + artifact.path, artifact]));
const migrationItems = [];
const skipped = [];
for (const doc of docs) {
  const artifact = artifactsById.get(doc.artifact_id) || artifactsByJobAndPath.get(doc.job_id + '|' + doc.path);
  const content = artifact?.content || '';
  if (!content.trim()) {
    skipped.push({ document_id: doc.document_id, reason: 'artifact_content_missing', old_drive_file_id: doc.drive_file_id, title: doc.title || doc.path });
    continue;
  }
  migrationItems.push({
    document_id: doc.document_id,
    artifact_id: doc.artifact_id,
    job_id: doc.job_id,
    project_slug: doc.project_slug,
    old_drive_file_id: doc.drive_file_id,
    old_drive_url: doc.drive_url,
    old_status: doc.status,
    path: doc.path,
    title: doc.title || doc.path || 'Crew_System document',
    new_file_name: safeFileName((doc.title || doc.path || doc.document_id) + '.md').replace(/\\.md\\.md$/i, '.md'),
    content,
    previous_metadata: doc.metadata || {},
    skipped,
  });
}
if (!migrationItems.length) {
  return [{ json: { no_items_to_migrate: true, skipped, migrated_count: 0 } }];
}
const nextItem = migrationItems[0];
nextItem.total_pending_before_run = migrationItems.length;
nextItem.remaining_pending_after_run = Math.max(0, migrationItems.length - 1);
return [{ json: nextItem }];`,
    [840, -140],
  );

  const routeItems = {
    id: nodeId(),
    name: "Has Items To Migrate?",
    type: "n8n-nodes-base.if",
    typeVersion: 1,
    position: [1120, -140],
    parameters: {
      conditions: {
        boolean: [
          { value1: "={{ !$json.no_items_to_migrate }}", value2: true },
        ],
      },
    },
  };

  const createDrive = {
    id: nodeId(),
    name: "Create Markdown In Crew Drive",
    type: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    position: [1400, -260],
    parameters: {
      resource: "file",
      operation: "createFromText",
      content: "={{ $json.content }}",
      name: "={{ $json.new_file_name }}",
      driveId: { __rl: true, mode: "list", value: "My Drive" },
      folderId: { __rl: true, mode: "list", value: "root", cachedResultName: "/ (Root folder)" },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
  };

  const buildUpdates = codeNode(
    "Build Document Updates",
    `const created = $input.all().map((item) => item.json || {});
const source = $('Build Migration Items').all().map((item) => item.json || {}).filter((item) => !item.no_items_to_migrate);
const rows = [];
for (let index = 0; index < created.length; index += 1) {
  const drive = created[index] || {};
  const original = source[index] || {};
  const new_drive_file_id = drive.id || drive.fileId || drive.file_id || '';
  const new_drive_url = drive.webViewLink || drive.webContentLink || drive.url || (new_drive_file_id ? 'https://drive.google.com/file/d/' + new_drive_file_id + '/view' : '');
  if (!original.document_id || !new_drive_file_id) continue;
  rows.push({
    document_id: original.document_id,
    project_slug: original.project_slug,
    job_id: original.job_id,
    title: original.title,
    old_drive_file_id: original.old_drive_file_id,
    old_drive_url: original.old_drive_url,
    drive_file_id: new_drive_file_id,
    drive_url: new_drive_url,
    status: 'ready',
    metadata: {
      ...(original.previous_metadata || {}),
      migrated_to_crew_drive_at: new Date().toISOString(),
      migrated_from_drive_file_id: original.old_drive_file_id,
      migrated_from_drive_url: original.old_drive_url,
      migrated_from_credential: 'Google Drive Marc Hgm',
      migrated_to_credential: 'Google Drive Crew System',
    },
  });
}
return rows.length ? rows.map((row) => ({ json: row })) : [{ json: { migrated_count: 0, no_updates: true } }];`,
    [1680, -260],
  );

  const updateDocument = supabaseNode(
    "Update crew_document",
    "update",
    "crew_documents",
    [
      { fieldId: "drive_file_id", fieldValue: "={{ $json.drive_file_id }}" },
      { fieldId: "drive_url", fieldValue: "={{ $json.drive_url }}" },
      { fieldId: "status", fieldValue: "={{ $json.status }}" },
      { fieldId: "metadata", fieldValue: "={{ $json.metadata }}" },
    ],
    [1960, -260],
    {
      parameters: {
        filterType: "string",
        filterString: "={{ 'document_id=eq.' + $json.document_id }}",
      },
    },
  );

  const summarize = codeNode(
    "Summarize Migration",
    `const updated = $input.all().map((item) => item.json || {}).filter((row) => row.document_id);
const allSource = $('Build Migration Items').all().map((item) => item.json || {});
const skipped = allSource.find((item) => Array.isArray(item.skipped))?.skipped || [];
return [{ json: {
  ok: true,
  migrated_count: updated.length,
  skipped_count: skipped.length,
  skipped,
  migrated: updated.map((row) => ({
    document_id: row.document_id,
    title: row.title,
    old_drive_file_id: row.old_drive_file_id,
    new_drive_file_id: row.drive_file_id,
    new_drive_url: row.drive_url,
  })),
} }];`,
    [2240, -260],
  );

  const noItems = codeNode(
    "No Items Summary",
    `return [{ json: { ok: true, migrated_count: 0, message: 'Aucun document a migrer.', skipped: $json.skipped || [] } }];`,
    [1400, 40],
  );

  const respond = {
    id: nodeId(),
    name: "Respond Migration Summary",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
    position: [2520, -120],
    parameters: {
      respondWith: "json",
      responseBody: "={{ JSON.stringify($json) }}",
      options: {},
    },
  };

  return {
    name: WORKFLOW_NAME,
    nodes: [webhook, loadDocuments, loadArtifacts, buildItems, routeItems, createDrive, buildUpdates, updateDocument, summarize, noItems, respond],
    connections: {
      [webhook.name]: { main: [[{ node: loadDocuments.name, type: "main", index: 0 }]] },
      [loadDocuments.name]: { main: [[{ node: loadArtifacts.name, type: "main", index: 0 }]] },
      [loadArtifacts.name]: { main: [[{ node: buildItems.name, type: "main", index: 0 }]] },
      [buildItems.name]: { main: [[{ node: routeItems.name, type: "main", index: 0 }]] },
      [routeItems.name]: {
        main: [
          [{ node: createDrive.name, type: "main", index: 0 }],
          [{ node: noItems.name, type: "main", index: 0 }],
        ],
      },
      [createDrive.name]: { main: [[{ node: buildUpdates.name, type: "main", index: 0 }]] },
      [buildUpdates.name]: { main: [[{ node: updateDocument.name, type: "main", index: 0 }]] },
      [updateDocument.name]: { main: [[{ node: summarize.name, type: "main", index: 0 }]] },
      [summarize.name]: { main: [[{ node: respond.name, type: "main", index: 0 }]] },
      [noItems.name]: { main: [[{ node: respond.name, type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
}

async function findWorkflow(baseUrl, apiKey) {
  const payload = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows?limit=100");
  return (payload.data || payload).find((workflow) => workflow.name === WORKFLOW_NAME);
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const workflow = buildWorkflow();
  const existing = await findWorkflow(baseUrl, apiKey);
  let saved;
  if (existing) {
    saved = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(workflowPayload(workflow)),
    });
  } else {
    saved = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows", {
      method: "POST",
      body: JSON.stringify(workflowPayload(workflow)),
    });
  }

  const workflowId = saved.id || existing?.id;
  try {
    await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${workflowId}/deactivate`, { method: "POST" });
  } catch (error) {
    if (!String(error.message).includes("not active")) throw error;
  }
  try {
    await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${workflowId}/activate`, { method: "POST" });
  } catch (error) {
    if (!String(error.message).includes("already active")) throw error;
  }
  console.log(`migration_workflow=${workflowId}`);
  console.log(`webhook=${baseUrl.replace(/\/$/, "")}/webhook/${WEBHOOK_PATH}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
