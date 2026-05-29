const fs = require("fs");
const crypto = require("crypto");

const MAIN_WORKFLOW_ID = "U3eGOTVq0DenA2pm";
const MODEL_NAME = "models/gemma-4-26b-a4b-it";
const GEMINI_CREDENTIAL = { id: "6zurYjB4y2MxpxXC", name: "Google Gemini(PaLM) Api account" };

const AGENTS = [
  {
    agentId: "calendar_architect",
    workflowName: "CS_AGENT_CALENDAR_ARCHITECT",
    toolName: "cs_agent_calendar_architect",
    promptFile: "registry/prompts/calendar_architect.system.txt",
    schemaFile: "registry/schemas/AnnualEditorialCalendar.schema.json",
    requiredSpecific: ["annual_editorial_calendar"],
    primaryField: "annual_editorial_calendar",
    summaryFields: ["handoff_summary", "annual_editorial_calendar"],
    description:
      "Construit le calendrier editorial annuel : arcs trimestriels, themes mensuels, semaines, objectifs psychologiques, growth et production. A appeler pour calendrier, planning ou sequence longue.",
    expectedFields:
      "agent_id, status, handoff_summary, questions_for_director, self_evaluation, annual_editorial_calendar",
    example: {
      agent_id: "calendar_architect",
      status: "success",
      handoff_summary: "Calendrier annuel structure en arcs trimestriels, mois et semaines actionnables.",
      questions_for_director: [],
      self_evaluation: {
        quality_score: 8,
        confidence_score: 8,
        weakest_point: "Les offres exactes restent a confirmer.",
        next_improvement: "Ajouter les temps forts commerciaux reels.",
      },
      annual_editorial_calendar: {
        calendar_id: "project_2026",
        year_strategy: "Installer le projet comme reference utile, credible et premium.",
        quarters: [
          {
            quarter: "Q1",
            role: "Installer la douleur et la promesse.",
            months: [
              {
                month: "Janvier",
                theme: "Sortir du chaos operationnel.",
                weeks: [
                  {
                    week: 1,
                    angle: "Le business donne des devoirs.",
                    psychological_goal: "Faire ressentir le cout du manuel.",
                    growth_mechanism: "Conversation commentaire diagnostic.",
                    platform_focus: "Facebook emotion, LinkedIn ROI.",
                    assets_to_create: ["post texte", "visuel contraste"],
                    measure: "commentaires qualifies",
                  },
                ],
              },
            ],
          },
        ],
        production_rules: ["Garder les champs semaine courts.", "Ne pas produire les posts finaux ici."],
      },
    },
  },
  {
    agentId: "facebook_native_agent",
    workflowName: "CS_AGENT_FACEBOOK_NATIVE",
    toolName: "cs_agent_facebook_native",
    promptFile: "registry/prompts/facebook_native_agent.system.txt",
    schemaFile: "registry/schemas/FacebookNativeStrategy.schema.json",
    requiredSpecific: ["facebook_strategy", "facebook_content_directions"],
    primaryField: "facebook_strategy",
    summaryFields: ["handoff_summary", "facebook_strategy", "facebook_content_directions"],
    description:
      "Adapte la strategie a Facebook : proximite, emotion, conversation, formats natifs, visuels utiles et dynamique communautaire. A appeler pour posts Facebook ou strategie Facebook.",
    expectedFields:
      "agent_id, status, handoff_summary, questions_for_director, self_evaluation, facebook_strategy, facebook_content_directions",
    example: {
      agent_id: "facebook_native_agent",
      status: "success",
      handoff_summary: "Facebook doit rendre la douleur operationnelle visible, simple et conversationnelle.",
      questions_for_director: [],
      self_evaluation: {
        quality_score: 8,
        confidence_score: 8,
        weakest_point: "Preuves client encore limitees.",
        next_improvement: "Collecter exemples avant/apres.",
      },
      facebook_strategy: {
        role: "Creer proximite, identification et conversations utiles.",
        emotional_triggers: ["fatigue du manuel", "envie de reprendre le controle", "soulagement"],
        native_formats: ["post histoire", "visuel contraste", "mini diagnostic", "video courte face camera"],
      },
      facebook_content_directions: {
        directions: [
          {
            angle: "Ton business te donne des devoirs.",
            why_it_works_on_facebook: "Phrase simple, emotion immediate, commentaire naturel.",
            conversation_target: "Faire citer les taches qui volent du temps.",
            visual_or_video_need: "Portrait sombre + phrase scroll-stopper courte.",
          },
        ],
      },
    },
  },
  {
    agentId: "linkedin_native_agent",
    workflowName: "CS_AGENT_LINKEDIN_NATIVE",
    toolName: "cs_agent_linkedin_native",
    promptFile: "registry/prompts/linkedin_native_agent.system.txt",
    schemaFile: "registry/schemas/LinkedInNativeStrategy.schema.json",
    requiredSpecific: ["linkedin_strategy", "linkedin_content_directions"],
    primaryField: "linkedin_strategy",
    summaryFields: ["handoff_summary", "linkedin_strategy", "linkedin_content_directions"],
    description:
      "Adapte la strategie a LinkedIn : autorite, preuve, point de vue, utilite professionnelle, reputation et conversion douce. A appeler pour posts LinkedIn ou strategie LinkedIn.",
    expectedFields:
      "agent_id, status, handoff_summary, questions_for_director, self_evaluation, linkedin_strategy, linkedin_content_directions",
    example: {
      agent_id: "linkedin_native_agent",
      status: "success",
      handoff_summary: "LinkedIn doit transformer le projet en preuve d'efficacite operationnelle, pas en simple expertise abstraite.",
      questions_for_director: [],
      self_evaluation: {
        quality_score: 8,
        confidence_score: 8,
        weakest_point: "Manque de cas chiffres.",
        next_improvement: "Ajouter captures ou mini etudes de cas.",
      },
      linkedin_strategy: {
        role: "Construire autorite, confiance et demande qualifiee.",
        point_of_view: "L'automatisation n'est pas un luxe technique, c'est une hygiene operationnelle.",
        proof_needed: ["process avant/apres", "temps gagne observe", "capture de workflow anonymisee"],
      },
      linkedin_content_directions: {
        directions: [
          {
            angle: "Un dirigeant ne devrait pas gerer ses relances a la main.",
            why_it_works_on_linkedin: "Parle productivite, responsabilite et ROI.",
            professional_conversation_target: "Faire reagir les fondateurs sur les taches non scalables.",
            required_proof: "Exemple de workflow ou mini cas.",
          },
        ],
      },
    },
  },
  {
    agentId: "copywriter",
    workflowName: "CS_AGENT_COPYWRITER",
    toolName: "cs_agent_copywriter",
    promptFile: "registry/prompts/copywriter.system.txt",
    schemaFile: "registry/schemas/ContentUnits.schema.json",
    requiredSpecific: ["content_units"],
    primaryField: "content_units",
    summaryFields: ["handoff_summary", "content_units"],
    description:
      "Redige les contenus finaux alignes avec strategie, audience, plateforme, calendrier, growth et hooks. A appeler apres strategie/hook/platforme pour produire posts, scripts ou captions.",
    expectedFields:
      "agent_id, status, handoff_summary, questions_for_director, self_evaluation, content_units",
    example: {
      agent_id: "copywriter",
      status: "success",
      handoff_summary: "Contenus finaux prets a reviser, avec hooks, corps, CTA et notes de risque.",
      questions_for_director: [],
      self_evaluation: {
        quality_score: 8,
        confidence_score: 8,
        weakest_point: "Preuves chiffrees non disponibles.",
        next_improvement: "Ajouter resultats reels quand disponibles.",
      },
      content_units: {
        units: [
          {
            platform: "Facebook",
            format: "post texte",
            hook: "Ton business te donne des devoirs.",
            body: "Chaque relance manuelle, chaque tableau recopie, chaque email repete est une micro-fuite de temps.",
            cta: "Commente AUDIT si tu veux identifier les taches a automatiser.",
            risk_flags: ["Ne pas promettre un resultat chiffre sans preuve."],
          },
        ],
      },
    },
  },
  {
    agentId: "creative_director",
    workflowName: "CS_AGENT_CREATIVE_DIRECTOR",
    toolName: "cs_agent_creative_director",
    promptFile: "registry/prompts/creative_director.system.txt",
    schemaFile: "registry/schemas/CreativeDirection.schema.json",
    requiredSpecific: ["creative_direction"],
    primaryField: "creative_direction",
    summaryFields: ["handoff_summary", "creative_direction"],
    description:
      "Decide si un visuel est utile et produit une direction creative exploitable : scroll-stopper, brief visuel, assets, limites de preuve. A appeler pour visuels/images/videos.",
    expectedFields:
      "agent_id, status, handoff_summary, questions_for_director, self_evaluation, creative_direction",
    example: {
      agent_id: "creative_director",
      status: "success",
      handoff_summary: "Direction visuelle minimaliste : portrait du porteur, tension courte, palette du projet.",
      questions_for_director: [],
      self_evaluation: {
        quality_score: 8,
        confidence_score: 8,
        weakest_point: "Bibliotheque photo limitee.",
        next_improvement: "Prevoir variations portrait et banniere.",
      },
      creative_direction: {
        visual_role: "Arreter le scroll et amplifier la tension du hook.",
        style_rules: ["peu de texte", "photo presente", "contraste bleu profond/vert menthe", "preuve visuelle quand possible"],
        briefs: [
          {
            format: "Facebook square",
            headline: "Ton business te donne des devoirs.",
            composition: "Portrait sombre en fond, cercle menthe dans l'angle droit, texte blanc massif.",
            assets_needed: ["photo portrait", "palette du projet"],
            avoid: ["trop de texte", "fausse preuve", "decoration gratuite"],
          },
        ],
      },
    },
  },
];

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

