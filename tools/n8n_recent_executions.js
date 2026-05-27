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
  const workflowId = process.argv[2] || "U3eGOTVq0DenA2pm";
  const limit = Number(process.argv[3] || 6);
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  const workflowFilter = workflowId === "all" ? "" : `workflowId=${encodeURIComponent(workflowId)}&`;
  const list = await n8nFetch(baseUrl, apiKey, `/api/v1/executions?${workflowFilter}limit=${limit}&includeData=true`);
  const rows = list.data || list.results || [];
  for (const execution of rows) {
    console.log(`--- execution ${execution.id} status=${execution.status} finished=${execution.finished} mode=${execution.mode} started=${execution.startedAt} stopped=${execution.stoppedAt}`);
    const runData = execution.data?.resultData?.runData || execution.data?.executionData?.resultData?.runData || {};
    console.log(`nodes=${Object.keys(runData).join(", ")}`);
    for (const name of Object.keys(runData)) {
      if (/async|agent|directeur|worker|progress|job|workflow|guard|response|drive|document|artifact|final|error|watchdog/i.test(name)) {
        const last = runData[name]?.[runData[name].length - 1];
        const data = last?.data?.main?.[0]?.[0]?.json;
        if (data) console.log(`${name}: ${JSON.stringify(data).slice(0, 1200)}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
