# Agora API

This directory contains the first backend foundation for Agora. It is intentionally dependency-free while the product surface is still moving quickly.

## Run

Copy the environment template once:

```sh
cp .env.example .env
```

The API loads `.env` automatically and defaults to local JSON storage.

```sh
npm run dev:api
```

The API listens on `http://127.0.0.1:8787` by default. Override with:

```sh
AGORA_API_PORT=8790 npm run dev:api
```

Workspace snapshots are stored as JSON in `server/data/` during local development. That directory is ignored by git.

To test sync from the browser prototype, run the app in a second terminal:

```sh
npm run dev
```

Then open Settings, create the first workspace owner account, sign in with email and password, and use the Data page to save or load the workspace snapshot. If the API is not running at the default address, set the API URL in Settings and reload the app.

Settings and Data also expose Backend Health after you connect. It reports the active storage/auth drivers, production-mode readiness, workspace snapshot metadata, structured record collections, session company scoping, and any failed browser syncs that can be retried.

Demo auth and passwordless email login are disabled by default. For trusted demos only, set `AGORA_DEMO_AUTH=true` or `AGORA_PASSWORDLESS_AUTH=true` in `.env` and restart the API. Session lifetime defaults to eight hours through `AGORA_SESSION_TTL_SECONDS`, invitations expire through `AGORA_INVITATION_TTL_DAYS`, password reset tokens expire through `AGORA_PASSWORD_RESET_TTL_MINUTES`, reset delivery is configured with `AGORA_PASSWORD_RESET_DELIVERY`, and cross-origin API calls are limited to localhost plus any origins listed in `AGORA_ALLOWED_ORIGINS`.

## App Server

The browser app is served by the same dependency-free Node foundation:

```sh
npm run dev
```

It listens on `http://127.0.0.1:5174` by default. Override with:

```sh
AGORA_APP_PORT=5175 npm run dev
```

Use `npm start` for hosted static app runtimes and `npm run start:api` for hosted API runtimes.

## Power-User CLI

Agora includes a small dependency-free CLI for self-hosters and contributors:

```sh
npm run agora -- help
npm run agora -- verify
npm run agora -- verify --quick
npm run agora -- verify --supabase
npm run agora -- api
npm run agora -- recovery
npm run agora -- screenshots
npm run agora -- golden
npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json
npm run agora -- marketplace validate templates/marketplace.json
npm run agora -- migrate preview tests/fixtures/trello-board.json --source trello-json
```

`verify` runs syntax checks, fixture validation, recovery stress checks, migration importer checks, and the API smoke test. `--quick` skips the API smoke test, and `--supabase` includes the real Supabase verifier from `.env`. `golden` browser-checks onboarding and core product paths. `bundle inspect` summarizes portable workspace exports, `marketplace validate` checks project-template and automation-pack JSON before sharing it, and `migrate preview/apply` prepares Trello JSON or generic CSV exports for safer switching.

The package scripts expose the same preflight path:

```sh
npm run verify:quick
npm run verify
npm run test:recovery
npm run launch:check
npm run verify:supabase
```

## MCP Server

Agora also includes a local stdio MCP server for power-user clients:

```sh
AGORA_API_URL=http://127.0.0.1:8787 AGORA_API_TOKEN=replace-with-session-token npm run mcp
```

The MCP server uses the normal API, respects role permissions and company scope, and keeps writes disabled unless `AGORA_MCP_ALLOW_WRITES=true`. See [`../docs/mcp-server.md`](../docs/mcp-server.md) for setup, client config examples, tools, resources, and security notes.

## Supabase Storage

Agora can use Supabase Postgres for API persistence without adding a Node dependency. The storage adapter talks to Supabase through PostgREST using server-only credentials.

For the full setup and verification runbook, see [`../docs/supabase-setup.md`](../docs/supabase-setup.md).

1. Create a Supabase project.
2. Run [`migrations/001_supabase_storage.sql`](./migrations/001_supabase_storage.sql), [`migrations/002_supabase_auth_rls.sql`](./migrations/002_supabase_auth_rls.sql), and [`migrations/003_background_jobs.sql`](./migrations/003_background_jobs.sql) in the Supabase SQL editor.
3. Set these values in `.env`:

```sh
AGORA_STORAGE_DRIVER=supabase
AGORA_AUTH_DRIVER=supabase
AGORA_WORKSPACE_ID=workspace-acme
AGORA_SCHEDULER_ENABLED=false
AGORA_SCHEDULER_INTERVAL_SECONDS=60
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Restart the API:

```sh
npm run dev:api
```

Keep `SUPABASE_SERVICE_ROLE_KEY` on the server only. `SUPABASE_ANON_KEY` is used by the API to validate Supabase Auth access tokens.

The first migration creates the snapshot/audit tables plus structured record tables for work records, collaboration records, first-class notification records, inbox state, and integration settings. The second migration creates `agora_workspace_memberships`, RLS helper functions, and policies for Supabase Auth users. The third migration creates `agora_background_jobs` for retryable email/worker job state. The JSON driver stores records inside the workspace snapshot for local development; the Supabase driver writes them to dedicated `agora_*` tables through the same `/api/records/:collection` API, with `limit` and `offset` pushed down to PostgREST for bounded reads. File objects are stored locally under `server/data/uploads/` with the JSON driver, or in the private Supabase Storage bucket configured by `AGORA_SUPABASE_STORAGE_BUCKET`.

To verify a real Supabase project end to end, run:

```sh
npm run test:supabase
```

The verifier starts a temporary Agora API server with Supabase storage, uses a unique `workspace_id` by default, and checks workspace snapshots, Supabase Auth, structured records, notification scheduler permissions, payment entitlements, audit events, Supabase Storage upload/download, and Backend Health readiness. Set `AGORA_VERIFY_WORKSPACE_ID=agora-verify-your-name` if you want a stable verification workspace. The script is intentionally non-destructive and does not delete existing workspace rows.

## Endpoints

- `GET /api/health`: service health and active workspace metadata.
- `GET /api/capabilities`: public API capability document for automation clients, importers, and agent hosts. Includes auth modes, public endpoints, canonical resources, structured collections, role permissions, and agent-safe defaults.
- `GET /api/openapi.json`: public OpenAPI 3.1 document for the core Agora API surface.
- `GET /api/backend/health`: authenticated backend readiness, storage/auth drivers, workspace snapshot metadata, structured collection counts, request metrics, background job state, production-mode status, and current session scope.
- `POST /api/backend/jobs/:id/retry`: retries a failed, rejected, or canceled background job for sessions with `scheduler:run`.
- `POST /api/backend/jobs/:id/cancel`: cancels a queued background job for sessions with `scheduler:run`.
- `POST /api/backend/jobs/:id/clear`: clears a completed, failed, rejected, or canceled background job from the recent operator console for sessions with `scheduler:run`.
- `GET /api/scheduler/notifications/due`: returns due, unsent notification reminders visible to the authenticated session.
- `POST /api/scheduler/notifications/run`: processes due reminders, marks them sent, and writes notification-history records. Use it from trusted cron, or set `AGORA_SCHEDULER_ENABLED=true` to run the scheduler inside the API process.
- `POST /api/payments/checkout-intent`: creates a server-side checkout intent for paid marketplace templates and other billable workspace items.
- `POST /api/payments/events`: records trusted payment events and grants matching entitlements when checkout or manual payment confirmation succeeds.
- `POST /api/auth/signup`: creates the first workspace owner account, or accepts a pending invited account. Body: `{ "name": "Mara Chen", "email": "mara@example.com", "password": "8+ characters" }`.
- `POST /api/auth/demo-login`: creates a demo session when `AGORA_DEMO_AUTH=true`. Body: `{ "memberId": "mara" }`.
- `POST /api/auth/login`: creates a passwordless session for an accepted workspace user when `AGORA_PASSWORDLESS_AUTH=true`. Body: `{ "email": "jordan@example.com" }`.
- `POST /api/auth/password-login`: creates a session with email and password. Body: `{ "email": "jordan@example.com", "password": "8+ characters" }`.
- `POST /api/auth/change-password`: changes the current authenticated password. Body: `{ "currentPassword": "...", "newPassword": "8+ characters" }`.
- `POST /api/auth/password-reset/request`: creates a short-lived password reset token. Body: `{ "email": "jordan@example.com" }`.
- `POST /api/auth/password-reset/confirm`: completes a password reset. Body: `{ "email": "jordan@example.com", "token": "...", "password": "8+ characters" }`.
- `POST /api/auth/supabase-password-signup`: creates a Supabase Auth email/password account through the API server when `AGORA_AUTH_DRIVER=supabase`. Body: `{ "name": "Jordan Lee", "email": "jordan@example.com", "password": "8+ characters" }`.
- `POST /api/auth/supabase-password-login`: signs in with Supabase Auth email/password through the API server when `AGORA_AUTH_DRIVER=supabase`. Body: `{ "email": "jordan@example.com", "password": "8+ characters" }`.
- `POST /api/auth/supabase-login`: exchanges a Supabase Auth access token for an Agora API session when `AGORA_AUTH_DRIVER=supabase`. Body: `{ "accessToken": "supabase-access-token" }`.
- `POST /api/auth/logout`: clears the current session.
- `GET /api/session`: returns the current authenticated session.
- `GET /api/auth/sessions`: lists active in-memory Agora sessions visible to the current user. Admins can see workspace sessions; other users see their own. Returned ids are hashes, not raw tokens.
- `DELETE /api/auth/sessions/:id`: revokes an active in-memory Agora session by hashed id. Users can revoke their own sessions; admins can revoke workspace sessions.
- `GET /api/members`: returns workspace users, memberships, and invitations.
- `GET /api/invitations`: lists workspace invitations for admins.
- `POST /api/invitations`: creates or refreshes an invitation for admins. Body: `{ "email": "jordan@example.com", "name": "Jordan Lee", "role": "member", "companyId": "optional-company-id" }`.
- `POST /api/invitations/:id/resend`: refreshes a pending invitation token and expiry for admins.
- `DELETE /api/invitations/:id`: revokes a pending invitation for admins.
- `GET /api/invitations/:token`: returns public invitation details for an invite acceptance screen.
- `POST /api/invitations/:token/accept`: accepts an invitation and creates a session. Body: `{ "name": "Jordan Lee", "password": "optional 8+ characters" }`.
- `GET /api/portal-links`: lists hosted client portal links for the authenticated workspace scope. Responses include `tokenId`, never the raw token or token hash.
- `POST /api/portal-links`: creates a hosted client portal link for project-manager/admin roles. Body: `{ "companyId": "company-id", "packetSignature": "optional-client-packet-signature" }`. The raw `token` is returned once in the create response and only its SHA-256 hash is stored.
- `POST /api/portal-links/:id/events`: records hosted portal link events such as `{ "event": "copied" }` or `{ "event": "emailed" }`.
- `POST /api/portal-links/:id/rotate`: revokes active links for the same company and returns a new hosted portal link plus one-time raw token.
- `POST /api/portal-links/:id/revoke`: revokes a hosted portal link.
- `GET /api/portal-links/validate/:token`: validates a public hosted portal token, records the view, and returns company-scoped portal link metadata plus a safe `portalSnapshot` with client-visible projects, tasks, approvals, file/document metadata, and updates. Public validation is rate-limited by IP.
- `POST /api/portal-links/actions/:token`: performs a public hosted portal action and returns a refreshed `portalSnapshot`. Body examples: `{ "action": "approval", "approvalId": "approval-id", "status": "approved", "note": "Looks good" }`, `{ "action": "comment", "taskId": "task-id", "body": "Question..." }`, or `{ "action": "feature-request", "title": "Timeline view", "details": "..." }`. Actions are company-scoped, visibility-checked, audited, and written to notification history.
- `GET /api/public/feature-requests`: returns the public feature request form configuration.
- `POST /api/public/feature-requests`: creates a public feature-request task and sends an owner email when feature-request SMTP is configured. Public submissions are capped by `AGORA_PUBLIC_FEATURE_BODY_LIMIT_BYTES`.
- `GET /api/records`: returns structured collections from the active storage adapter. When no structured rows exist yet, the response includes `snapshotFallback` for bootstrap compatibility.
- `GET /api/records/:collection`: returns a structured collection such as `companies`, `approvals`, `timeEntries`, `comments`, `activities`, `documents`, `files`, `presence`, `chatMessages`, `whiteboards`, `notificationSettings`, `notificationReminders`, `notificationHistory`, `inboxState`, or `integrationSettings`. Supports `?limit=...`, `?offset=...`, and filters like `?projectId=...`, `?taskId=...`, `?companyId=...`, and `?memberId=...`.
- `POST /api/records/:collection`: creates or updates one structured record for supported collections. Writes are checked server-side against the authenticated session scope, project, task, company relationships, and member-owned fields. Clients can respond to existing approvals but cannot create new approval records.
- `GET /api/workspace`: returns the latest saved workspace snapshot.
- `PUT /api/workspace`: saves a workspace snapshot for workspace-wide admin/project-manager roles. Company-scoped sessions must use project, task, and structured record endpoints.
- `POST /api/workspace/import`: imports a workspace snapshot for admins.
- `GET /api/projects`: lists the current session's canonical projects for API-connected clients. Supports `?limit=...`, `?offset=...`, `?query=...`, `?companyId=...`, and returns `page` metadata.
- `POST /api/projects`: creates a project for admin/project-manager roles.
- `PUT /api/projects/:id`: updates a project for admin/project-manager roles.
- `DELETE /api/projects/:id`: archives a project and its tasks for admin/project-manager roles.
- `POST /api/projects/:id/restore`: restores an archived project for admin/project-manager roles.
- `GET /api/tasks`: lists the current session's canonical tasks for API-connected clients. Supports `?limit=...`, `?offset=...`, `?query=...`, `?projectId=...`, `?companyId=...`, `?assignee=...`, `?status=...`, `?priority=...`, `?tag=...`, and returns `page` metadata.
- `POST /api/tasks`: creates a task for admin/project-manager roles.
- `POST /api/feature-requests`: creates a feature-request task and sends an owner email when `AGORA_FEATURE_REQUEST_EMAIL` and SMTP are configured.
- `POST /api/feature-requests/:id/updates`: updates the feature-request pipeline state and emails the requester when SMTP and requester email are available.
- `PUT /api/tasks/:id`: updates a task for admin/project-manager roles.
- `DELETE /api/tasks/:id`: archives a task for admin/project-manager roles.
- `POST /api/tasks/:id/restore`: restores an archived task for admin/project-manager roles.
- `GET /api/comments`: lists comments from structured storage. Supports `?taskId=...`.
- `POST /api/comments`: creates or updates a comment.
- `GET /api/activities`: lists activity entries from structured storage. Supports `?projectId=...` and `?taskId=...`.
- `POST /api/activities`: creates or updates an activity entry.
- `GET /api/documents`: lists documents from structured storage. Supports `?projectId=...`.
- `POST /api/documents`: creates or updates a project document.
- `GET /api/files`: lists attachment records from structured storage. Supports `?projectId=...`.
- `POST /api/files`: creates or updates an attachment record.
- `POST /api/files/upload`: uploads a base64 file object and creates the attachment record.
- `GET /api/files/:id/download`: downloads a stored file object through the authenticated API.
- `GET /api/audit-log`: returns recent workspace audit events for admin/project-manager roles.

Authenticated routes expect:

```http
Authorization: Bearer <token>
```

Automation clients should follow the API agent contract in [`../docs/api-agent-contract.md`](../docs/api-agent-contract.md). The short version: authenticate as a normal user, inspect `GET /api/session`, respect returned role permissions and company scope, use canonical project/task and structured-record endpoints before whole-workspace snapshots, keep tokens out of logs and exports, and require confirmation before destructive, external, payment, scheduler, import, or membership actions.

## Roles

- `admin`: read/write/import workspace data, read audit log, manage members, respond to approvals, manage notifications/integrations/payments, and run the server scheduler.
- `manager`: read/write workspace data, read audit log, respond to approvals, manage notifications/integrations/payments, and run the server scheduler.
- `member`: read workspace data, log their own time, add comments/activity, and add attachments.
- `client`: read scoped workspace data, add comments/activity, and respond to existing approvals.

Memberships can include `companyId`. When present, workspace snapshots, project/task reads, structured record reads, and write checks are scoped to that company before data is returned or accepted.

Sensitive operational actions use dedicated permissions in addition to role checks: `notifications:write` for delivery settings, `integrations:write` for integration setup and test events, `scheduler:run` for backend notification processing, and `payments:write` for checkout intents, payment events, entitlement grants, and payment settings.

## Database Target

`schema.sql` is the normalized PostgreSQL target for the self-hosted backend. `migrations/001_supabase_storage.sql` stores the current workspace snapshot, audit log, structured work records, first-class notification records, inbox state, and integration settings in Postgres. `migrations/002_supabase_auth_rls.sql` adds the Supabase Auth membership/RLS layer. `migrations/003_background_jobs.sql` persists retryable worker/email job state. The JSON storage adapter remains the low-friction local default while Supabase provides the production-ready persistence path.