function nodeId() {
  return crypto.randomUUID();
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
  if (!response.ok) throw new Error(`n8n API ${response.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function workflowPayload(workflow) {
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections || {},
    settings: workflow.settings || { executionOrder: "v1" },
  };
}

function codeNode(name, jsCode, position) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: { jsCode },
  };
}

function triggerNode(name, position) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.executeWorkflowTrigger",
    typeVersion: 1.1,
    position,
    parameters: { inputSource: "passthrough" },
  };
}

function stickyNote(name, content, position, size = [520, 320], color = 5) {
  return {
    id: nodeId(),
    name,
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position,
    parameters: { content, width: size[0], height: size[1], color },
  };
}

function modelNode(name, position, temperature) {
  return {
    id: nodeId(),
    name,
    type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
    typeVersion: 1,
    position,
    parameters: {
      modelName: MODEL_NAME,
      options: { temperature },
    },
    credentials: { googlePalmApi: GEMINI_CREDENTIAL },
  };
}

function prepareInputCode(agentId) {
  return `const raw = $input.first().json || {};
const query = raw.query || raw || {};
function clean(value) {
  return String(value ?? '')
    .replace(/[{}]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}
function cleanBlock(value) {
  return String(value ?? '')
    .replace(/\\r/g, '')
    .replace(/\\n{4,}/g, '\\n\\n\\n')
    .trim();
}
const lines = [
  'agent_id: ${agentId}',
  'user_request: ' + clean(query.user_request),
  'project_slug: ' + clean(query.project_slug),
  'normalized_brief: ' + clean(query.normalized_brief),
  'context_summary: ' + clean(query.context_summary),
  'document_workspace:\\n' + cleanBlock(query.document_workspace),
  'previous_agent_outputs: ' + clean(query.previous_agent_outputs),
  'platform_context: ' + clean(query.platform_context),
  'constraints: ' + clean(query.constraints),
  'expected_output: ' + clean(query.expected_output),
  'language: ' + clean(query.language || 'francais'),
];
return [{ json: { agent_input: lines.join('\\n'), query } }];`;
}

function validateCode(agent) {
  return `const item = $input.first();
const rawValue = item.json.output ?? item.json.text ?? item.json.response ?? item.json;
const expectedAgentId = ${JSON.stringify(agent.agentId)};
const requiredCommon = ['agent_id','status','handoff_summary','questions_for_director','self_evaluation'];
const requiredSpecific = ${JSON.stringify(agent.requiredSpecific)};

function cleanRaw(value) {
  return String(value || '')
    .replace(/^\\s*\\x60{3}(?:json)?\\s*/i, '')
    .replace(/\\x60{3}\\s*$/i, '')
    .trim();
}

function tryParse(value) {
  try { return JSON.parse(value); } catch (error) { return null; }
}

function extractBalancedObjects(text) {
  const objects = [];
  const source = cleanRaw(text);
  for (let start = 0; start < source.length; start++) {
    if (source[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < source.length; i++) {
      const char = source[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          const parsed = tryParse(source.slice(start, i + 1));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) objects.push(parsed);
          break;
        }
      }
    }
  }
  return objects;
}

function parseJson(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { value, strategy: 'already_object' };
  const cleaned = cleanRaw(value);
  const direct = tryParse(cleaned);
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) return { value: direct, strategy: 'direct' };
  const objects = extractBalancedObjects(cleaned);
  const matching = [...objects].reverse().find((object) => object.agent_id === expectedAgentId) || objects[objects.length - 1];
  if (matching) return { value: matching, strategy: 'balanced_extract' };
  return { value: null, strategy: 'failed' };
}

function normalize(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
  if (!parsed.agent_id) parsed.agent_id = expectedAgentId;
  const normalizedStatus = String(parsed.status || '').toLowerCase();
  if (['completed','ready','ready_to_handoff','ok','done'].includes(normalizedStatus)) parsed.status = 'success';
  if (!parsed.status) parsed.status = 'success';
  if (typeof parsed.self_evaluation === 'string') {
    parsed.self_evaluation = {
      quality_score: 7,
      confidence_score: 7,
      weakest_point: parsed.self_evaluation,
      next_improvement: 'A preciser au prochain passage.'
    };
  }
  if (!parsed.self_evaluation || typeof parsed.self_evaluation !== 'object' || Array.isArray(parsed.self_evaluation)) {
    parsed.self_evaluation = {
      quality_score: 7,
      confidence_score: 7,
      weakest_point: 'Auto-evaluation manquante.',
      next_improvement: 'Renseigner une auto-evaluation plus precise.'
    };
  }
  if (!Array.isArray(parsed.questions_for_director)) {
    parsed.questions_for_director = parsed.questions_for_director ? [String(parsed.questions_for_director)] : [];
  }
  if (!parsed.handoff_summary) {
    parsed.handoff_summary = 'Sortie exploitable par le Directeur, a synthetiser avant affichage utilisateur.';
  }
  if (String(parsed.status || '').toLowerCase() === 'needs_context') {
    for (const key of requiredSpecific) {
      if (!(key in parsed)) parsed[key] = {};
    }
  }
  return parsed;
}

function isEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

const parsedResult = parseJson(rawValue);
const parsed = normalize(parsedResult.value);
const missing = [];
const invalidReasons = [];

if (!parsed) {
  invalidReasons.push('Aucun objet JSON valide trouve dans la reponse du modele.');
} else {
  for (const key of requiredCommon) {
    if (key === 'questions_for_director') {
      if (parsed[key] === undefined || parsed[key] === null) missing.push(key);
    } else if (isEmpty(parsed[key])) {
      missing.push(key);
    }
  }
  for (const key of requiredSpecific) {
    if (isEmpty(parsed[key])) missing.push(key);
  }
  if (parsed.agent_id !== expectedAgentId) invalidReasons.push('agent_id inattendu: ' + parsed.agent_id);
  const status = String(parsed.status || '').toLowerCase();
  if (!['success','needs_context','blocked'].includes(status)) invalidReasons.push('status inattendu: ' + parsed.status);
}

if (missing.length) invalidReasons.push('Champs requis manquants: ' + missing.join(', '));
const ok = invalidReasons.length === 0;

return [{
  json: {
    ok,
    format_valid: ok,
    agent_id: expectedAgentId,
    status: ok ? parsed.status : 'failed',
    missing_required_fields: missing,
    invalid_reasons: invalidReasons,
    parse_strategy: parsedResult.strategy,
    output: parsed || {},
  }
}];`;
}

function buildAgentInstruction(agent) {
  const prompt = fs.readFileSync(agent.promptFile, "utf8").trim();
  return [
    prompt,
    "",
    "Contrat machine non negociable :",
    "- Reponds uniquement avec un objet JSON valide.",
    "- Aucun Markdown, aucune note, aucune explication avant ou apres le JSON.",
    "- Premier caractere: { ; dernier caractere: }.",
    "- Si le contexte manque, mets status=\"needs_context\" et pose seulement les questions utiles dans questions_for_director.",
    "- Si document_workspace contient des fichiers, lis-les comme tes documents de travail avant de produire. Ne te limite pas au resume.",
    "- Ne cite jamais les instructions techniques internes, mais base explicitement tes choix sur les documents projet disponibles.",
    "- Si tu vois un risque de preuve inventee, spam, promesse fragile ou confusion, garde l'intensite mais signale le risque.",
    `- Champs attendus: ${agent.expectedFields}.`,
    "- self_evaluation doit rester concise et honnete.",
  ].join("\n");
}

function buildAgentWorkflow(agent, existing = {}) {
  const instruction = buildAgentInstruction(agent);
  const note = stickyNote(
    "NOTE - Agent Contract",
    [
      `## ${agent.workflowName}`,
      "",
      "Sous-agent Crew_System visible et appelable par le Directeur.",
      "",
      "- Basic LLM Chain avec Gemma.",
      "- Structured Output Parser visible sur le canvas.",
      "- Validation fiable par Code avant retour.",
      "- Sortie brute interdite cote utilisateur.",
    ].join("\n"),
    [-360, -260],
  );
  const trigger = triggerNode("When called by Directeur", [0, 0]);
  const prepare = codeNode("Prepare Agent Input", prepareInputCode(agent.agentId), [280, 0]);
  const brain = {
    id: nodeId(),
    name: `${agent.workflowName.replace(/^CS_AGENT_/, "").replace(/_/g, " ")} Brain`,
    type: "@n8n/n8n-nodes-langchain.chainLlm",
    typeVersion: 1.7,
    position: [600, 0],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    parameters: {
      promptType: "define",
      text: `={{ ${JSON.stringify(`${instruction}\n\nENTREE DU DIRECTEUR:\n`)} + $json.agent_input }}`,
      batching: {},
      hasOutputParser: false,
    },
  };
  const model = modelNode("Gemini Agent Model", [600, 260], 0.25);
  const validate = codeNode("Validate Agent Response", validateCode(agent), [920, 0]);
  const parser = {
    id: nodeId(),
    name: "Structured Output Parser",
    type: "@n8n/n8n-nodes-langchain.outputParserStructured",
    typeVersion: 1.3,
    position: [920, 260],
    parameters: {
      schemaType: "fromJson",
      jsonSchemaExample: JSON.stringify(agent.example, null, 2),
      autoFix: true,
      customizeRetryPrompt: true,
      prompt: [
        "Instructions:",
        "--------------",
        "{instructions}",
        "--------------",
        "Completion:",
        "--------------",
        "{completion}",
        "--------------",
        "",
        "The completion above did not satisfy the required structured output format.",
        "Error:",
        "--------------",
        "{error}",
        "--------------",
        "",
        "Repair the completion.",
        "Rules:",
        "- Return ONLY one valid JSON object.",
        "- The first character must be { and the last character must be }.",
        "- Remove every analysis, note, markdown, code fence, explanation, or text before/after the JSON.",
        "- Fill missing required fields with concise safe values based on the completion and instructions.",
        "",
        "Please try again. Respond only with JSON:",
      ].join("\n"),
    },
  };
  const autoFixModel = modelNode("Gemini AutoFix Model", [1180, 260], 0);

  return {
    ...existing,
    name: agent.workflowName,
    nodes: [note, trigger, prepare, brain, model, validate, parser, autoFixModel],
    connections: {
      [trigger.name]: { main: [[{ node: prepare.name, type: "main", index: 0 }]] },
      [prepare.name]: { main: [[{ node: brain.name, type: "main", index: 0 }]] },
      [model.name]: { ai_languageModel: [[{ node: brain.name, type: "ai_languageModel", index: 0 }]] },
      [brain.name]: { main: [[{ node: validate.name, type: "main", index: 0 }]] },
    },
    settings: { ...(existing.settings || {}), executionOrder: "v1" },
  };
}

