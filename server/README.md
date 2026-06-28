# Agora API

This directory contains the first backend foundation for Agora. It is intentionally dependency-free while the product surface is still moving quickly.

## Run

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

Then open Settings, connect as a demo member, and use the Data page to save or load the workspace snapshot.

## Endpoints

- `GET /api/health`: service health and active workspace metadata.
- `POST /api/auth/demo-login`: creates a demo session. Body: `{ "memberId": "mara" }`.
- `POST /api/auth/logout`: clears the current session.
- `GET /api/session`: returns the current authenticated session.
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
- `GET /api/comments`: lists comments from the current workspace snapshot. Supports `?taskId=...`.
- `POST /api/comments`: creates or updates a comment.
- `GET /api/activities`: lists activity entries. Supports `?projectId=...` and `?taskId=...`.
- `POST /api/activities`: creates or updates an activity entry.
- `GET /api/documents`: lists documents. Supports `?projectId=...`.
- `POST /api/documents`: creates or updates a project document.
- `GET /api/files`: lists attachment records. Supports `?projectId=...`.
- `POST /api/files`: creates or updates an attachment record.
- `GET /api/audit-log`: returns recent workspace audit events for admin/project-manager roles.

Authenticated routes expect:

```http
Authorization: Bearer <token>
```

## Roles

- `admin`: read/write/import workspace data, read audit log, manage members.
- `manager`: read/write workspace data, read audit log.
- `member`: read workspace data.
- `client`: read workspace data.

## Database Target

`schema.sql` is the PostgreSQL target for the self-hosted backend. The current JSON storage adapter gives us a low-friction local API while preserving a clear migration path to database-backed persistence.
