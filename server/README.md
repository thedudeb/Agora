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

## Endpoints

- `GET /api/health`: service health and active workspace metadata.
- `POST /api/auth/demo-login`: creates a demo session. Body: `{ "memberId": "mara" }`.
- `POST /api/auth/logout`: clears the current session.
- `GET /api/session`: returns the current authenticated session.
- `GET /api/workspace`: returns the latest saved workspace snapshot.
- `PUT /api/workspace`: saves a workspace snapshot for admin/project-manager roles.
- `POST /api/workspace/import`: imports a workspace snapshot for admins.
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
