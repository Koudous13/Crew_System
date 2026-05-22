export type Project = {
  project_slug: string;
  project_name: string;
  description?: string;
  updated_at?: string;
};

export type Conversation = {
  conversation_id: string;
  project_slug: string;
  title: string;
  updated_at?: string;
};

export type ApiMessage = {
  message_id: string;
  conversation_id: string;
  role: "user" | "assistant" | string;
  content: string;
  job_id?: string;
};

export type StoredJob = {
  job_id: string;
  project_slug: string;
  request_message: string;
  status: JobStatus;
  created_at?: string;
  updated_at?: string;
  error?: string;
  assistant_message?: string;
  suggested_user_reply?: string;
  missing_information?: string[];
  blocked_reasons?: string[];
  required_questions?: string[];
  artifacts_created?: string[];
  agents_used?: string[];
};

export type JobStatus =
  | "queued"
  | "running"
  | "waiting_for_user"
  | "needs_revision"
  | "failed"
  | "completed"
  | "cancelled";

export type ProgressEvent = {
  event_id: string;
  job_id: string;
  status: JobStatus;
  message: string;
  timestamp: string;
  percent_estimate: number;
  current_phase: string;
  active_agents: string[];
  artifacts_created: string[];
};

export type Artifact = {
  artifact_id: string;
  job_id: string;
  project_slug: string;
  path: string;
  status: string;
  created_at: string;
  human_validation?: {
    decision: string;
    approved_by: string;
  };
};

export type ArtifactDocument = {
  artifact: Artifact;
  path: string;
  content_type: string;
  content: string;
  human_validation: Record<string, unknown>;
};

const browserApiBase = process.env.NEXT_PUBLIC_CREW_API_URL ?? "/crew-api";

export function apiUrl(path: string) {
  if (typeof window === "undefined") {
    const serverApiBase = process.env.CREW_API_URL ?? browserApiBase;
    return `${serverApiBase}${path}`;
  }
  return `${browserApiBase}${path}`;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return parseResponse<T>(response);
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const rawPayload = await response.text();
  let payload: unknown = {};
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = { error: { message: rawPayload } };
    }
  }
  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: string } };
    const message = errorPayload.error?.message ?? `Crew API returned ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}
