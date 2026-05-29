const fs = require("fs");
const crypto = require("crypto");

const WORKFLOW_NAME = "TEMP_CREW_DELETE_LEGACY_DRIVE_FILES";
const WEBHOOK_PATH = "crew-system-delete-legacy-drive-file-1f917cc0";
const LEGACY_GOOGLE_DRIVE_CREDENTIAL = { id: "36SWGQsLOy8AtByx", name: "Google Drive Marc Hgm" };
const SUPABASE_CREDENTIAL = { id: "OMiEiywYcayYYI4W", name: "Supabase Crew System" };

const MIGRATED_LEGACY_FILES = [
  { document_id: "document_mpnwyl43_f73ce665", old_drive_file_id: "1dj4Bz3NmEjwKv7qJ_NmlK0iJkGhVDbq8" },
  { document_id: "document_mpnwq96q_80f01eb5", old_drive_file_id: "1-ckUMk3KQT0ygbWppF8E_3slJMI_pjb1" },
  { document_id: "document_mpnvmfco_536de63a", old_drive_file_id: "1bKTYsknE5BxPfUrOgksz101CeAr-nDNu" },
  { document_id: "document_mpnrzezq_43169084", old_drive_file_id: "1N5OUXbXn_aLynkRnwmbT2l2rYL4S37Y_" },
  { document_id: "document_mpnrvqbm_069f096a", old_drive_file_id: "1QZErmso3VC8ldH-3VRG_WCAO4jhQWFib" },
  { document_id: "document_mpnqeqkn_299b5fa3", old_drive_file_id: "1pmoKWrinivH82FyE9zCvl8HoVo_3eDXF" },
  { document_id: "document_mpn08p8x_39c3794d", old_drive_file_id: "1wbtDkFSRylVkPD8EK-bRNfSvEYGzRDyu" },
  { document_id: "document_mpmy8is6_2cdcfc0c", old_drive_file_id: "1dd6Ok7dFwSe7zo8mYaBR0HKk-i8ab-GW" },
  { document_id: "document_mpmxko79_b5ef4a71", old_drive_file_id: "1p_AgCrF153wKxqimXyw4e3uS_1W4zcEz" },
  { document_id: "document_mpmv9v9h_c6bf0662", old_drive_file_id: "1dbNHswcj9KesZZugFTWCa94h8SP_TM9J" },
  { document_id: "document_mpmusgn6_88fb74be", old_drive_file_id: "13ieBiE0xerer_aSRzco-jo_vpyMe0a4y" },
];

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
    name: "Delete Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1,
    position: [0, 0],
    webhookId: WEBHOOK_PATH,
    parameters: {
      httpMethod: "POST",
      path: WEBHOOK_PATH,
      responseMode: "lastNode",
      options: {},
    },
  };

  const loadDocument = {
    id: nodeId(),
    name: "Load crew_document",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [280, 0],
    parameters: {
      resource: "row",
      operation: "getAll",
      tableId: "crew_documents",
      returnAll: false,
      limit: 1,
      filterType: "string",
      filterString: "={{ 'document_id=eq.' + $json.body.document_id }}",
    },
    credentials: { supabaseApi: SUPABASE_CREDENTIAL },
    alwaysOutputData: true,
  };

  const deleteLegacyFile = {
    id: nodeId(),
    name: "Delete Legacy Drive File",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [560, 0],
    parameters: {
      method: "DELETE",
      url: "={{ 'https://www.googleapis.com/drive/v3/files/' + $('Delete Webhook').first().json.body.old_drive_file_id }}",
      authentication: "predefinedCredentialType",
      nodeCredentialType: "googleDriveOAuth2Api",
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: "supportsAllDrives", value: "true" },
        ],
      },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: LEGACY_GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
  };

  const buildUpdate = codeNode(
    "Build Supabase Delete Trace",
    `const body = $('Delete Webhook').first().json.body || {};
const row = $('Load crew_document').first().json || {};
if (!body.document_id || !body.old_drive_file_id) {
  throw new Error('Missing document_id or old_drive_file_id.');
}
const metadata = {
  ...(row.metadata || {}),
  migrated_from_drive_delete_status: 'deleted',
  migrated_from_drive_deleted_at: new Date().toISOString(),
  migrated_from_drive_deleted_file_id: body.old_drive_file_id,
};
return [{
  json: {
    document_id: body.document_id,
    old_drive_file_id: body.old_drive_file_id,
    current_drive_file_id: row.drive_file_id || '',
    current_drive_url: row.drive_url || '',
    metadata,
  },
}];`,
    [840, 0],
  );

  const updateDocument = {
    id: nodeId(),
    name: "Update crew_document",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [1120, 0],
    parameters: {
      resource: "row",
      operation: "update",
      tableId: "crew_documents",
      dataToSend: "defineBelow",
      fieldsUi: {
        fieldValues: [
          { fieldId: "metadata", fieldValue: "={{ $json.metadata }}" },
        ],
      },
      filterType: "string",
      filterString: "={{ 'document_id=eq.' + $json.document_id }}",
    },
    credentials: { supabaseApi: SUPABASE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1500,
  };

  const summarize = codeNode(
    "Return Delete Summary",
    `const source = $('Build Supabase Delete Trace').first().json || {};
const updated = $input.first().json || {};
return [{
  json: {
    ok: true,
    document_id: source.document_id,
    old_drive_file_id: source.old_drive_file_id,
    current_drive_file_id: source.current_drive_file_id || updated.drive_file_id || '',
    delete_status: updated.metadata?.migrated_from_drive_delete_status || 'deleted',
    deleted_at: updated.metadata?.migrated_from_drive_deleted_at || source.metadata?.migrated_from_drive_deleted_at || '',
  },
}];`,
    [1400, 0],
  );

  return {
    name: WORKFLOW_NAME,
    nodes: [webhook, loadDocument, deleteLegacyFile, buildUpdate, updateDocument, summarize],
    connections: {
      [webhook.name]: { main: [[{ node: loadDocument.name, type: "main", index: 0 }]] },
      [loadDocument.name]: { main: [[{ node: deleteLegacyFile.name, type: "main", index: 0 }]] },
      [deleteLegacyFile.name]: { main: [[{ node: buildUpdate.name, type: "main", index: 0 }]] },
      [buildUpdate.name]: { main: [[{ node: updateDocument.name, type: "main", index: 0 }]] },
      [updateDocument.name]: { main: [[{ node: summarize.name, type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
}

async function findWorkflow(baseUrl, apiKey) {
  const payload = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows?limit=100");
  return (payload.data || payload).find((workflow) => workflow.name === WORKFLOW_NAME);
}

async function createWorkflow(baseUrl, apiKey) {
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
    await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${workflowId}/activate`, { method: "POST" });
  } catch (error) {
    if (!String(error.message).includes("already active")) throw error;
  }
  return workflowId;
}

async function deleteWorkflow(baseUrl, apiKey, workflowId) {
  if (!workflowId) return;
  try {
    await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${workflowId}/deactivate`, { method: "POST" });
  } catch (error) {
    if (!String(error.message).includes("not active")) console.error(error.message);
  }
  try {
    await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${workflowId}`, { method: "DELETE" });
  } catch (error) {
    console.error(error.message);
  }
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = (env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST || "").replace(/\/$/, "");
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  let workflowId = "";
  const results = [];
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const onlyDocumentId = onlyArg ? onlyArg.slice("--only=".length) : "";
  const skipArg = process.argv.find((arg) => arg.startsWith("--skip="));
  const skipDocumentIds = new Set(skipArg ? skipArg.slice("--skip=".length).split(",").map((value) => value.trim()).filter(Boolean) : []);
  const files = onlyDocumentId
    ? MIGRATED_LEGACY_FILES.filter((file) => file.document_id === onlyDocumentId)
    : MIGRATED_LEGACY_FILES.filter((file) => !skipDocumentIds.has(file.document_id));
  if (!files.length) throw new Error(`No migrated legacy file matched ${onlyDocumentId || "the default list"}.`);
  try {
    workflowId = await createWorkflow(baseUrl, apiKey);
    for (const file of files) {
      const response = await fetch(`${baseUrl}/webhook/${WEBHOOK_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(file),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Delete failed for ${file.document_id}: ${response.status} ${text}`);
      results.push(text ? JSON.parse(text) : {});
    }
  } finally {
    if (!process.argv.includes("--keep-workflow")) await deleteWorkflow(baseUrl, apiKey, workflowId);
  }

  console.log(JSON.stringify({ ok: true, deleted_count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