function commonAgentInputSchema() {
  return JSON.stringify({
    type: "object",
    properties: {
      project_slug: { type: "string", description: "Slug du projet si connu." },
      user_request: { type: "string", description: "Demande utilisateur ou mission precise pour le sous-agent." },
      normalized_brief: { type: "string", description: "Brief normalise ou resume du projet." },
      context_summary: { type: "string", description: "Contexte lu depuis Supabase, Drive ou conversation." },
      document_workspace: { type: "string", description: "Fichiers projet autorises charges pour cet agent, avec contenu lisible." },
      previous_agent_outputs: { type: "string", description: "Synthese des sorties des agents deja appeles." },
      platform_context: { type: "string", description: "Plateformes concernees : Facebook, LinkedIn, cross-platform." },
      constraints: { type: "string", description: "Contraintes business, ton, risques, periode, formats, volume." },
      expected_output: { type: "string", description: "Ce que le Directeur attend exactement de ce sous-agent." },
      language: { type: "string", description: "Langue de sortie, par defaut francais." },
    },
    required: ["user_request"],
    additionalProperties: false,
  });
}

function toolWorkflowNode(agent, workflowId, index) {
  return {
    id: nodeId(),
    name: agent.toolName,
    type: "@n8n/n8n-nodes-langchain.toolWorkflow",
    typeVersion: 1.3,
    position: [2060 + (index % 3) * 310, 1120 + Math.floor(index / 3) * 160],
    parameters: {
      name: agent.toolName,
      description: agent.description,
      workflowId: {
        __rl: true,
        mode: "id",
        value: workflowId,
        cachedResultName: agent.workflowName,
      },
      specifyInputSchema: true,
      schemaType: "manual",
      inputSchema: commonAgentInputSchema(),
    },
  };
}

