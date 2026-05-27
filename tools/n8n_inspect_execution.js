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
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const executionId = process.argv[2];
  if (!executionId) throw new Error("Usage: node tools/n8n_inspect_execution.js <execution_id>");
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  const execution = await n8nFetch(baseUrl, apiKey, `/api/v1/executions/${executionId}?includeData=true`);
  console.log(`execution=${execution.id} status=${execution.status} finished=${execution.finished}`);
  const resultData = execution.data?.resultData || execution.data?.executionData?.resultData || {};
  if (resultData.error) {
    console.log("--- error");
    console.log(JSON.stringify(resultData.error, null, 2));
  }
  const runData = resultData.runData || {};
  for (const [nodeName, runs] of Object.entries(runData)) {
    const last = runs[runs.length - 1] || {};
    console.log(`--- node=${nodeName} status=${last.executionStatus || ""}`);
    if (last.error) console.log(JSON.stringify(last.error, null, 2));
    const data = last.data?.main?.[0]?.[0]?.json;
    if (data) console.log(JSON.stringify(data, null, 2).slice(0, 6000));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
