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
  const [executionId, nodeName, outputIndexRaw = "0"] = process.argv.slice(2);
  if (!executionId || !nodeName) {
    throw new Error("Usage: node tools/n8n_dump_execution_node_items.js <execution_id> <node_name> [output_index]");
  }
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const execution = await n8nFetch(baseUrl, apiKey, `/api/v1/executions/${executionId}?includeData=true`);
  const resultData = execution.data?.resultData || execution.data?.executionData?.resultData || {};
  const runs = resultData.runData?.[nodeName];
  if (!runs?.length) throw new Error(`Node not found in execution: ${nodeName}`);
  const last = runs[runs.length - 1] || {};
  const outputIndex = Number(outputIndexRaw);
  const items = last.data?.main?.[outputIndex] || [];
  console.log(JSON.stringify(items.map((item) => item.json || {}), null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