function updateDirectorPrompt(systemMessage) {
  const block = [
    "",
    "SOUS-AGENTS PRODUCTION DISPONIBLES",
    "Tu disposes maintenant de sous-agents specialises pour transformer la strategie en calendrier, plateformes, contenus finaux et direction creative.",
    "",
    "Regles de routage :",
    "- cs_agent_calendar_architect : calendrier editorial annuel, sequence mensuelle/hebdomadaire, logique de campagne longue.",
    "- cs_agent_facebook_native : adaptation Facebook, proximite, emotion, conversation, formats natifs Facebook.",
    "- cs_agent_linkedin_native : adaptation LinkedIn, autorite, preuve, point de vue professionnel, conversion douce.",
    "- cs_agent_copywriter : redaction finale de posts/scripts/captions apres strategie, audience, hooks et plateforme.",
    "- cs_agent_creative_director : briefs visuels, direction image/video, scroll-stoppers, assets manquants et limites de preuve.",
    "",
    "Ordre recommande pour produire du contenu : strategist -> audience_psychologist -> growth_hacker -> hook_master -> platform native -> copywriter -> creative_director.",
    "Pour les demandes lourdes, garde le mode asynchrone obligatoire : lance un job au lieu d'appeler tous les agents dans le chat.",
    "Ne montre jamais les sorties JSON des sous-agents. Transforme tout en reponse humaine ou en document Markdown lisible.",
  ].join("\n");
  const cleaned = systemMessage.replace(/\n\nSOUS-AGENTS PRODUCTION DISPONIBLES[\s\S]*?(?=\n\nOUTILS SUPABASE DISPONIBLES|\n\nOUTILS GOOGLE DRIVE DISPONIBLES|\n\nMODE ASYNCHRONE OBLIGATOIRE|$)/, "");
  if (cleaned.includes("OUTILS GOOGLE DRIVE DISPONIBLES")) {
    return cleaned.replace("\n\nOUTILS GOOGLE DRIVE DISPONIBLES", `\n${block}\n\nOUTILS GOOGLE DRIVE DISPONIBLES`);
  }
  if (cleaned.includes("MODE ASYNCHRONE OBLIGATOIRE")) {
    return cleaned.replace("\n\nMODE ASYNCHRONE OBLIGATOIRE", `\n${block}\n\nMODE ASYNCHRONE OBLIGATOIRE`);
  }
  return `${cleaned}\n${block}`;
}

