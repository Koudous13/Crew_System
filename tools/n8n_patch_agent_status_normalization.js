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

function patchValidator(workflow) {
  const node = workflow.nodes.find((candidate) => candidate.name === "Validate Agent Response");
  if (!node?.parameters?.jsCode) return false;
  if (node.parameters.jsCode.includes("ready_to_handoff")) return false;

  const before = "if(String(parsed.status || '').toLowerCase() === 'completed') parsed.status = 'success';";
  const after = "const normalizedStatus = String(parsed.status || '').toLowerCase(); if(['completed','ready','ok','done'].includes(normalizedStatus)) parsed.status = 'success';";
  const currentArray = "['completed','ready','ok','done']";
  const updatedArray = "['completed','ready','ready_to_handoff','ok','done']";
  if (node.parameters.jsCode.includes(currentArray)) {
    node.parameters.jsCode = node.parameters.jsCode.replaceAll(currentArray, updatedArray);
    return true;
  }
  if (node.parameters.jsCode.includes(before)) {
    node.parameters.jsCode = node.parameters.jsCode.replace(before, after.replace(currentArray, updatedArray));
    return true;
  }
  if (!node.parameters.jsCode.includes(before)) {
    throw new Error(`${workflow.name}: validator normalization anchor not found.`);
  }
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  for (const agent of AGENTS) {
    const workflow = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${agent.id}`);
    const changed = patchValidator(workflow);
    if (changed) {
      await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${agent.id}`, {
        method: "PUT",
        body: JSON.stringify(workflowUpdatePayload(workflow)),
      });
    }
    console.log(`${agent.name}: ${changed ? "patched" : "already_ok"}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
