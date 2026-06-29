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

Then open Settings, create the first workspace owner account or connect as a demo member, and use the Data page to save or load the workspace snapshot. If the API is not running at the default address, set the API URL in Settings and reload the app.

Settings and Data also expose Backend Health after you connect. It reports the active storage/auth drivers, production-mode readiness, workspace snapshot metadata, structured record collections, client scoping, and any failed browser syncs that can be retried.

## App Server

The browser app is served by the same dependency-free Node foundation:

```sh
npm run dev
```

It listens on `http://127.0.0.1:5174` by default. Override with:

```sh
AGORA_APP_PORT=5175 npm run dev
```

## Supabase Storage

Agora can use Supabase Postgres for API persistence without adding a Node dependency. The storage adapter talks to Supabase through PostgREST using server-only credentials.

1. Create a Supabase project.
2. Run [`migrations/001_supabase_storage.sql`](./migrations/001_supabase_storage.sql) and [`migrations/002_supabase_auth_rls.sql`](./migrations/002_supabase_auth_rls.sql) in the Supabase SQL editor.
3. Set these values in `.env`:

```sh
AGORA_STORAGE_DRIVER=supabase
AGORA_AUTH_DRIVER=supabase
AGORA_WORKSPACE_ID=workspace-acme
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Restart the API:

```sh
npm run dev:api
```

Keep `SUPABASE_SERVICE_ROLE_KEY` on the server only. `SUPABASE_ANON_KEY` is used by the API to validate Supabase Auth access tokens.

The first migration creates the snapshot/audit tables plus structured record tables for `companies`, `approvals`, `timeEntries`, `comments`, `activities`, `documents`, `files`, and `presence`. The second migration creates `agora_workspace_memberships`, RLS helper functions, and policies for Supabase Auth users. The JSON driver stores records inside the workspace snapshot for local development; the Supabase driver writes them to dedicated `agora_*` tables through the same `/api/records/:collection` API.

## Endpoints

- `GET /api/health`: service health and active workspace metadata.
- `GET /api/backend/health`: authenticated backend readiness, storage/auth drivers, workspace snapshot metadata, structured collection counts, production-mode status, and current session scope.
- `POST /api/auth/signup`: creates the first workspace owner account, or accepts a pending invited account. Body: `{ "name": "Mara Chen", "email": "mara@example.com", "password": "8+ characters" }`.
- `POST /api/auth/demo-login`: creates a demo session. Body: `{ "memberId": "mara" }`.
- `POST /api/auth/login`: creates a passwordless session for an accepted workspace user. Body: `{ "email": "jordan@example.com" }`.
- `POST /api/auth/password-login`: creates a session with email and password. Body: `{ "email": "jordan@example.com", "password": "8+ characters" }`.
- `POST /api/auth/supabase-login`: exchanges a Supabase Auth access token for an Agora API session when `AGORA_AUTH_DRIVER=supabase`. Body: `{ "accessToken": "supabase-access-token" }`.
- `POST /api/auth/logout`: clears the current session.
- `GET /api/session`: returns the current authenticated session.
- `GET /api/members`: returns workspace users, memberships, and invitations.
- `GET /api/invitations`: lists workspace invitations for admins.
- `POST /api/invitations`: creates or refreshes an invitation for admins. Body: `{ "email": "jordan@example.com", "name": "Jordan Lee", "role": "member", "companyId": "optional-company-id" }`.
- `GET /api/invitations/:token`: returns public invitation details for an invite acceptance screen.
- `POST /api/invitations/:token/accept`: accepts an invitation and creates a session. Body: `{ "name": "Jordan Lee", "password": "optional 8+ characters" }`.
- `GET /api/records`: returns structured collections from the active storage adapter. When no structured rows exist yet, the response includes `snapshotFallback` for bootstrap compatibility.
- `GET /api/records/:collection`: returns a structured collection such as `companies`, `approvals`, `timeEntries`, `comments`, `activities`, `documents`, `files`, or `presence`. Supports filters like `?projectId=...`, `?taskId=...`, `?companyId=...`, and `?memberId=...`.
- `POST /api/records/:collection`: creates or updates one structured record for supported collections.
- `GET /api/workspace`: returns the latest saved workspace snapshot.
- `PUT /api/workspace`: saves a workspace snapshot for admin/project-manager roles.
- `POST /api/workspace/import`: imports a workspace snapshot for admins.
- `GET /api/projects`: lists projects from the current workspace snapshot.
- `POST /api/projects`: creates a project for admin/project-manager roles.
- `PUT /api/projects/:id`: updates a project for admin/project-manager roles.
- `DELETE /api/projects/:id`: archives a project and its tasks for admin/project-manager roles.
- `POST /api/projects/:id/restore`: restores an archived project for admin/project-manager roles.
- `GET /api/tasks`: lists tasks from the current workspace snapshot. Supports `?projectId=...`.
- `POST /api/tasks`: creates a task for admin/project-manager roles.
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
- `GET /api/audit-log`: returns recent workspace audit events for admin/project-manager roles.

Authenticated routes expect:

```http
Authorization: Bearer <token>
```

## Roles

- `admin`: read/write/import workspace data, read audit log, manage members, and respond to approvals.
- `manager`: read/write workspace data, read audit log, and respond to approvals.
- `member`: read workspace data, add comments/activity, and add attachments.
- `client`: read scoped workspace data, add comments/activity, and respond to approvals.

Client memberships can include `companyId`. When present, workspace snapshots and structured record reads are scoped to that company before they are returned to the browser.

## Database Target

`schema.sql` is the normalized PostgreSQL target for the self-hosted backend. `migrations/001_supabase_storage.sql` stores the current workspace snapshot, audit log, and structured record collections in Postgres. `migrations/002_supabase_auth_rls.sql` adds the Supabase Auth membership/RLS layer. The JSON storage adapter remains the low-friction local default while Supabase provides the production-ready persistence path.
