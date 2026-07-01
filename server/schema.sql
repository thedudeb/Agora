-- Agora backend schema draft for the self-hosted PostgreSQL target.

create table users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text,
  password_salt text,
  password_key_length integer,
  password_cost integer,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspaces (
  id text primary key,
  name text not null,
  slug text not null unique,
  visibility text not null default 'private',
  default_role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_memberships (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table workspace_invitations (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'member',
  status text not null default 'pending',
  token text not null unique,
  invited_by text references users(id),
  accepted_by text references users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table companies (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  type text not null default 'Client',
  owner_id text references users(id),
  status text not null default 'active',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  company_id text references companies(id) on delete set null,
  name text not null,
  description text not null default '',
  owner_id text references users(id),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id text references users(id),
  status text not null default 'todo',
  priority text not null default 'normal',
  start_date date,
  due_date date,
  tags jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_dependencies (
  task_id text not null references tasks(id) on delete cascade,
  blocked_by_task_id text not null references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, blocked_by_task_id)
);

create table subtasks (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table comments (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  author_id text references users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table milestones (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  owner_id text references users(id),
  status text not null default 'planned',
  due_date date,
  task_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table time_entries (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  task_id text references tasks(id) on delete set null,
  user_id text references users(id),
  entry_date date not null,
  minutes integer not null check (minutes > 0),
  billable boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notifications (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  task_id text references tasks(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table background_jobs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
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

create table presence (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  route text not null default 'dashboard',
  project_id text references projects(id) on delete set null,
  task_id text references tasks(id) on delete set null,
  viewing text not null default '',
  status text not null default 'online',
  last_active_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table documents (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  title text not null,
  type text not null default 'Note',
  owner_id text references users(id),
  body text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table files (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  title text not null,
  kind text not null default 'File',
  size_label text not null default '',
  owner_id text references users(id),
  storage_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table approvals (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  task_id text references tasks(id) on delete set null,
  title text not null,
  requester_id text references users(id),
  reviewer text not null default '',
  status text not null default 'requested',
  due_date date,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table intake_forms (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  title text not null,
  assignee_id text references users(id),
  description text not null default '',
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table intake_submissions (
  id text primary key,
  form_id text not null references intake_forms(id) on delete cascade,
  task_id text references tasks(id) on delete set null,
  title text not null,
  requester text not null,
  company text not null default '',
  urgency text not null default 'Normal',
  details text not null,
  created_at timestamptz not null default now()
);

create table audit_events (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  actor_id text references users(id),
  action text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_memberships_user on workspace_memberships(user_id);
create index idx_workspace_invitations_email on workspace_invitations(workspace_id, email);
create index idx_companies_workspace on companies(workspace_id);
create index idx_projects_workspace on projects(workspace_id);
create index idx_tasks_workspace_project on tasks(workspace_id, project_id);
create index idx_tasks_assignee on tasks(assignee_id);
create index idx_time_entries_workspace_date on time_entries(workspace_id, entry_date);
create index idx_approvals_workspace_project on approvals(workspace_id, project_id);
create index idx_approvals_company_status on approvals(company_id, status);
create index idx_notifications_user_unread on notifications(user_id, read_at) where archived_at is null;
create index idx_presence_workspace_user on presence(workspace_id, user_id, updated_at desc);
create index idx_presence_task on presence(workspace_id, task_id, updated_at desc);
create index idx_audit_events_workspace_created on audit_events(workspace_id, created_at desc);

alter table workspaces enable row level security;
alter table workspace_memberships enable row level security;
alter table workspace_invitations enable row level security;
alter table companies enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_dependencies enable row level security;
alter table subtasks enable row level security;
alter table comments enable row level security;
alter table milestones enable row level security;
alter table time_entries enable row level security;
alter table notifications enable row level security;
alter table presence enable row level security;
alter table documents enable row level security;
alter table files enable row level security;
alter table approvals enable row level security;
alter table intake_forms enable row level security;
alter table intake_submissions enable row level security;
alter table audit_events enable row level security;

-- Supabase Auth production policy sketch. Replace auth.uid()::text with the
-- provider-specific user id mapping if self-hosting without Supabase Auth.
create policy workspace_member_read on workspaces
  for select using (
    exists (
      select 1 from workspace_memberships
      where workspace_memberships.workspace_id = workspaces.id
      and workspace_memberships.user_id = auth.uid()::text
      and workspace_memberships.status = 'active'
    )
  );

create policy workspace_member_rows on workspace_memberships
  for select using (
    workspace_id in (
      select workspace_id from workspace_memberships as own_memberships
      where own_memberships.user_id = auth.uid()::text
      and own_memberships.status = 'active'
    )
  );
