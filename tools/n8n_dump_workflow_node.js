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
  const workflowId = process.argv[2];
  const nodeName = process.argv.slice(3).join(" ");
  if (!workflowId || !nodeName) throw new Error("Usage: node tools/n8n_dump_workflow_node.js <workflow_id> <node name>");
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/workflows/${workflowId}`, {
    headers: { "X-N8N-API-KEY": env.N8N_API_KEY },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status}: ${text}`);
  const workflow = JSON.parse(text);
  const node = workflow.nodes.find((candidate) => candidate.name === nodeName);
  if (!node) throw new Error(`Node not found: ${nodeName}`);
  console.log(JSON.stringify(node, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
