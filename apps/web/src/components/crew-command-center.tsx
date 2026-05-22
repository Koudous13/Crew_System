"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  apiUrl,
  Artifact,
  ArtifactDocument,
  ApiMessage,
  Conversation,
  getJson,
  JobStatus,
  postJson,
  ProgressEvent,
  Project,
  StoredJob,
} from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  body: string;
};

type AgentProgress = {
  id: string;
  label: string;
  percent: number;
  status: string;
  lastMessage: string;
};

type ChatSendResponse = {
  conversation: Conversation;
  message: ApiMessage;
  assistant_message: ApiMessage;
  job: StoredJob | null;
  provider: string;
  run_async: boolean;
  mode?: "chat" | string;
};

const starterPrompt =
  "Je veux créer une stratégie complète pour un SaaS qui aide les coachs premium à vendre leurs accompagnements plus cher.";

const questionFlow = [
  {
    id: "profile-foundation",
    title: "Base stratégique",
    hint: "Quand le projet est encore flou.",
    prompt:
      "Je veux créer ou renforcer la base stratégique de mon projet. Pose-moi les bonnes questions, identifie ce qu'il manque, puis prépare la structure de travail.",
  },
  {
    id: "campaign-pack",
    title: "Pack stratégique",
    hint: "Positionnement, audience, influence, growth.",
    prompt:
      "Crée le campaign pack complet pour ce projet : diagnostic, audience, positionnement, influence, growth, plateformes et risques à surveiller.",
  },
  {
    id: "annual-calendar",
    title: "Calendrier annuel",
    hint: "La carte éditoriale sur 1 an.",
    prompt:
      "Crée le calendrier éditorial annuel détaillé pour ce projet, avec les piliers, les angles, les temps forts, les objectifs et les séquences par période.",
  },
  {
    id: "weekly-batch",
    title: "Semaine de contenus",
    hint: "Posts prêts à relire.",
    prompt:
      "Génère les contenus de la prochaine semaine pour Facebook et LinkedIn. Respecte la stratégie, consulte les agents nécessaires, puis écris un fichier lisible avec les publications prêtes à relire.",
  },
  {
    id: "visuals-video",
    title: "Visuels et vidéos",
    hint: "Quand il faut enrichir les posts.",
    prompt:
      "À partir du batch de contenus, propose les visuels, carrousels ou scripts vidéo nécessaires. Garde le branding du projet et explique ce qui mérite vraiment un visuel.",
  },
  {
    id: "revision",
    title: "Révision",
    hint: "Pour durcir un livrable.",
    prompt:
      "Relis le dernier livrable important, détecte ce qui est trop générique, trop faible ou risqué, puis propose une version plus forte sans perdre la stratégie.",
  },
  {
    id: "performance",
    title: "Performance",
    hint: "Après des résultats terrain.",
    prompt:
      "Analyse les performances disponibles, distingue les vrais signaux du bruit, puis propose les décisions à prendre pour la prochaine itération.",
  },
];

