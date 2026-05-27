create table if not exists public.crew_agent_runs (
  agent_run_id text primary key,
  job_id text not null references public.crew_jobs(job_id) on delete cascade,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  agent_id text not null,
  agent_version text not null default '',
  status text not null default 'queued',
  input_summary text not null default '',
  output_summary text not null default '',
  handoff jsonb not null default '{}'::jsonb,
  quality_score integer,
  confidence_score integer,
  error text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_decisions (
  decision_id text primary key,
  job_id text references public.crew_jobs(job_id) on delete set null,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  agent_run_id text references public.crew_agent_runs(agent_run_id) on delete set null,
  agent_id text not null default 'director',
  decision_type text not null,
  title text not null,
  summary text not null,
  rationale_summary text not null default '',
  impact text not null default '',
  alternatives jsonb not null default '[]'::jsonb,
  status text not null default 'accepted',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_errors (
  error_id text primary key,
  job_id text references public.crew_jobs(job_id) on delete set null,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  agent_run_id text references public.crew_agent_runs(agent_run_id) on delete set null,
  source_type text not null default 'runtime',
  source_name text not null,
  severity text not null default 'error',
  recoverable boolean not null default true,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.crew_documents (
  document_id text primary key,
  project_slug text not null references public.crew_projects(project_slug) on delete cascade,
  job_id text references public.crew_jobs(job_id) on delete set null,
  artifact_id text references public.crew_artifacts(artifact_id) on delete set null,
  storage_provider text not null default 'google_drive',
  drive_file_id text not null default '',
  drive_url text not null default '',
  path text not null,
  title text not null,
  document_type text not null default 'markdown',
  status text not null default 'draft',
  content_type text not null default 'text/markdown',
  checksum text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crew_agent_runs_job_created_idx
  on public.crew_agent_runs(job_id, created_at asc);

create index if not exists crew_agent_runs_project_agent_idx
  on public.crew_agent_runs(project_slug, agent_id, created_at desc);

create index if not exists crew_decisions_project_created_idx
  on public.crew_decisions(project_slug, created_at desc);

create index if not exists crew_decisions_job_created_idx
  on public.crew_decisions(job_id, created_at desc);

create index if not exists crew_errors_project_status_idx
  on public.crew_errors(project_slug, status, created_at desc);

create index if not exists crew_errors_job_created_idx
  on public.crew_errors(job_id, created_at desc);

create index if not exists crew_documents_project_updated_idx
  on public.crew_documents(project_slug, updated_at desc);

create index if not exists crew_documents_job_created_idx
  on public.crew_documents(job_id, created_at desc);

alter table public.crew_agent_runs enable row level security;
alter table public.crew_decisions enable row level security;
alter table public.crew_errors enable row level security;
alter table public.crew_documents enable row level security;

create or replace function public.crew_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crew_projects_set_updated_at on public.crew_projects;
create trigger crew_projects_set_updated_at
before update on public.crew_projects
for each row execute function public.crew_set_updated_at();

drop trigger if exists crew_conversations_set_updated_at on public.crew_conversations;
create trigger crew_conversations_set_updated_at
before update on public.crew_conversations
for each row execute function public.crew_set_updated_at();

drop trigger if exists crew_jobs_set_updated_at on public.crew_jobs;
create trigger crew_jobs_set_updated_at
before update on public.crew_jobs
for each row execute function public.crew_set_updated_at();

drop trigger if exists crew_agent_runs_set_updated_at on public.crew_agent_runs;
create trigger crew_agent_runs_set_updated_at
before update on public.crew_agent_runs
for each row execute function public.crew_set_updated_at();

drop trigger if exists crew_decisions_set_updated_at on public.crew_decisions;
create trigger crew_decisions_set_updated_at
before update on public.crew_decisions
for each row execute function public.crew_set_updated_at();

drop trigger if exists crew_documents_set_updated_at on public.crew_documents;
create trigger crew_documents_set_updated_at
before update on public.crew_documents
for each row execute function public.crew_set_updated_at();
