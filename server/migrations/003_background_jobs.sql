-- Durable background job state for email delivery and future worker tasks.

create table if not exists public.agora_background_jobs (
  id text primary key,
  workspace_id text not null,
  type text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  metadata jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  error text not null default '',
  next_run_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agora_background_jobs_workspace_status
  on public.agora_background_jobs(workspace_id, status, updated_at desc);

drop trigger if exists trg_agora_background_jobs_updated_at on public.agora_background_jobs;
create trigger trg_agora_background_jobs_updated_at
before update on public.agora_background_jobs
for each row
execute function public.agora_set_updated_at();

alter table public.agora_background_jobs enable row level security;