function patchPublicResponseLeakGuard(mainWorkflow) {
  const guard = mainWorkflow.nodes.find((node) => node.name === "Public Response Leak Guard");
  if (!guard?.parameters?.jsCode) return;
  if (guard.parameters.jsCode.includes("crew_system_extra_leak_guard_v3")) return;

  const anchor = "let output = String(item.json.public_candidate ?? item.json.output ?? item.json.text ?? '').trim();";
  if (!guard.parameters.jsCode.includes(anchor)) {
    return;
  }

  guard.parameters.jsCode = guard.parameters.jsCode.replace(
    anchor,
    `${anchor}
// crew_system_extra_leak_guard_v2: remove director scratchpad lines before softer filtering.
output = output
  .replace(/(?:^|\\n)\\s*I(?:'ll| will| would| should| must| need to| have to| am)\\b[^\\n]*(?:\\n|$)/gi, '\\n')
  .replace(/(?:^|\\n)\\s*(?:Actually|Wait,|Maybe|The tool|The rules say|I can now)\\b[^\\n]*(?:\\n|$)/gi, '\\n')
  .replace(/(?:^|\\n)\\s*\\\"?I'll tell him:?[^\\n]*(?:\\n|$)/gi, '\\n')
  .trim();`,
  );

  const v3Anchor = "const fallback = \"Je garde les notes internes hors du chat. Donne-moi les ?l?ments importants et je structure la suite proprement.\";";
  if (!guard.parameters.jsCode.includes(v3Anchor)) {
    return;
  }
  guard.parameters.jsCode = guard.parameters.jsCode.replace(
    v3Anchor,
    `${v3Anchor}
// crew_system_extra_leak_guard_v3: preserve clean public Markdown after scratchpad removal.
const obviousInternalLeakEarly = /(?:I'll tell him|Actually|Wait,|The tool|The rules say|system instructions?|developer message|scratchpad|internal reasoning|reasoning trace|chain of thought|Draft\\s*\\d*|Final Polish|Self-Correction|tool returned|workflow JSON|format_valid|invalid_reasons?|missing_required_fields|raw_output|parse_strategy|objet JSON|JSON valide|\\bcredential\\b|\\bapi key\\b|\\btoken\\b|\\bprovider\\b|\\bbackend\\b)/i;
const looksLikePublicMarkdown = /^(?:#|Voici|Je|Tu|Ton|Ta|Le|La|Les|C'est|Pour|Dans|Sur|Avec|\\*\\*)/i.test(output.trim());
if (output && looksLikePublicMarkdown && !obviousInternalLeakEarly.test(output) && !/^\\s*[\\[{]/.test(output)) {
  return [{ json: { output } }];
}`,
  );
}

