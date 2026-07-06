-- Agora durable auth sessions.
--
-- Stores hashed bearer-token identifiers and session metadata outside portable
-- workspace snapshots. Raw API bearer tokens are never persisted here.

create table if not exists public.agora_auth_sessions (
  token_hash text primary key,
  workspace_id text not null,
  user_id text not null,
  user_email text not null default '',
  user_name text not null default '',
  role text not null default 'member' check (role in ('admin', 'manager', 'member', 'client')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  company_id text not null default '',
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  last_seen_at timestamptz not null default now(),
  request_count integer not null default 0,
  client_ip_hash text not null default '',
  user_agent text not null default '',
  rotated_from text not null default '',
  revoked_at timestamptz,
  revoked_by text not null default ''
);

create index if not exists idx_agora_auth_sessions_workspace_seen
  on public.agora_auth_sessions(workspace_id, last_seen_at desc);

create index if not exists idx_agora_auth_sessions_user_status
  on public.agora_auth_sessions(workspace_id, user_id, status);

drop trigger if exists trg_agora_auth_sessions_updated_at on public.agora_auth_sessions;
create trigger trg_agora_auth_sessions_updated_at
before update on public.agora_auth_sessions
for each row
execute function public.agora_set_updated_at();

alter table public.agora_auth_sessions enable row level security;

drop policy if exists agora_auth_sessions_select_self_or_admin on public.agora_auth_sessions;
create policy agora_auth_sessions_select_self_or_admin
on public.agora_auth_sessions
for select
to authenticated
using (
  user_id = auth.uid()::text
  or public.agora_workspace_role(workspace_id) = 'admin'
);

drop policy if exists agora_auth_sessions_admin_write on public.agora_auth_sessions;
create policy agora_auth_sessions_admin_write
on public.agora_auth_sessions
for all
to authenticated
using (public.agora_workspace_role(workspace_id) = 'admin')
with check (public.agora_workspace_role(workspace_id) = 'admin');
