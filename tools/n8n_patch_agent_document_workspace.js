const fs = require("fs");

const AGENTS = [
  { id: "gnw2DA536SBmH12K", name: "CS_AGENT_FILE_ARCHITECT" },
  { id: "VXBmmqF8gIljYDsd", name: "CS_AGENT_STRATEGIST" },
  { id: "agRG9BP0CbQ11da0", name: "CS_AGENT_AUDIENCE_PSYCHOLOGIST" },
  { id: "tSVq9yKCwxLjjbiI", name: "CS_AGENT_GROWTH_HACKER" },
  { id: "nS0MNOaFNLBgCQj6", name: "CS_AGENT_HOOK_MASTER" },
  { id: "ZrYnC5h62cxTnNG7", name: "CS_AGENT_CALENDAR_ARCHITECT" },
  { id: "bMyHsvzbOcSq2er2", name: "CS_AGENT_FACEBOOK_NATIVE" },
  { id: "XIcYN5ox2pf8BXxr", name: "CS_AGENT_LINKEDIN_NATIVE" },
  { id: "wkpAuT6QUUbB5d8D", name: "CS_AGENT_COPYWRITER" },
  { id: "fcK2074Gtm0IDcsE", name: "CS_AGENT_CREATIVE_DIRECTOR" },
];

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

async function n8nFetch(baseUrl, apiKey, path, options = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`n8n API ${response.status} ${path}: ${body}`);
  return body ? JSON.parse(body) : {};
}

function workflowUpdatePayload(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections || {},
    settings: workflow.settings || { executionOrder: "v1" },
  };
}

function patchPrepareAgentInput(workflow) {
  const node = workflow.nodes.find((candidate) => candidate.name === "Prepare Agent Input");
  if (!node?.parameters?.jsCode) return { changed: false, reason: "missing_prepare_node" };
  if (node.parameters.jsCode.includes("document_workspace")) return { changed: false, reason: "already_ok" };

  let jsCode = node.parameters.jsCode;
  const cleanFunctionEnd = "    .trim();\n}";
  if (jsCode.includes("function clean(value)") && jsCode.includes(cleanFunctionEnd)) {
    jsCode = jsCode.replace(
      cleanFunctionEnd,
      `${cleanFunctionEnd}
function cleanBlock(value) {
  return String(value ?? '')
    .replace(/\\r/g, '')
    .replace(/\\n{4,}/g, '\\n\\n\\n')
    .trim();
}`,
    );
  }

  const contextLine = "  'context_summary: ' + clean(query.context_summary),";
  const insert = [
    contextLine,
    "  'document_workspace:\\\\n' + cleanBlock(query.document_workspace),",
    "  'document_reading_rule: lis document_workspace quand il existe; utilise les fichiers autorises charges avant de produire; si un fichier requis manque, pose une question au Directeur sans inventer.',",
  ].join("\n");
  if (!jsCode.includes(contextLine)) {
    return { changed: false, reason: "context_anchor_not_found" };
  }
  jsCode = jsCode.replace(contextLine, insert);
  node.parameters.jsCode = jsCode;
  return { changed: true, reason: "patched" };
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  for (const agent of AGENTS) {
    const workflow = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${agent.id}`);
    const result = patchPrepareAgentInput(workflow);
    if (result.changed) {
      await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${agent.id}`, {
        method: "PUT",
        body: JSON.stringify(workflowUpdatePayload(workflow)),
      });
    }
    console.log(`${agent.name}: ${result.reason}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
