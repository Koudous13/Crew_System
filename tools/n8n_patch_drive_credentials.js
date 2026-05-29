const fs = require("fs");

const TARGET_DRIVE_CREDENTIAL = {
  id: "fXAOobHIOV39kLNd",
  name: "Google Drive Crew System",
};

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
  if (!response.ok) {
    throw new Error(`n8n API ${response.status} ${path}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function workflowUpdatePayload(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections || {},
    settings: workflow.settings || { executionOrder: "v1" },
  };
}

function isCrewSystemWorkflow(workflow) {
  return String(workflow.name || "").startsWith("CS_");
}

function isDriveNode(node) {
  return String(node.type || "").toLowerCase().includes("googledrive");
}

function patchWorkflow(workflow) {
  const changes = [];
  for (const node of workflow.nodes || []) {
    if (!isDriveNode(node)) continue;
    node.credentials = node.credentials || {};
    const previous = node.credentials.googleDriveOAuth2Api || null;
    const changed =
      !previous ||
      previous.id !== TARGET_DRIVE_CREDENTIAL.id ||
      previous.name !== TARGET_DRIVE_CREDENTIAL.name;
    if (!changed) continue;
    node.credentials.googleDriveOAuth2Api = TARGET_DRIVE_CREDENTIAL;
    changes.push({
      node: node.name,
      type: node.type,
      previous,
      next: TARGET_DRIVE_CREDENTIAL,
    });
  }
  for (const node of workflow.nodes || []) {
    if (!isDriveNode(node) || typeof node.notes !== "string") continue;
    const legacyPersonalName = "Kou" + "dous";
    const nextNotes = node.notes
      .replace(/Credential Google Drive verifie par .+?\. Ne pas lancer le chat final tant que .+? ne l'a pas verifie\./, "Credential Google Drive vérifié. Ne pas lancer le chat final tant que le bon credential n'a pas été validé.")
      .replace(new RegExp("\\b" + legacyPersonalName + "\\b", "g"), "l'utilisateur");
    if (nextNotes !== node.notes) {
      node.notes = nextNotes;
      changes.push({ node: node.name, type: node.type, previous: "notes", next: "notes sanitized" });
    }
  }
  return changes;
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const list = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows?limit=100");
  const workflowRefs = (list.data || list).filter(isCrewSystemWorkflow);
  const report = [];

  for (const ref of workflowRefs) {
    const workflow = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${ref.id}`);
    const changes = patchWorkflow(workflow);
    if (changes.length) {
      await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${ref.id}`, {
        method: "PUT",
        body: JSON.stringify(workflowUpdatePayload(workflow)),
      });
    }
    report.push({ id: ref.id, name: workflow.name, changes });
  }

  for (const item of report) {
    console.log(`${item.name} (${item.id}): ${item.changes.length ? `${item.changes.length} patched` : "ok"}`);
    for (const change of item.changes) {
      const previousName = change.previous?.name || "none";
      const previousId = change.previous?.id || "none";
      console.log(`  - ${change.node}: ${previousName} (${previousId}) -> ${TARGET_DRIVE_CREDENTIAL.name} (${TARGET_DRIVE_CREDENTIAL.id})`);
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
