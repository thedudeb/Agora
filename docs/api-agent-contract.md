# Agora API Agent Contract

This contract defines the server API surface that automation clients can use safely, including the CLI, MCP server, native shells, and future workflow agents. Agents must authenticate as normal Agora users and must never bypass the server's role, company-scope, and record-level checks.

## Boundary

- Use the Agora API as the source of truth for connected automations.
- Send `Authorization: Bearer <token>` on authenticated requests.
- Treat bearer tokens as user credentials. Do not store them in exported workspaces, portable bundles, browser local storage for server-side tools, logs, screenshots, or prompts.
- Prefer canonical project and task endpoints over whole-workspace snapshots for routine reads and writes.
- Use the structured record endpoints for comments, activities, approvals, files, reminders, inbox state, chat, whiteboards, integrations, and notification records.
- Keep agents read-only by default. Require an explicit user or operator setting before creating, updating, archiving, importing, paying, scheduling, or sending external messages.

## Authentication

Agents can use any session token accepted by Agora:

- Password login: `POST /api/auth/password-login`
- Supabase token exchange: `POST /api/auth/supabase-login`
- Passwordless login when intentionally enabled: `POST /api/auth/login`
- Demo login only when `AGORA_DEMO_AUTH=true` in trusted local demos: `POST /api/auth/demo-login`

Production agents should use short-lived user sessions where possible and rotate tokens after demos, screenshots, exports, or handoffs.

## Roles And Permission Surface

Agora exposes permission names through server-side memberships. Agents should inspect `GET /api/session` and behave according to the returned role and permissions.

| Role | Agent-safe default | Key permissions |
| --- | --- | --- |
| `admin` | Full workspace automation with confirmation for destructive or external side effects. | `workspace:read`, `workspace:write`, `workspace:import`, `audit:read`, `members:write`, `projects:write`, `tasks:write`, `time:write`, `comments:write`, `activity:write`, `attachments:write`, `approvals:write`, `notifications:write`, `integrations:write`, `scheduler:run`, `payments:write` |
| `manager` | Project/task automation with confirmation for destructive or external side effects. | `workspace:read`, `workspace:write`, `audit:read`, `projects:write`, `tasks:write`, `time:write`, `comments:write`, `activity:write`, `attachments:write`, `approvals:write`, `notifications:write`, `integrations:write`, `scheduler:run`, `payments:write` |
| `member` | Personal productivity and collaboration assistance. | `workspace:read`, `time:write`, `comments:write`, `activity:write`, `attachments:write` |
| `client` | Client-safe review and collaboration assistance. | `workspace:read`, `comments:write`, `activity:write`, `approvals:write` |

If a membership includes `companyId`, the API scopes returned projects, tasks, snapshots, and structured records before the agent sees them. Agents must not infer or request data outside that company scope.

## Recommended Agent Reads

Use these endpoints for most automation and assistant context:

- `GET /api/session`: current user, role, permissions, and scope.
- `GET /api/backend/health`: authenticated readiness, storage/auth drivers, metrics, collection counts, production gates, and session scope.
- `GET /api/projects`: canonical projects with `limit`, `offset`, `query`, and `companyId` filters.
- `GET /api/tasks`: canonical tasks with `limit`, `offset`, `query`, `projectId`, `companyId`, `assignee`, `status`, `priority`, and `tag` filters.
- `GET /api/records/:collection`: structured collections such as `comments`, `activities`, `approvals`, `documents`, `files`, `chatMessages`, `whiteboards`, `notificationReminders`, `notificationHistory`, `inboxState`, and `integrationSettings`.
- `GET /api/workspace`: whole-workspace snapshot for export, restore, migration, and recovery workflows.
- `GET /api/audit-log`: recent workspace audit events for admin/project-manager sessions.

Agents should page large reads with `limit` and `offset`, cache only what they need, and summarize before sending workspace context to external models.

## Recommended Agent Writes

Writes should be narrow and previewable:

- `POST /api/projects` and `PUT /api/projects/:id` for project creation and updates.
- `POST /api/tasks` and `PUT /api/tasks/:id` for task creation and updates.
- `POST /api/comments` for task discussion and agent notes.
- `POST /api/activities` for auditable activity entries.
- `POST /api/records/:collection` for structured collaboration records.
- `POST /api/feature-requests` for authenticated feature requests that should become tasks.
- `POST /api/feature-requests/:id/updates` for feature-request pipeline updates and requester notifications.

Agents must ask for confirmation before:

- Importing or replacing a whole workspace through `POST /api/workspace/import` or `PUT /api/workspace`.
- Archiving or restoring projects and tasks.
- Sending emails, webhooks, payment events, or integration test events.
- Running the notification scheduler.
- Creating checkout intents, recording payment events, or granting entitlements.
- Changing invitations, memberships, roles, security settings, or integration credentials.

## Structured Collection Writes

Structured records use collection-specific permission checks:

| Collection | Write permission |
| --- | --- |
| `companies` | `projects:write` |
| `approvals` | `approvals:write` |
| `timeEntries` | `time:write` |
| `comments` | `comments:write` |
| `activities` | `activity:write` |
| `documents` | `attachments:write` |
| `files` | `attachments:write` |
| `presence` | `workspace:read` |
| `chatMessages` | `comments:write` |
| `whiteboards` | `comments:write` |
| `notificationSettings` | `notifications:write` |
| `notificationReminders` | `workspace:read` |
| `notificationHistory` | `workspace:read` |
| `inboxState` | `workspace:read` |
| `integrationSettings` | `integrations:write` |

The API also checks session scope, project/task/company relationships, and member-owned fields. Clients can respond to existing approvals but cannot create new approval records.

## Realtime And Polling

Agents that need live updates can use `GET /api/realtime/events` with the same session token, but polling canonical endpoints is preferred for simple automation. Realtime clients should reconnect with backoff and should not treat transient disconnects as failed writes.

## Audit Expectations

Agent actions should be attributable to a user session and should include plain-language rationale in comments, activities, or operator ledgers when they materially change work. User-facing tools should show:

- The records an agent plans to read or write.
- The role and company scope used for the action.
- A preview of each write.
- The undo or recovery path when one exists.

