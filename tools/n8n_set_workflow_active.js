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

async function main() {
  const [workflowId, action = "deactivate"] = process.argv.slice(2);
  if (!workflowId || !["activate", "deactivate"].includes(action)) {
    throw new Error("Usage: node tools/n8n_set_workflow_active.js <workflow_id> <activate|deactivate>");
  }
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");
  const result = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${workflowId}/${action}`, { method: "POST" });
  console.log(JSON.stringify({ ok: true, workflow_id: workflowId, action, active: result.active }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