function patchMainWorkflow(mainWorkflow, workflowIdsByAgentId) {
  patchPublicResponseLeakGuard(mainWorkflow);
  const toolNames = new Set(AGENTS.map((agent) => agent.toolName));
  const nodes = mainWorkflow.nodes.filter((node) => !toolNames.has(node.name) && node.name !== "NOTE - Production Agent Tools");
  const note = stickyNote(
    "NOTE - Production Agent Tools",
    [
      "## Agents production",
      "",
      "Deuxieme vague de sous-agents visibles :",
      "- calendar_architect",
      "- facebook_native_agent",
      "- linkedin_native_agent",
      "- copywriter",
      "- creative_director",
      "",
      "Ces tools pointent vers des sub-workflows separes.",
    ].join("\n"),
    [1980, 860],
    [760, 230],
    4,
  );
  nodes.push(note);
  AGENTS.forEach((agent, index) => {
    nodes.push(toolWorkflowNode(agent, workflowIdsByAgentId[agent.agentId], index));
  });

  mainWorkflow.nodes = nodes;
  mainWorkflow.connections = mainWorkflow.connections || {};
  for (const toolName of toolNames) delete mainWorkflow.connections[toolName];

  const director = mainWorkflow.nodes.find((node) => node.name === "Directeur Crew_System");
  if (!director) throw new Error("Directeur Crew_System node not found.");
  director.parameters.options = director.parameters.options || {};
  director.parameters.options.systemMessage = updateDirectorPrompt(director.parameters.options.systemMessage || "");

  for (const agent of AGENTS) {
    mainWorkflow.connections[agent.toolName] = {
      ai_tool: [[{ node: director.name, type: "ai_tool", index: 0 }]],
    };
  }
  return mainWorkflow;
}

