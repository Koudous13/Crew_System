const fs = require("fs");
const crypto = require("crypto");

const WORKFLOW_NAME = "TEMP_CREW_COPY_LEGACY_DRIVE_DOCUMENT";
const WEBHOOK_PATH = "crew-system-copy-legacy-drive-doc-2da81f4c";
const LEGACY_GOOGLE_DRIVE_CREDENTIAL = { id: "36SWGQsLOy8AtByx", name: "Google Drive Marc Hgm" };
const CREW_GOOGLE_DRIVE_CREDENTIAL = { id: "fXAOobHIOV39kLNd", name: "Google Drive Crew System" };
const SUPABASE_CREDENTIAL = { id: "OMiEiywYcayYYI4W", name: "Supabase Crew System" };

const DEFAULT_DOCUMENTS = [
  {
    document_id: "document_mpmusgn6_88fb74be",
    old_drive_file_id: "13ieBiE0xerer_aSRzco-jo_vpyMe0a4y",
    old_drive_url: "https://drive.google.com/file/d/13ieBiE0xerer_aSRzco-jo_vpyMe0a4y/view",
    title: "Crew_System - Livrable final - job_mpmum1xs_a8dcf94c",
  },
  {
    document_id: "document_mpmgbt0h_45f36fff",
    old_drive_file_id: "1oIhuHxh9zIiCERGkXfOs_A9XPV0KGm56",
    old_drive_url: "https://drive.google.com/file/d/1oIhuHxh9zIiCERGkXfOs_A9XPV0KGm56/view",
    title: "Analyse Psychologique de l'Audience - Le Chaos Operationnel",
  },
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
    name: "Copy Webhook",
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

  const downloadLegacy = {
    id: nodeId(),
    name: "Download Legacy Drive Document",
    type: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    position: [280, 0],
    parameters: {
      operation: "download",
      fileId: {
        __rl: true,
        mode: "id",
        value: "={{ $json.body.old_drive_file_id }}",
        cachedResultName: "legacy file",
      },
      options: {
        binaryPropertyName: "data",
        googleFileConversion: {
          conversion: {
            docsToFormat: "text/plain",
            slidesToFormat: "application/pdf",
          },
        },
        fileName: "legacy_document.txt",
      },
    },
    credentials: { googleDriveOAuth2Api: LEGACY_GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
  };

  const extractText = codeNode(
    "Extract Legacy Text",
    `function safeFileName(value) {
  return String(value || 'Crew_System document.md')
    .replace(/[\\\\/:*?"<>|]+/g, '-')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 140);
}
const body = $('Copy Webhook').first().json.body || {};
const binary = $input.first().binary?.data || {};
let content = '';
if (binary.data) {
  content = Buffer.from(binary.data, 'base64').toString('utf8');
}
if (!content.trim()) {
  throw new Error('Legacy Drive document is empty or could not be converted to text.');
}
return [{
  json: {
    ...body,
    content,
    new_file_name: safeFileName((body.title || body.document_id || 'Crew_System document') + '.md').replace(/\\.md\\.md$/i, '.md'),
    metadata: {
      migrated_to_crew_drive_at: new Date().toISOString(),
      migrated_from_drive_file_id: body.old_drive_file_id,
      migrated_from_drive_url: body.old_drive_url || (body.old_drive_file_id ? 'https://drive.google.com/file/d/' + body.old_drive_file_id + '/view' : ''),
      migrated_from_credential: 'Google Drive Marc Hgm',
      migrated_to_credential: 'Google Drive Crew System',
      migrated_via: 'legacy_drive_direct_copy',
    },
  },
}];`,
    [560, 0],
  );

  const createCrewDrive = {
    id: nodeId(),
    name: "Create Markdown In Crew Drive",
    type: "n8n-nodes-base.googleDrive",
    typeVersion: 3,
    position: [840, 0],
    parameters: {
      resource: "file",
      operation: "createFromText",
      content: "={{ $json.content }}",
      name: "={{ $json.new_file_name }}",
      driveId: { __rl: true, mode: "list", value: "My Drive" },
      folderId: { __rl: true, mode: "list", value: "root", cachedResultName: "/ (Root folder)" },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: CREW_GOOGLE_DRIVE_CREDENTIAL },
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
  };

  const buildUpdate = codeNode(
    "Build Supabase Update",
    `const source = $('Extract Legacy Text').first().json || {};
const drive = $input.first().json || {};
const drive_file_id = drive.id || drive.fileId || drive.file_id || '';
if (!source.document_id || !drive_file_id) {
  throw new Error('Missing document_id or new Drive file ID.');
}
return [{
  json: {
    document_id: source.document_id,
    drive_file_id,
    drive_url: drive.webViewLink || drive.webContentLink || drive.url || 'https://drive.google.com/file/d/' + drive_file_id + '/view',
    status: 'ready',
    metadata: source.metadata,
    title: source.title,
    old_drive_file_id: source.old_drive_file_id,
  },
}];`,
    [1120, 0],
  );

  const updateDocument = {
    id: nodeId(),
    name: "Update crew_document",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [1400, 0],
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

  const summarize = codeNode(
    "Return Copy Summary",
    `const updated = $input.first().json || {};
const source = $('Build Supabase Update').first().json || {};
return [{
  json: {
    ok: true,
    document_id: updated.document_id || source.document_id,
    title: updated.title || source.title,
    old_drive_file_id: source.old_drive_file_id,
    new_drive_file_id: source.drive_file_id,
    new_drive_url: source.drive_url,
  },
}];`,
    [1680, 0],
  );

  return {
    name: WORKFLOW_NAME,
    nodes: [webhook, downloadLegacy, extractText, createCrewDrive, buildUpdate, updateDocument, summarize],
    connections: {
      [webhook.name]: { main: [[{ node: downloadLegacy.name, type: "main", index: 0 }]] },
      [downloadLegacy.name]: { main: [[{ node: extractText.name, type: "main", index: 0 }]] },
      [extractText.name]: { main: [[{ node: createCrewDrive.name, type: "main", index: 0 }]] },
      [createCrewDrive.name]: { main: [[{ node: buildUpdate.name, type: "main", index: 0 }]] },
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
  const documents = onlyDocumentId
    ? DEFAULT_DOCUMENTS.filter((document) => document.document_id === onlyDocumentId)
    : DEFAULT_DOCUMENTS;
  if (process.argv.includes("--cleanup-only")) {
    const existing = await findWorkflow(baseUrl, apiKey);
    if (existing) await deleteWorkflow(baseUrl, apiKey, existing.id);
    console.log(JSON.stringify({ ok: true, cleanup_only: true, deleted_workflow_id: existing?.id || "" }, null, 2));
    return;
  }
  if (!documents.length) throw new Error(`No legacy document matched ${onlyDocumentId || "the default list"}.`);
  try {
    workflowId = await createWorkflow(baseUrl, apiKey);
    for (const document of documents) {
      const response = await fetch(`${baseUrl}/webhook/${WEBHOOK_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(document),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Copy failed for ${document.document_id}: ${response.status} ${text}`);
      results.push(text ? JSON.parse(text) : {});
    }
  } finally {
    if (!process.argv.includes("--keep-workflow")) await deleteWorkflow(baseUrl, apiKey, workflowId);
  }
  console.log(JSON.stringify({ ok: true, copied_count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
