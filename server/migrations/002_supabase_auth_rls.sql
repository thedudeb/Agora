-- Agora Supabase Auth + RLS foundation.
--
-- Run this after 001_supabase_storage.sql. The API can continue using the
-- service role for server-side writes, while authenticated Supabase users get
-- direct RLS protection for future client-side reads/writes.

create table if not exists public.agora_workspace_memberships (
  workspace_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'manager', 'member', 'client')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  company_id text not null default '',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_agora_workspace_memberships_user
  on public.agora_workspace_memberships(user_id, status);

drop trigger if exists trg_agora_workspace_memberships_updated_at on public.agora_workspace_memberships;
create trigger trg_agora_workspace_memberships_updated_at
before update on public.agora_workspace_memberships
for each row
execute function public.agora_set_updated_at();

alter table public.agora_workspace_memberships enable row level security;

create or replace function public.agora_workspace_role(target_workspace_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.agora_workspace_memberships
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.agora_workspace_company_id(target_workspace_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.agora_workspace_memberships
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.agora_can_read_workspace(target_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.agora_workspace_role(target_workspace_id) is not null
$$;

create or replace function public.agora_can_write_workspace(target_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.agora_workspace_role(target_workspace_id) in ('admin', 'manager')
$$;

create or replace function public.agora_can_read_record(target_workspace_id text, target_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.agora_workspace_role(target_workspace_id) in ('admin', 'manager', 'member') then true
    when public.agora_workspace_role(target_workspace_id) = 'client'
      then coalesce(target_company_id, '') <> ''
        and public.agora_workspace_company_id(target_workspace_id) = coalesce(target_company_id, '')
    else false
  end
$$;

create or replace function public.agora_can_write_member_record(target_workspace_id text, target_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.agora_workspace_role(target_workspace_id) in ('admin', 'manager', 'member') then true
    when public.agora_workspace_role(target_workspace_id) = 'client'
      then coalesce(target_company_id, '') <> ''
        and public.agora_workspace_company_id(target_workspace_id) = coalesce(target_company_id, '')
    else false
  end
$$;

create or replace function public.agora_can_write_team_record(target_workspace_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.agora_workspace_role(target_workspace_id) in ('admin', 'manager', 'member')
$$;

create or replace function public.agora_can_write_presence(target_workspace_id text, target_company_id text, target_member_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.agora_workspace_role(target_workspace_id) in ('admin', 'manager') then true
    when public.agora_workspace_role(target_workspace_id) in ('member', 'client')
      then auth.uid()::text = coalesce(target_member_id, '')
        and (
          public.agora_workspace_role(target_workspace_id) = 'member'
          or (
            coalesce(target_company_id, '') <> ''
            and public.agora_workspace_company_id(target_workspace_id) = coalesce(target_company_id, '')
          )
        )
    else false
  end
$$;

drop policy if exists agora_memberships_select_own_workspace on public.agora_workspace_memberships;
create policy agora_memberships_select_own_workspace
on public.agora_workspace_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.agora_workspace_role(workspace_id) in ('admin', 'manager')
);

drop policy if exists agora_memberships_admin_write on public.agora_workspace_memberships;
create policy agora_memberships_admin_write
on public.agora_workspace_memberships
for all
to authenticated
using (public.agora_workspace_role(workspace_id) = 'admin')
with check (public.agora_workspace_role(workspace_id) = 'admin');

drop policy if exists agora_workspace_snapshots_member_read on public.agora_workspace_snapshots;
create policy agora_workspace_snapshots_member_read
on public.agora_workspace_snapshots
for select
to authenticated
using (public.agora_workspace_role(workspace_id) in ('admin', 'manager', 'member'));

drop policy if exists agora_workspace_snapshots_manager_write on public.agora_workspace_snapshots;
create policy agora_workspace_snapshots_manager_write
on public.agora_workspace_snapshots
for all
to authenticated
using (public.agora_can_write_workspace(workspace_id))
with check (public.agora_can_write_workspace(workspace_id));

drop policy if exists agora_audit_events_manager_read on public.agora_audit_events;
create policy agora_audit_events_manager_read
on public.agora_audit_events
for select
to authenticated
using (public.agora_workspace_role(workspace_id) in ('admin', 'manager'));

drop policy if exists agora_audit_events_manager_insert on public.agora_audit_events;
create policy agora_audit_events_manager_insert
on public.agora_audit_events
for insert
to authenticated
with check (public.agora_can_write_workspace(workspace_id));

drop policy if exists agora_companies_member_read on public.agora_companies;
create policy agora_companies_member_read on public.agora_companies
for select to authenticated
using (public.agora_can_read_record(workspace_id, id));

drop policy if exists agora_companies_manager_write on public.agora_companies;
create policy agora_companies_manager_write on public.agora_companies
for all to authenticated
using (public.agora_can_write_workspace(workspace_id))
with check (public.agora_can_write_workspace(workspace_id));

drop policy if exists agora_approvals_member_read on public.agora_approvals;
create policy agora_approvals_member_read on public.agora_approvals
for select to authenticated
using (public.agora_can_read_record(workspace_id, company_id));

drop policy if exists agora_approvals_member_write on public.agora_approvals;
create policy agora_approvals_member_write on public.agora_approvals
for all to authenticated
using (public.agora_can_write_member_record(workspace_id, company_id))
with check (public.agora_can_write_member_record(workspace_id, company_id));

drop policy if exists agora_time_entries_member_read on public.agora_time_entries;
create policy agora_time_entries_member_read on public.agora_time_entries
for select to authenticated
using (public.agora_can_read_workspace(workspace_id));

drop policy if exists agora_time_entries_member_write on public.agora_time_entries;
create policy agora_time_entries_member_write on public.agora_time_entries
for all to authenticated
using (public.agora_can_write_team_record(workspace_id))
with check (public.agora_can_write_team_record(workspace_id));

drop policy if exists agora_comments_member_read on public.agora_comments;
create policy agora_comments_member_read on public.agora_comments
for select to authenticated
using (public.agora_can_read_record(workspace_id, company_id));

drop policy if exists agora_comments_member_write on public.agora_comments;
create policy agora_comments_member_write on public.agora_comments
for all to authenticated
using (public.agora_can_write_member_record(workspace_id, company_id))
with check (public.agora_can_write_member_record(workspace_id, company_id));

drop policy if exists agora_activities_member_read on public.agora_activities;
create policy agora_activities_member_read on public.agora_activities
for select to authenticated
using (public.agora_can_read_record(workspace_id, company_id));

drop policy if exists agora_activities_member_write on public.agora_activities;
create policy agora_activities_member_write on public.agora_activities
for all to authenticated
using (public.agora_can_write_member_record(workspace_id, company_id))
with check (public.agora_can_write_member_record(workspace_id, company_id));

drop policy if exists agora_documents_member_read on public.agora_documents;
create policy agora_documents_member_read on public.agora_documents
for select to authenticated
using (public.agora_can_read_record(workspace_id, company_id));

drop policy if exists agora_documents_member_write on public.agora_documents;
create policy agora_documents_member_write on public.agora_documents
for all to authenticated
using (public.agora_can_write_team_record(workspace_id))
with check (public.agora_can_write_team_record(workspace_id));

drop policy if exists agora_files_member_read on public.agora_files;
create policy agora_files_member_read on public.agora_files
for select to authenticated
using (public.agora_can_read_record(workspace_id, company_id));

drop policy if exists agora_files_member_write on public.agora_files;
create policy agora_files_member_write on public.agora_files
for all to authenticated
using (public.agora_can_write_team_record(workspace_id))
with check (public.agora_can_write_team_record(workspace_id));

drop policy if exists agora_presence_member_read on public.agora_presence;
create policy agora_presence_member_read on public.agora_presence
for select to authenticated
using (public.agora_can_read_workspace(workspace_id));

drop policy if exists agora_presence_member_write on public.agora_presence;
create policy agora_presence_member_write on public.agora_presence
for all to authenticated
using (public.agora_can_write_presence(workspace_id, company_id, member_id))
with check (public.agora_can_write_presence(workspace_id, company_id, member_id));