async function findWorkflowByName(baseUrl, apiKey, name) {
  const payload = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows?limit=100");
  const workflows = payload.data || payload;
  return workflows.find((workflow) => workflow.name === name) || null;
}

async function createOrUpdateAgent(baseUrl, apiKey, agent) {
  const existingRef = await findWorkflowByName(baseUrl, apiKey, agent.workflowName);
  if (existingRef?.id) {
    const existing = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${existingRef.id}`);
    await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${existingRef.id}`, {
      method: "PUT",
      body: JSON.stringify(workflowPayload(buildAgentWorkflow(agent, existing))),
    });
    return { id: existingRef.id, action: "updated" };
  }
  const saved = await n8nFetch(baseUrl, apiKey, "/api/v1/workflows", {
    method: "POST",
    body: JSON.stringify(workflowPayload(buildAgentWorkflow(agent))),
  });
  return { id: saved.id, action: "created" };
}

async function main() {
  const env = loadEnv("workspace/private/n8n_reference/.env");
  const baseUrl = env.N8N_BASE_URL || env.N8N_URL || env.N8N_HOST;
  const apiKey = env.N8N_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Missing n8n URL or API key.");

  const workflowIdsByAgentId = {};
  for (const agent of AGENTS) {
    const result = await createOrUpdateAgent(baseUrl, apiKey, agent);
    workflowIdsByAgentId[agent.agentId] = result.id;
    console.log(`${agent.workflowName}=${result.id} ${result.action}`);
  }

  const mainWorkflow = await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${MAIN_WORKFLOW_ID}`);
  const patchedMain = patchMainWorkflow(mainWorkflow, workflowIdsByAgentId);
  await n8nFetch(baseUrl, apiKey, `/api/v1/workflows/${MAIN_WORKFLOW_ID}`, {
    method: "PUT",
    body: JSON.stringify(workflowPayload(patchedMain)),
  });

  console.log("main_workflow=patched");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
