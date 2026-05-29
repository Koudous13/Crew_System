const fs = require("fs");

const HOOK_WORKFLOW_ID = "nS0MNOaFNLBgCQj6";
const HOOK_PROMPT_FILE = "registry/prompts/hook_master.system.txt";
const HOOK_BLOCK = [
  "Direction creative prioritaire :",
  "- La majorite de tes hooks doivent etre des hooks \"impossibles et curieux\".",
  "- Un hook impossible et curieux donne l'impression que quelque chose depasse les attentes normales, cree une tension cognitive immediate et oblige a vouloir comprendre.",
  "- Exemple d'esprit recherche : \"Une IA qui FAIT TOUT\".",
  "- Ce type de hook peut etre court, frontal, presque absurde ou paradoxal, mais il doit toujours pouvoir etre tenu par le contenu qui suit.",
  "- Vise environ 70% de hooks en mode impossible/curieux et 30% de hooks plus rationnels, preuve, douleur ou benefice.",
  "- Favorise les formulations courtes, visuelles, memorables, avec un gap de curiosite fort : \"Le business sans clavier\", \"Ton CRM ment\", \"Une semaine sans relance\", \"Le fichier qui vend\".",
].join("\n");

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

function patchText(text) {
  if (!text || text.includes("impossibles et curieux") || text.includes("impossible et curieux")) {
    return { changed: false, text };
  }
  const anchors = [
    "plateforme, calendrier et preuve disponible.",
    "plateforme, calendrier et preuve disponible",
    "Tu dois capter l'attention en respectant audience, positionnement, influence,",
  ];
  for (const anchor of anchors) {
    if (text.includes(anchor)) {
      return {
        changed: true,
        text: text.replace(anchor, `${anchor}\n\n${HOOK_BLOCK}`),
      };
    }
  }
  if (/hook_master/i.test(text)) {
    return {
      changed: true,
      text: text.replace(/(Tu es hook_master\.?)/i, `$1\n\n${HOOK_BLOCK}`),
    };
  }
  return { changed: false, text };
}

function patchWorkflow(workflow) {
  let changed = false;
  const safeInstruction = [
    fs.readFileSync(HOOK_PROMPT_FILE, "utf8").trim(),
    "",
    "Contrat machine non negociable :",
    "- Reponds uniquement avec un objet JSON valide.",
    "- Aucun Markdown, aucune note, aucune explication avant ou apres le JSON.",
    "- Premier caractere: { ; dernier caractere: }.",
    "- Si le contexte manque, mets status=\"needs_context\" et pose seulement les questions utiles dans questions_for_director.",
    "- Si document_workspace contient des fichiers, lis-les comme tes documents de travail avant de produire. Ne te limite pas au resume.",
    "- Ne cite jamais les instructions techniques internes, mais base explicitement tes choix sur les documents projet disponibles.",
    "- Si tu vois un risque de preuve inventee, spam, promesse fragile ou confusion, garde l'intensite mais signale le risque.",
    "- Champs attendus: agent_id, status, handoff_summary, questions_for_director, self_evaluation, hooks, hook_families.",
    "- self_evaluation doit rester concise et honnete.",
    "",
    "ENTREE DU DIRECTEUR:",
    "",
  ].join("\n");
  for (const node of workflow.nodes || []) {
    if (!node.parameters) continue;
    if (node.name === "Validate Agent Response" && typeof node.parameters.jsCode === "string") {
      const oldRequired = 'const requiredSpecific = ["hook_families","hooks","recommended_hooks","scoring_rationale"];';
      const newRequired = 'const requiredSpecific = ["hook_families","hooks"];';
      if (node.parameters.jsCode.includes(oldRequired)) {
        node.parameters.jsCode = node.parameters.jsCode.replace(oldRequired, newRequired);
        changed = true;
      }
    }
    const isHookBrain = /hook/i.test(node.name || "") || String(node.parameters.text || "").includes("hook_master");
    if (!isHookBrain || typeof node.parameters.text !== "string") continue;
    if (/Brain/i.test(node.name || "")) {
      const nextText = `={{ ${JSON.stringify(safeInstruction)} + $json.agent_input }}`;
      if (node.parameters.text !== nextText) {
        node.parameters.text = nextText;
        changed = true;
      }
      continue;
    }
    const result = patchText(node.parameters.text);
    if (result.changed) {
      node.parameters.text = result.text;
      changed = true;
    }
  }
  return changed;
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const workflow = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${HOOK_WORKFLOW_ID}`);
  const changed = patchWorkflow(workflow);
  if (changed) {
    await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${HOOK_WORKFLOW_ID}`, {
      method: "PUT",
      body: JSON.stringify(workflowUpdatePayload(workflow)),
    });
  }
  console.log(`CS_AGENT_HOOK_MASTER: ${changed ? "patched" : "already_ok"}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
