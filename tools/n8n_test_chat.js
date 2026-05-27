const fs = require("fs");

const CHAT_WEBHOOK_PATH = "/webhook/ee878550-a9f0-4a64-a501-a14917ec4418/chat";

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
  const message =
    process.argv.slice(2).join(" ") ||
    "Lance en arrière-plan un chantier complet Le Robot : stratégie Facebook et LinkedIn, psychologie audience, growth, hooks et livrable final Markdown. Ne fais pas tout dans le chat.";
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = (env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("Missing n8n URL.");
  const sessionId = `codex_async_${Date.now()}`;
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${CHAT_WEBHOOK_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sendMessage", chatInput: message, sessionId }),
  });
  const text = await response.text();
  console.log(`status=${response.status}`);
  console.log(`duration_ms=${Date.now() - startedAt}`);
  console.log(`session_id=${sessionId}`);
  console.log(text.slice(0, 5000));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
