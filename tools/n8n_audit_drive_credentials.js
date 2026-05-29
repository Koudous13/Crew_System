const fs = require("fs");

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
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const payload = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows?limit=100");
  const workflows = payload.data || payload;
  const rows = [];
  for (const listed of workflows) {
    const workflow = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${listed.id}`);
    for (const node of workflow.nodes || []) {
      if (!String(node.type || "").toLowerCase().includes("googledrive")) continue;
      const credential = node.credentials?.googleDriveOAuth2Api || {};
      rows.push({
        workflow: workflow.name,
        workflow_id: workflow.id,
        active: Boolean(workflow.active),
        node: node.name,
        node_type: node.type,
        credential_id: credential.id || "",
        credential_name: credential.name || "",
      });
    }
  }
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
