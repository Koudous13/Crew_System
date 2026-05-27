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

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = (env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST || "").replace(/\/$/, "");
  if (!baseUrl || !env.N8N_API_KEY) throw new Error("Missing n8n URL or API key.");

  const response = await fetch(`${baseUrl}/api/v1/workflows?limit=100`, {
    headers: { "X-N8N-API-KEY": env.N8N_API_KEY },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text}`);
  const payload = JSON.parse(text);
  const workflows = payload.data || payload;
  for (const workflow of workflows) {
    console.log(`${workflow.id} | ${workflow.name} | ${workflow.active ? "active" : "inactive"}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
