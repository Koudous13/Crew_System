create table if not exists public.crew_projects (
  project_slug text primary key,
  project_name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_conversations (
  conversation_id text primary key,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_messages (
  message_id text primary key,
  conversation_id text not null references public.crew_conversations(conversation_id) on delete cascade,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  role text not null,
  content text not null,
  job_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_jobs (
  job_id text primary key,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  request_message text not null,
  status text not null default 'queued',
  provider text not null default 'gemini',
  assistant_message text not null default '',
  suggested_user_reply text not null default '',
  missing_information text[] not null default '{}',
  required_questions text[] not null default '{}',
  blocked_reasons text[] not null default '{}',
  artifacts_created text[] not null default '{}',
  agents_used text[] not null default '{}',
  error text not null default '',
  percent_estimate integer not null default 0,
  current_phase text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.crew_progress_events (
  event_id text primary key,
  job_id text not null references public.crew_jobs(job_id) on delete cascade,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  status text not null,
  message text not null,
  percent_estimate integer not null default 0,
  current_phase text not null default '',
  active_agents text[] not null default '{}',
  artifacts_created text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.crew_artifacts (
  artifact_id text primary key,
  job_id text not null references public.crew_jobs(job_id) on delete cascade,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  path text not null,
  status text not null default 'draft',
  content_type text not null default 'text/markdown',
  content text not null,
  human_validation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crew_conversations_project_updated_idx
  on public.crew_conversations(project_slug, updated_at desc);

create index if not exists crew_messages_conversation_created_idx
  on public.crew_messages(conversation_id, created_at asc);

create index if not exists crew_jobs_project_updated_idx
  on public.crew_jobs(project_slug, updated_at desc);

create index if not exists crew_progress_events_job_created_idx
  on public.crew_progress_events(job_id, created_at asc);

create index if not exists crew_artifacts_project_created_idx
  on public.crew_artifacts(project_slug, created_at desc);

alter table public.crew_projects enable row level security;
alter table public.crew_conversations enable row level security;
alter table public.crew_messages enable row level security;
alter table public.crew_jobs enable row level security;
alter table public.crew_progress_events enable row level security;
alter table public.crew_artifacts enable row level security;
