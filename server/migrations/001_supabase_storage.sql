-- Agora Supabase storage foundation.
--
-- This first Supabase migration stores the current workspace snapshot model in
-- Postgres while Agora's domain schema continues to settle. Later migrations can
-- progressively normalize projects, tasks, comments, files, and notifications
-- into dedicated tables without changing the browser prototype all at once.

create table if not exists public.agora_workspace_snapshots (
  workspace_id text primary key,
  snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agora_audit_events (
  id text primary key,
  workspace_id text not null,
  actor_id text,
  action text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agora_audit_events_workspace_created
  on public.agora_audit_events(workspace_id, created_at desc);

create or replace function public.agora_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agora_workspace_snapshots_updated_at on public.agora_workspace_snapshots;
create trigger trg_agora_workspace_snapshots_updated_at
before update on public.agora_workspace_snapshots
for each row
execute function public.agora_set_updated_at();

alter table public.agora_workspace_snapshots enable row level security;
alter table public.agora_audit_events enable row level security;

create table if not exists public.agora_companies (
  id text primary key,
  workspace_id text not null,
  collection_key text not null default 'companies',
  project_id text,
  task_id text,
  company_id text,
  member_id text,
  title text not null default '',
  record jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agora_approvals (like public.agora_companies including all);
alter table public.agora_approvals alter column collection_key set default 'approvals';

create table if not exists public.agora_time_entries (like public.agora_companies including all);
alter table public.agora_time_entries alter column collection_key set default 'timeEntries';

create table if not exists public.agora_comments (like public.agora_companies including all);
alter table public.agora_comments alter column collection_key set default 'comments';

create table if not exists public.agora_activities (like public.agora_companies including all);
alter table public.agora_activities alter column collection_key set default 'activities';

create table if not exists public.agora_documents (like public.agora_companies including all);
alter table public.agora_documents alter column collection_key set default 'documents';

create table if not exists public.agora_files (like public.agora_companies including all);
alter table public.agora_files alter column collection_key set default 'files';

create table if not exists public.agora_presence (like public.agora_companies including all);
alter table public.agora_presence alter column collection_key set default 'presence';

create index if not exists idx_agora_companies_workspace_updated on public.agora_companies(workspace_id, updated_at desc);
create index if not exists idx_agora_approvals_workspace_project on public.agora_approvals(workspace_id, project_id, updated_at desc);
create index if not exists idx_agora_approvals_company on public.agora_approvals(workspace_id, company_id, updated_at desc);
create index if not exists idx_agora_time_entries_task on public.agora_time_entries(workspace_id, task_id, updated_at desc);
create index if not exists idx_agora_comments_task on public.agora_comments(workspace_id, task_id, updated_at desc);
create index if not exists idx_agora_activities_project on public.agora_activities(workspace_id, project_id, updated_at desc);
create index if not exists idx_agora_documents_project on public.agora_documents(workspace_id, project_id, updated_at desc);
create index if not exists idx_agora_files_project on public.agora_files(workspace_id, project_id, updated_at desc);
create index if not exists idx_agora_presence_member on public.agora_presence(workspace_id, member_id, updated_at desc);
create index if not exists idx_agora_presence_task on public.agora_presence(workspace_id, task_id, updated_at desc);

drop trigger if exists trg_agora_companies_updated_at on public.agora_companies;
create trigger trg_agora_companies_updated_at before update on public.agora_companies for each row execute function public.agora_set_updated_at();

drop trigger if exists trg_agora_approvals_updated_at on public.agora_approvals;
create trigger trg_agora_approvals_updated_at before update on public.agora_approvals for each row execute function public.agora_set_updated_at();

drop trigger if exists trg_agora_time_entries_updated_at on public.agora_time_entries;
create trigger trg_agora_time_entries_updated_at before update on public.agora_time_entries for each row execute function public.agora_set_updated_at();

drop trigger if exists trg_agora_comments_updated_at on public.agora_comments;
create trigger trg_agora_comments_updated_at before update on public.agora_comments for each row execute function public.agora_set_updated_at();

drop trigger if exists trg_agora_activities_updated_at on public.agora_activities;
create trigger trg_agora_activities_updated_at before update on public.agora_activities for each row execute function public.agora_set_updated_at();

drop trigger if exists trg_agora_documents_updated_at on public.agora_documents;
create trigger trg_agora_documents_updated_at before update on public.agora_documents for each row execute function public.agora_set_updated_at();

drop trigger if exists trg_agora_files_updated_at on public.agora_files;
create trigger trg_agora_files_updated_at before update on public.agora_files for each row execute function public.agora_set_updated_at();

drop trigger if exists trg_agora_presence_updated_at on public.agora_presence;
create trigger trg_agora_presence_updated_at before update on public.agora_presence for each row execute function public.agora_set_updated_at();

alter table public.agora_companies enable row level security;
alter table public.agora_approvals enable row level security;
alter table public.agora_time_entries enable row level security;
alter table public.agora_comments enable row level security;
alter table public.agora_activities enable row level security;
alter table public.agora_documents enable row level security;
alter table public.agora_files enable row level security;
alter table public.agora_presence enable row level security;
