const fs = require("fs");

const SYNC_WEBHOOK_PATH = "/webhook/crew-system-drive-document-sync-6f17a91b";
const NODE_NAME = "Build Document Updates";

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

async function n8nFetch(baseUrl, apiKey, path) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    headers: { "X-N8N-API-KEY": apiKey },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const executionId = process.argv[2];
  if (!executionId) throw new Error("Usage: node tools/n8n_sync_drive_updates_from_execution.js <execution_id>");

  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = (env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST || "").replace(/\/$/, "");
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const execution = await n8nFetch(baseUrl, apiKey, `/api/v1/executions/${executionId}?includeData=true`);
  const resultData = execution.data?.resultData || execution.data?.executionData?.resultData || {};
  const runs = resultData.runData?.[NODE_NAME];
  if (!runs?.length) throw new Error(`Node not found in execution: ${NODE_NAME}`);
  const items = runs[runs.length - 1]?.data?.main?.[0] || [];
  const updates = items.map((item) => item.json || {}).filter((row) => row.document_id && row.drive_file_id);
  if (!updates.length) throw new Error("No document updates found.");

  const results = [];
  for (const update of updates) {
    const response = await fetch(`${baseUrl}${SYNC_WEBHOOK_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Sync failed for ${update.document_id}: ${response.status} ${text}`);
    results.push({ document_id: update.document_id, drive_file_id: update.drive_file_id, response: text.slice(0, 500) });
  }

  console.log(JSON.stringify({ ok: true, synced_count: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
