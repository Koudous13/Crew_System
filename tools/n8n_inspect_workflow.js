const fs = require("fs");

function loadEnv(path) {
  const content = fs.readFileSync(path, "utf8");
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

async function n8nFetch(baseUrl, apiKey, path) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    headers: { "X-N8N-API-KEY": apiKey },
  });
  if (!response.ok) {
    throw new Error(`n8n API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  const workflowId = process.argv[2] || "U3eGOTVq0DenA2pm";
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("N8N_BASE_URL/N8N_URL and N8N_API_KEY are required.");
  }

  const workflow = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${workflowId}`);
  const showAll = process.argv.includes("--all");
  const interesting = workflow.nodes.filter((node) => {
    if (showAll) return true;
    return (
      String(node.type).includes("toolWorkflow") ||
      node.name.startsWith("cs_agent_") ||
      node.name.startsWith("cs_supabase_") ||
      node.name.includes("Directeur") ||
      String(node.type).includes("agent") ||
      node.type === "n8n-nodes-base.executeWorkflow" ||
      node.type === "n8n-nodes-base.respondToWebhook"
    );
  });

  for (const node of interesting) {
    console.log(`--- ${node.name} | ${node.type} | v${node.typeVersion}`);
    console.log(JSON.stringify(node.parameters, null, 2).slice(0, 2600));
  }
  if (process.argv.includes("--connections")) {
    console.log("--- connections");
    console.log(JSON.stringify(workflow.connections, null, 2));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