export function CrewCommandCenter() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(starterPrompt);
  const [job, setJob] = useState<StoredJob | null>(null);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [document, setDocument] = useState<ArtifactDocument | null>(null);
  const [revision, setRevision] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectRailOpen, setProjectRailOpen] = useState(true);
  const [error, setError] = useState("");
  const [displayProgress, setDisplayProgress] = useState(0);
  const [agentPercents, setAgentPercents] = useState<Record<string, number>>({});
  const [lastSignalAt, setLastSignalAt] = useState(0);
  const [heartbeatMessage, setHeartbeatMessage] = useState("");
  const [clock, setClock] = useState(Date.now());
  const streamRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingKeyRef = useRef("");
  const finalizedJobsRef = useRef<Set<string>>(new Set());
  const chatSurfaceRef = useRef<HTMLElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.project_slug === activeProject),
    [activeProject, projects],
  );
  const readableArtifacts = useMemo(() => importantReadableArtifacts(artifacts), [artifacts]);
  const visibleProgress = useMemo(() => progress.filter(isDisplayableProgressEvent), [progress]);
  const latestProgress = visibleProgress.at(-1);
  const liveStatusMessage = latestProgress?.message ?? (heartbeatMessage || "Le système prépare l’atelier interne.");
  const progressValue = latestProgress?.percent_estimate ?? terminalProgress(job?.status);
  const rawAgentProgress = useMemo(() => buildAgentProgress(visibleProgress, job), [visibleProgress, job]);
  const agentProgressTargets = useMemo(
    () => rawAgentProgress.map((agent) => `${agent.id}:${agent.percent}`).join("|"),
    [rawAgentProgress],
  );
  const agentProgress = useMemo(
    () =>
      rawAgentProgress.map((agent) => ({
        ...agent,
        percent: agentPercents[agent.id] ?? Math.min(agent.percent, 1),
      })),
    [agentPercents, rawAgentProgress],
  );
  const liveEvents = useMemo(() => visibleProgress.filter(isUsefulEvent).slice(-8).reverse(), [visibleProgress]);
  const waitingQuestions = job?.status === "waiting_for_user" ? (job.required_questions ?? []) : [];
  const suggestedReply = job?.status === "waiting_for_user" ? job.suggested_user_reply?.trim() ?? "" : "";
  const activeJob = Boolean(job && !isTerminalJob(job.status));
  const secondsSinceSignal = lastSignalAt ? Math.max(0, Math.floor((clock - lastSignalAt) / 1000)) : 0;

  useEffect(() => {
    void bootstrap();
    return () => {
      streamRef.current?.close();
      stopProgressPolling();
    };
  }, []);

  useEffect(() => {
    if (!job) {
      setDisplayProgress(0);
      setLastSignalAt(0);
      setHeartbeatMessage("");
      return;
    }
    const target = Math.max(1, Math.min(100, progressValue));
    setDisplayProgress((current) => (current > 0 ? Math.min(current, target) : 1));
    const timer = setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= target) return current;
        const step = target - current > 18 ? 3 : 1;
        return Math.min(target, current + step);
      });
    }, 140);
    return () => clearInterval(timer);
  }, [job?.job_id, job?.status, progressValue]);

  useEffect(() => {
    if (!activeJob) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeJob]);

  useEffect(() => {
    const surface = chatSurfaceRef.current;
    if (!surface) return;
    const distanceFromBottom = surface.scrollHeight - surface.scrollTop - surface.clientHeight;
    if (distanceFromBottom < 180) {
      messageEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages.length, job?.job_id]);

  useEffect(() => {
    if (!rawAgentProgress.length) {
      setAgentPercents({});
      return;
    }
    const targets = Object.fromEntries(
      rawAgentProgress.map((agent) => [agent.id, Math.max(1, Math.min(100, agent.percent))]),
    ) as Record<string, number>;
    setAgentPercents((current) => {
      const next: Record<string, number> = {};
      for (const [agentId, target] of Object.entries(targets)) {
        next[agentId] = current[agentId] ? Math.min(current[agentId], target) : 1;
      }
      return next;
    });
    const timer = setInterval(() => {
      setAgentPercents((current) => {
        const next: Record<string, number> = {};
        for (const [agentId, target] of Object.entries(targets)) {
          const currentValue = current[agentId] ?? 1;
          const step = target - currentValue > 20 ? 4 : 1;
          next[agentId] = currentValue >= target ? currentValue : Math.min(target, currentValue + step);
        }
        return next;
      });
    }, 160);
    return () => clearInterval(timer);
  }, [agentProgressTargets, rawAgentProgress]);

  async function bootstrap() {
    try {
      await getJson("/health");
      await refreshProjects();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function refreshProjects(preferredSlug = "") {
    const payload = await getJson<{ projects: Project[] }>("/projects");
    const nextProjects = payload.projects ?? [];
    setProjects(nextProjects);
    const nextActive = preferredSlug || activeProject || nextProjects[0]?.project_slug || "";
    setActiveProject(nextActive);
    if (nextActive) {
      await ensureConversation(nextActive, { loadMessages: true });
      await refreshArtifacts(nextActive);
      await refreshProjectActivity(nextActive);
    }
  }

  async function ensureConversation(projectSlug: string, options: { loadMessages?: boolean } = {}) {
    if (!projectSlug) return "";
    if (conversationId && projectSlug === activeProject) {
      if (options.loadMessages) await loadConversationMessages(conversationId);
      return conversationId;
    }
    const project = projects.find((item) => item.project_slug === projectSlug);
    const conversationsPayload = await getJson<{ conversations: Conversation[] }>(
      `/conversations?project_slug=${encodeURIComponent(projectSlug)}`,
    );
    const existingConversation = conversationsPayload.conversations?.[0];
    if (existingConversation) {
      setConversationId(existingConversation.conversation_id);
      if (options.loadMessages) await loadConversationMessages(existingConversation.conversation_id);
      return existingConversation.conversation_id;
    }
    const payload = await postJson<{ conversation: Conversation }>("/conversations", {
      project_slug: projectSlug,
      title: project?.project_name ?? "Crew_System",
    });
    setConversationId(payload.conversation.conversation_id);
    if (options.loadMessages) setMessages([]);
    return payload.conversation.conversation_id;
  }

  async function loadConversationMessages(nextConversationId: string) {
    const payload = await getJson<{ conversation: Conversation; messages: ApiMessage[] }>(
      `/conversations/${nextConversationId}`,
    );
    setMessages(toChatMessages(payload.messages ?? []));
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!projectName.trim()) return;
    setError("");
    setIsCreatingProject(false);
    try {
      const payload = await postJson<{ project: Project }>("/projects", {
        name: projectName.trim(),
        description: projectDescription.trim(),
      });
      setProjectName("");
      setProjectDescription("");
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          body: "Projet créé. Donne-moi l’idée brute, je m’occupe de l’architecture.",
        },
      ]);
      await refreshProjects(payload.project.project_slug);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function selectProject(projectSlug: string) {
    streamRef.current?.close();
    stopProgressPolling();
    setActiveProject(projectSlug);
    setConversationId("");
    setDocument(null);
    setJob(null);
    setProgress([]);
    setMessages([]);
    await ensureConversation(projectSlug, { loadMessages: true });
    await refreshArtifacts(projectSlug);
    await refreshProjectActivity(projectSlug);
  }

  async function refreshProjectActivity(projectSlug: string) {
    try {
      const jobsPayload = await getJson<{ jobs: StoredJob[] }>(
        `/jobs?project_slug=${encodeURIComponent(projectSlug)}`,
      );
      const latestJob = displayableLatestJob(jobsPayload.jobs ?? []);
      if (!latestJob || !shouldRestoreJobOnLoad(latestJob)) {
        setJob(null);
        setProgress([]);
        setLastSignalAt(0);
        setHeartbeatMessage("");
        return;
      }
      const eventsPayload = await getJson<{ events: ProgressEvent[] }>(
        `/jobs/${projectSlug}/${latestJob.job_id}/events`,
      );
      setJob(latestJob);
      setProgress(eventsPayload.events ?? []);
      recordRuntimeSignal("Activité récente chargée depuis le runtime.");
      if (!isTerminalJob(latestJob.status)) {
        streamJob(projectSlug, latestJob.job_id);
      }
    } catch {
      setJob(null);
      setProgress([]);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    await submitMessage(body);
  }

  async function sendScenario(prompt: string) {
    if (!prompt.trim()) return;
    setDraft(prompt);
    await submitMessage(prompt);
  }

  async function submitMessage(body: string) {
    if (!activeProject) {
      setIsCreatingProject(true);
      setError("Crée un projet avant de lancer l’orchestration.");
      return;
    }
    setDraft("");
    setError("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", body },
    ]);

    try {
      const conversation = await ensureConversation(activeProject);
      const payload = await postJson<ChatSendResponse>(`/conversations/${conversation}/messages`, {
        message: body,
        project_slug: activeProject,
        provider: "auto",
        run_async: true,
      });
      setMessages((current) => [
        ...current,
        {
          id: payload.assistant_message?.message_id ?? crypto.randomUUID(),
          role: "assistant",
          body: payload.assistant_message?.content ?? "Demande reçue.",
        },
      ]);
      if (!payload.job) {
        setJob(null);
        setProgress([]);
        recordRuntimeSignal("Conversation simple. Aucun agent lancé inutilement.");
        return;
      }
      setJob(payload.job);
      setProgress([optimisticProgressEvent(payload.job.job_id)]);
      recordRuntimeSignal("Atelier lancé. Connexion au flux live.");
      streamJob(activeProject, payload.job.job_id, conversation);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function streamJob(projectSlug: string, jobId: string, targetConversationId = conversationId) {
    streamRef.current?.close();
    recordRuntimeSignal("Connexion au flux live des agents.");
    startProgressPolling(projectSlug, jobId, targetConversationId);
    const source = new EventSource(apiUrl(`/jobs/${projectSlug}/${jobId}/events/stream`));
    streamRef.current = source;
    source.addEventListener("progress", (event) => {
      const payload = JSON.parse(event.data) as ProgressEvent;
      recordRuntimeSignal(payload.message);
      setProgress((current) => mergeProgressEvents(current, [payload]));
      setJob((current) => (current ? { ...current, status: payload.status } : current));
    });
    source.addEventListener("heartbeat", (event) => {
      const payload = JSON.parse(event.data) as ProgressEvent;
      recordRuntimeSignal(payload.message);
      setJob((current) => (current ? { ...current, status: payload.status } : current));
    });
    source.addEventListener("done", async (event) => {
      const payload = JSON.parse(event.data) as StoredJob;
      recordRuntimeSignal("Job terminé. Consolidation de l'interface.");
      source.close();
      await finalizeJob(projectSlug, payload, targetConversationId);
    });
    source.onerror = () => {
      source.close();
    };
  }

  function startProgressPolling(projectSlug: string, jobId: string, targetConversationId = conversationId) {
    stopProgressPolling();
    pollingKeyRef.current = `${projectSlug}:${jobId}`;
    void pollProgress(projectSlug, jobId, targetConversationId);
    pollRef.current = setInterval(() => {
      void pollProgress(projectSlug, jobId, targetConversationId);
    }, 1200);
  }

  function stopProgressPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollingKeyRef.current = "";
  }

  async function pollProgress(projectSlug: string, jobId: string, targetConversationId = conversationId) {
    try {
      const [eventsPayload, jobPayload] = await Promise.all([
        getJson<{ events: ProgressEvent[] }>(`/jobs/${projectSlug}/${jobId}/events`),
        getJson<{ job: StoredJob }>(`/jobs/${projectSlug}/${jobId}`),
      ]);
      recordRuntimeSignal("Synchronisation runtime active.");
      setProgress((current) => mergeProgressEvents(current, eventsPayload.events ?? []));
      setJob(jobPayload.job);
      if (isTerminalJob(jobPayload.job.status)) {
        await finalizeJob(projectSlug, jobPayload.job, targetConversationId);
      }
    } catch {
      return;
    }
  }

  async function finalizeJob(projectSlug: string, finishedJob: StoredJob, targetConversationId = conversationId) {
    if (pollingKeyRef.current === `${projectSlug}:${finishedJob.job_id}`) {
      stopProgressPolling();
    }
    setJob(finishedJob);
    await refreshArtifacts(projectSlug);
    if (finalizedJobsRef.current.has(finishedJob.job_id)) return;
    finalizedJobsRef.current.add(finishedJob.job_id);
    const messageBody = finalJobMessage(finishedJob);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        body: messageBody,
      },
    ]);
    if (targetConversationId) {
      try {
        await postJson(`/conversations/${targetConversationId}/assistant-messages`, {
          content: messageBody,
          job_id: finishedJob.job_id,
          project_slug: projectSlug,
        });
      } catch {
        return;
      }
    }
  }

  async function refreshArtifacts(projectSlug = activeProject) {
    if (!projectSlug) return;
    const payload = await getJson<{ artifacts: Artifact[] }>(
      `/artifacts?project_slug=${encodeURIComponent(projectSlug)}`,
    );
    setArtifacts(payload.artifacts ?? []);
  }

  async function readArtifact(artifact: Artifact) {
    const payload = await getJson<ArtifactDocument>(
      `/artifact?project_slug=${encodeURIComponent(activeProject)}&artifact_id=${encodeURIComponent(
        artifact.artifact_id,
      )}`,
    );
    setDocument(payload);
  }

  async function validateArtifact() {
    if (!document) return;
    await postJson("/artifacts/validate", {
      project_slug: activeProject,
      artifact_id: document.artifact.artifact_id,
      approved_by: "Utilisateur",
      notes: "Validé depuis l’interface Next.js.",
    });
    await refreshArtifacts();
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        body: "Document validé. Il devient une source fiable pour la suite.",
      },
    ]);
  }

  async function requestRevision(event: FormEvent) {
    event.preventDefault();
    if (!document || !revision.trim()) return;
    const instructions = revision.trim();
    setRevision("");
    const payload = await postJson<{ job: StoredJob }>("/artifacts/revise", {
      project_slug: activeProject,
      artifact_id: document.artifact.artifact_id,
      instructions,
      provider: "auto",
      run_async: true,
    });
    setJob(payload.job);
    setProgress([optimisticProgressEvent(payload.job.job_id)]);
    recordRuntimeSignal("Révision lancée. Connexion au flux live.");
    streamJob(activeProject, payload.job.job_id, conversationId);
  }

  function recordRuntimeSignal(message = "") {
    const now = Date.now();
    setLastSignalAt(now);
    setClock(now);
    if (message) setHeartbeatMessage(message);
  }

  return (
    <main className={projectRailOpen ? "appShell" : "appShell projectsCollapsed"}>
      <aside className="projectPanel" aria-label="Projets">
        <div className="projectPanelHeader">
          <div>
            <span className="eyebrow">Crew_System</span>
            <strong>Projets</strong>
          </div>
          <button className="quietButton" type="button" onClick={() => setProjectRailOpen(false)}>
            Fermer
          </button>
        </div>
        <button className="newProjectButton" type="button" onClick={() => setIsCreatingProject(true)}>
          Nouveau projet
        </button>
        <nav className="projectList">
          {projects.map((project) => (
            <button
              className={project.project_slug === activeProject ? "projectItem active" : "projectItem"}
              key={project.project_slug}
              type="button"
              onClick={() => void selectProject(project.project_slug)}
            >
              <span>{project.project_name}</span>
              <small>{project.project_slug}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="conversationPane">
        <header className="conversationHeader">
          <button className="quietButton" type="button" onClick={() => setProjectRailOpen(true)}>
            Projets
          </button>
          <div>
            <span className="eyebrow">{selectedProject?.project_name ?? "Aucun projet"}</span>
            <h1>Conversation</h1>
          </div>
          <button className="quietButton" type="button" onClick={() => setIsCreatingProject(true)}>
            Nouveau
          </button>
        </header>

        {activeJob ? (
          <section className="liveBanner" aria-label="Avancement en direct">
            <div>
              <span className="eyebrow">En direct</span>
              <p>{liveStatusMessage}</p>
              <small className={secondsSinceSignal > 3 ? "liveMeta stale" : "liveMeta"}>
                <span className="signalDot" />
                {activeJob ? `Signal runtime il y a ${secondsSinceSignal}s` : "Job terminé"}
              </small>
            </div>
            <strong>{displayProgress}%</strong>
          </section>
        ) : null}

        <section className="questionGuide" aria-label="Parcours de questions">
          <div className="questionGuideHeader">
            <span className="eyebrow">Parcours</span>
            <strong>Choisis la prochaine demande</strong>
          </div>
          <div className="questionFlow">
            {questionFlow.map((item, index) => (
              <article className="questionCard" key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.title}</strong>
                <p>{item.hint}</p>
                <div>
                  <button type="button" onClick={() => setDraft(item.prompt)}>
                    Utiliser
                  </button>
                  <button type="button" onClick={() => void sendScenario(item.prompt)}>
                    Envoyer
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="chatSurface" aria-label="Conversation" ref={chatSurfaceRef}>
          {messages.length === 0 ? (
            <div className="openingPrompt">
              <span className="eyebrow">Point de départ</span>
              <h2>Parle-moi de l’idée.</h2>
              <p>Le système structure, orchestre les agents et écrit les documents utiles.</p>
            </div>
          ) : (
            <div className="messageStack">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <span>{message.role === "user" ? "Vous" : "Crew_System"}</span>
                  <p>{message.body}</p>
                </article>
              ))}
              <div ref={messageEndRef} />
            </div>
          )}
        </section>

        {waitingQuestions.length ? (
          <section className="clarificationBlock" aria-label="Questions de clarification">
            <span className="eyebrow">Réponse nécessaire</span>
            <h3>Ce qu’il faut préciser</h3>
            <ol>
              {waitingQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
            {suggestedReply ? (
              <button type="button" onClick={() => setDraft(suggestedReply)}>
                Préparer une réponse
              </button>
            ) : null}
          </section>
        ) : null}

        <form className="composer" onSubmit={sendMessage}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Décris l’offre, la cible, l’objectif, les plateformes, le volume..."
          />
          <div className="composerFooter">
            <div>
              <span>Facebook</span>
              <span>LinkedIn</span>
              <span>Texte</span>
              <span>Images</span>
              <span>Vidéos</span>
            </div>
            <button type="submit">Lancer</button>
          </div>
        </form>
        {error ? <p className="errorText">{error}</p> : null}
      </section>

      <aside className="workPane">
        <section className="livePanel">
          <div className="panelTitle">
            <div>
              <span className="eyebrow">Travail en direct</span>
              <h2>{job ? statusLabel(job.status) : "En attente"}</h2>
            </div>
            <strong>{displayProgress}%</strong>
          </div>
          <div className="globalProgress">
            <span style={{ width: `${displayProgress}%` }} />
          </div>

          {job?.status === "failed" && job.error ? (
            <div className="runtimeError" role="alert">
              <span className="eyebrow">Erreur runtime</span>
              <p>{humanRuntimeError(job.error)}</p>
            </div>
          ) : null}

          <div className="agentList">
            {agentProgress.length ? (
              agentProgress.map((agent) => (
                <article className={isActiveAgent(agent) ? "agentRow activeAgent" : "agentRow"} key={agent.id}>
                  <div className="agentTopline">
                    <strong>{agent.label}</strong>
                    <span>{agent.percent}%</span>
                  </div>
                  <div className="agentTrack">
                    <span style={{ width: `${agent.percent}%` }} />
                  </div>
                  <p>{agent.lastMessage}</p>
                  <small>{agent.status}</small>
                </article>
              ))
            ) : (
              <p className="mutedText">Aucun agent lancé pour le moment.</p>
            )}
          </div>

          <div className="internalFeed">
            <span className="eyebrow">Discussion interne</span>
            {liveEvents.length ? (
              liveEvents.map((event) => (
                <article key={event.event_id}>
                  <strong>{eventTitle(event)}</strong>
                  <p>{event.message}</p>
                </article>
              ))
            ) : (
              <p className="mutedText">Le prochain job apparaîtra ici.</p>
            )}
          </div>
        </section>

        <section className="documentPanel">
          <div className="panelTitle compact">
            <div>
              <span className="eyebrow">Documents clés</span>
              <h2>À consulter</h2>
            </div>
          </div>

          <div className="documentList">
            {readableArtifacts.length ? (
              readableArtifacts.slice(0, 7).map((artifact) => (
                <button
                  className={document?.artifact.artifact_id === artifact.artifact_id ? "documentLink active" : "documentLink"}
                  key={`${artifact.artifact_id}-${artifact.path}`}
                  type="button"
                  onClick={() => void readArtifact(artifact)}
                >
                  <span>{readableTitle(artifact.path)}</span>
                  <small>{artifact.status === "approved_by_human" ? "validé" : "à lire"}</small>
                </button>
              ))
            ) : (
              <p className="mutedText">Aucun document lisible pour le moment.</p>
            )}
          </div>
        </section>
      </aside>

      {document ? (
        <div className="documentOverlay" role="dialog" aria-modal="true" aria-label={readableTitle(document.path)}>
          <section className="documentModal">
            <header>
              <div>
                <span className="eyebrow">Document clé</span>
                <h2>{readableTitle(document.path)}</h2>
              </div>
              <div className="documentActions">
                <button type="button" onClick={() => void validateArtifact()}>
                  Valider
                </button>
                <button type="button" onClick={() => setDocument(null)}>
                  Fermer
                </button>
              </div>
            </header>
            <pre className="documentReader">{document.content}</pre>
            <form className="revisionBox" onSubmit={requestRevision}>
              <input
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                placeholder="Ce qui doit changer..."
              />
              <button type="submit">Réviser</button>
            </form>
          </section>
        </div>
      ) : null}

      {isCreatingProject ? (
        <div className="modalLayer" role="presentation">
          <form className="projectModal" onSubmit={createProject}>
            <span className="eyebrow">Nouveau projet</span>
            <h2>Créer un terrain de travail</h2>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Coach SaaS"
              required
            />
            <textarea
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="SaaS pour coachs premium, objectif leads et autorité..."
            />
            <div>
              <button type="button" onClick={() => setIsCreatingProject(false)}>
                Annuler
              </button>
              <button type="submit">Créer</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function importantReadableArtifacts(artifacts: Artifact[]) {
  const bestByPath = new Map<string, Artifact>();
  for (const artifact of artifacts) {
    const path = artifact.path.toLowerCase();
    if (!path.endsWith(".md")) continue;
    if (path.includes("/logs/") || path.includes("/reviews/") || path.includes("debug")) continue;
    if (path.includes("/brief/source_materials/")) continue;
    const isImportant =
      path.includes("campaign_pack") ||
      path.includes("strategic") ||
      path.includes("audience") ||
      path.includes("positioning") ||
      path.includes("influence") ||
      path.includes("growth") ||
      path.includes("calendar") ||
      path.includes("strategy") ||
      path.includes("content_batch") ||
      path.includes("posts_ready");
    if (!isImportant) continue;
    const previous = bestByPath.get(artifact.path);
    if (!previous || artifactDisplayRank(artifact) > artifactDisplayRank(previous)) {
      bestByPath.set(artifact.path, artifact);
    }
  }
  return [...bestByPath.values()]
    .filter((artifact) => {
      const path = artifact.path.toLowerCase();
      return !path.includes("quality_report") && !path.includes("run_summary");
    })
    .sort((left, right) => importanceScore(right.path) - importanceScore(left.path));
}

function artifactDisplayRank(artifact: Artifact) {
  const statusRank: Record<string, number> = {
    approved_by_human: 50,
    ready_for_human_review: 40,
    draft: 30,
    needs_revision: 20,
    rejected: 10,
  };
  return (statusRank[artifact.status] ?? 0) * 1_000_000_000_000 + Date.parse(artifact.created_at || "0");
}

function toChatMessages(apiMessages: ApiMessage[]): Message[] {
  return apiMessages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.message_id,
      role: message.role === "user" ? "user" : "assistant",
      body: message.content,
    }));
}

function optimisticProgressEvent(jobId: string): ProgressEvent {
  return {
    event_id: `ui_${jobId}_starting`,
    job_id: jobId,
    status: "running",
    message: "Atelier lancé. Connexion au flux live des agents...",
    timestamp: new Date().toISOString(),
    percent_estimate: 1,
    current_phase: "starting",
    active_agents: [],
    artifacts_created: [],
  };
}

function mergeProgressEvents(current: ProgressEvent[], incoming: ProgressEvent[]) {
  const eventsById = new Map<string, ProgressEvent>();
  for (const event of [...current, ...incoming]) {
    eventsById.set(event.event_id, event);
  }
  return [...eventsById.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function displayableLatestJob(jobs: StoredJob[]) {
  const cleanJob = jobs.find(
    (candidate) =>
      !isConversationalOnlyJob(candidate) &&
      candidate.status !== "failed" &&
      !(candidate.status === "queued" && candidate.error),
  );
  return cleanJob ?? jobs.find((candidate) => !isConversationalOnlyJob(candidate));
}

function shouldRestoreJobOnLoad(job: StoredJob) {
  return ["queued", "running", "waiting_for_user"].includes(job.status);
}

function isConversationalOnlyJob(job: StoredJob) {
  const message = foldUiText(job.request_message ?? "").trim().replace(/[.!?]+$/g, "");
  if (!message) return false;
  const socialTurns = new Set([
    "salut",
    "bonjour",
    "bonsoir",
    "hello",
    "hey",
    "coucou",
    "comment tu vas",
    "comment ca va",
    "ca va",
    "tu vas bien",
  ]);
  if (socialTurns.has(message)) return true;
  const hasRealAgent = (job.agents_used ?? []).length > 0;
  return !hasRealAgent && /^(comment|pourquoi|explique|dis moi|c est quoi|est ce que)\b/.test(message);
}

function foldUiText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isTerminalJob(status: JobStatus) {
  return ["completed", "needs_revision", "failed", "cancelled", "waiting_for_user"].includes(status);
}

function importanceScore(path: string) {
  const lowered = path.toLowerCase();
  if (lowered.includes("campaign_pack")) return 100;
  if (lowered.includes("content_batch")) return 90;
  if (lowered.includes("posts_ready")) return 85;
  if (lowered.includes("calendar")) return 75;
  if (lowered.includes("growth")) return 70;
  if (lowered.includes("strategy")) return 65;
  return 40;
}

function buildAgentProgress(events: ProgressEvent[], job: StoredJob | null): AgentProgress[] {
  const agents = new Map<string, AgentProgress>();
  for (const event of events) {
    for (const agentId of event.active_agents ?? []) {
      const previous = agents.get(agentId);
      const percent = agentPercentFor(event, previous?.percent ?? 0);
      agents.set(agentId, {
        id: agentId,
        label: agentLabel(agentId),
        percent,
        status: agentStatusFor(event),
        lastMessage: event.message,
      });
    }
  }
  for (const agentId of job?.agents_used ?? []) {
    if (!agents.has(agentId)) {
      agents.set(agentId, {
        id: agentId,
        label: agentLabel(agentId),
        percent: 100,
        status: "terminé",
        lastMessage: "Contribution intégrée au livrable final.",
      });
    }
  }
  return [...agents.values()];
}

function agentPercentFor(event: ProgressEvent, previous: number) {
  const phase = event.current_phase;
  if (phase.includes(":chunk:")) return Math.max(previous, Math.min(event.percent_estimate, 98));
  if (phase.endsWith(":done")) return 100;
  if (phase.endsWith(":failed")) return 100;
  if (phase === "quality") return Math.max(previous, 88);
  if (phase === "writing") return Math.max(previous, 96);
  if (phase.includes(":running")) return Math.max(previous, Math.min(event.percent_estimate, 72));
  return Math.max(previous, Math.min(event.percent_estimate, 98));
}

function agentStatusFor(event: ProgressEvent) {
  const phase = event.current_phase;
  if (phase.includes(":chunk:") && phase.endsWith(":done")) return "publication intégrée";
  if (phase.includes(":chunk:") && phase.endsWith(":failed")) return "chunk à reprendre";
  if (phase.includes(":chunk:")) return "rédaction fractionnée";
  if (phase.endsWith(":done")) return "terminé";
  if (phase.endsWith(":failed")) return "à revoir";
  if (phase === "quality") return "contrôle qualité";
  if (phase === "writing") return "écriture";
  return "en réflexion";
}

function isActiveAgent(agent: AgentProgress) {
  return agent.percent < 100 && !["terminé", "à revoir", "chunk à reprendre"].includes(agent.status);
}

function isUsefulEvent(event: ProgressEvent) {
  return !["queued", "running", "retry_waiting"].includes(event.current_phase);
}

function isDisplayableProgressEvent(event: ProgressEvent) {
  if (event.current_phase === "retry_waiting") return false;
  return event.message !== "Worker failed; job queued for retry";
}

function eventTitle(event: ProgressEvent) {
  const agentId = event.active_agents?.[0];
  if (agentId && event.current_phase.startsWith("agent:")) return agentLabel(agentId);
  if (event.current_phase === "quality") return "Contrôle qualité";
  if (event.current_phase === "writing") return "Écriture";
  if (event.current_phase === "waiting_for_user") return "Clarification";
  if (event.current_phase === "planning") return "Orchestration";
  return "Runtime";
}

function agentLabel(agentId: string) {
  const labels: Record<string, string> = {
    strategist: "Stratège",
    audience_psychologist: "Psychologie audience",
    positioning_agent: "Positionnement",
    influence_architect: "Influence",
    growth_hacker: "Growth",
    calendar_architect: "Calendrier",
    facebook_native_agent: "Facebook",
    linkedin_native_agent: "LinkedIn",
    hook_master: "Hooks",
    copywriter: "Copywriter",
    creative_director: "Direction créative",
    visual_concept_agent: "Visuels",
    video_agent: "Vidéo",
    risk_reviewer: "Risques",
    anti_banality_agent: "Anti-banalité",
  };
  return labels[agentId] ?? titleCase(agentId);
}

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readableTitle(path: string) {
  const file = path.split("/").at(-1) ?? path;
  return file.replace(/\.md$/i, "").replaceAll("_", " ");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inconnue";
}

function terminalProgress(status?: JobStatus) {
  if (!status) return 0;
  if (["completed", "needs_revision", "failed", "cancelled", "waiting_for_user"].includes(status)) return 100;
  if (status === "queued") return 8;
  return 32;
}

function statusLabel(status: JobStatus) {
  const labels: Record<JobStatus, string> = {
    queued: "En file",
    running: "Agents actifs",
    waiting_for_user: "À préciser",
    needs_revision: "À réviser",
    failed: "Erreur",
    completed: "Terminé",
    cancelled: "Annulé",
  };
  return labels[status] ?? status;
}

function finalJobMessage(job: StoredJob) {
  if (job.status === "completed") return "C’est prêt. Les documents clés sont disponibles.";
  if (job.status === "needs_revision") return "C’est produit, avec une révision conseillée avant validation.";
  if (job.status === "waiting_for_user") return clarificationMessage(job);
  if (job.status === "failed") {
    const detail = humanRuntimeError(job.error ?? "");
    return detail ? `Le job a échoué.\n\nErreur réelle : ${detail}` : "Le job a échoué, sans détail runtime exploitable.";
  }
  return "Le job est terminé.";
}

function humanRuntimeError(error: string) {
  const value = error.trim();
  if (!value) return "";
  if (value === "Context loading requires a resolved project") {
    return "la demande ne correspondait pas à un travail agentique clair. Le système ne doit plus lancer d’atelier pour ce type de message.";
  }
  return value;
}

function clarificationMessage(job: StoredJob) {
  const questions = job.required_questions ?? [];
  const base = job.assistant_message?.trim() || "J’ai besoin de précisions pour continuer proprement.";
  if (!questions.length) return base;
  return `${base}\n\n${questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}`;
}
