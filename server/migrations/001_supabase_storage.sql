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
