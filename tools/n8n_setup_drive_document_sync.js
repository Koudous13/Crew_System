const fs = require("fs");
const crypto = require("crypto");

const WORKFLOW_NAME = "CS_SYNC_DRIVE_DOCUMENT_ROW";
const WEBHOOK_PATH = "crew-system-drive-document-sync-6f17a91b";
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
    name: "Sync Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 1,
    position: [0, 0],
    webhookId: WEBHOOK_PATH,
    parameters: {
      httpMethod: "POST",
      path: WEBHOOK_PATH,
      options: {},
    },
  };

  const normalize = codeNode(
    "Normalize Document Update",
    `const body = $json.body || $json;
const required = ['document_id', 'drive_file_id', 'drive_url'];
const missing = required.filter((key) => !body[key]);
if (missing.length) throw new Error('Missing required fields: ' + missing.join(', '));
return [{
  json: {
    document_id: body.document_id,
    drive_file_id: body.drive_file_id,
    drive_url: body.drive_url,
    status: body.status || 'ready',
    metadata: body.metadata || {},
  },
}];`,
    [280, 0],
  );

  const updateDocument = {
    id: nodeId(),
    name: "Update crew_document",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [560, 0],
    parameters: {
      resource: "row",
      operation: "update",
      tableId: "crew_documents",
      dataToSend: "defineBelow",
      fieldsUi: {
        fieldValues: [
          { fieldId: "drive_file_id", fieldValue: "={{ $json.drive_file_id }}" },
          { fieldId: "drive_url", fieldValue: "={{ $json.drive_url }}" },
          { fieldId: "status", fieldValue: "={{ $json.status }}" },
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

  const respond = {
    id: nodeId(),
    name: "Respond Sync",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
    position: [840, 0],
    parameters: {
      respondWith: "json",
      responseBody: "={{ JSON.stringify({ ok: true, document_id: $json.document_id, drive_file_id: $json.drive_file_id }) }}",
      options: {},
    },
  };

  return {
    name: WORKFLOW_NAME,
    nodes: [webhook, normalize, updateDocument, respond],
    connections: {
      [webhook.name]: { main: [[{ node: normalize.name, type: "main", index: 0 }]] },
      [normalize.name]: { main: [[{ node: updateDocument.name, type: "main", index: 0 }]] },
      [updateDocument.name]: { main: [[{ node: respond.name, type: "main", index: 0 }]] },
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
  console.log(`sync_workflow=${workflowId}`);
  console.log(`webhook=${baseUrl.replace(/\/$/, "")}/webhook/${WEBHOOK_PATH}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
