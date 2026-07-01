# Supabase Setup And Verification

Use this guide when you want Agora's API to store workspace data, structured records, auth sessions, and uploaded files in Supabase instead of local JSON files.

## What Supabase Provides

- Postgres persistence for workspace snapshots, audit events, and structured records.
- Supabase Auth email/password signup, login, and bearer-token exchange through the Agora API.
- Private Supabase Storage for uploaded files.
- RLS-backed workspace memberships for hosted deployments.

Agora still keeps the browser app separate from server secrets. The browser talks to the Agora API. The API talks to Supabase.

## 1. Create The Supabase Project

In Supabase:

1. Create a project.
2. Copy the project URL.
3. Copy the anon key.
4. Copy the service role key.

Keep the service role key server-only. Do not paste it into browser settings or client-side code.

## 2. Run Migrations

Open the Supabase SQL editor and run these files in order:

1. [`server/migrations/001_supabase_storage.sql`](../server/migrations/001_supabase_storage.sql)
2. [`server/migrations/002_supabase_auth_rls.sql`](../server/migrations/002_supabase_auth_rls.sql)

The first migration creates Agora storage tables. The second migration adds Supabase Auth memberships, helper functions, and RLS policies.

## 3. Create The Storage Bucket

Create a private Supabase Storage bucket:

```text
agora-files
```

If you use another bucket name, set `AGORA_SUPABASE_STORAGE_BUCKET` to match.

## 4. Configure `.env`

Copy the template if needed:

```sh
cp .env.example .env
```

Then set:

```sh
AGORA_STORAGE_DRIVER=supabase
AGORA_AUTH_DRIVER=supabase
AGORA_WORKSPACE_ID=workspace-acme
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AGORA_SUPABASE_STORAGE_BUCKET=agora-files
```

For production, also keep demo auth disabled:

```sh
AGORA_DEMO_AUTH=false
AGORA_PASSWORDLESS_AUTH=false
```

## 5. Restart And Sign In

Restart the API after changing `.env`:

```sh
npm run dev:api
```

Run the app in another terminal:

```sh
npm run dev
```

Open `http://127.0.0.1:5174`, go to Settings, connect the API, then use the Supabase signup/sign-in controls. After sign-in, refresh Backend Health from Settings or Data.

Backend Health should show:

- Storage: `supabase`
- Auth: `supabase`
- Supabase environment: URL set / anon key set / service role set
- Structured records: reachable
- File uploads: Supabase bucket configured
- Production mode: ready

## 6. Run The End-To-End Verifier

Run:

```sh
npm run test:supabase
```

The verifier starts a temporary Agora API server using your Supabase credentials. It writes to a unique verification workspace by default and checks:

- API health boots with Supabase storage.
- Supabase Auth signup/login/token exchange.
- Workspace snapshot save/load.
- Structured records.
- Notification scheduler permissions.
- Marketplace payments and entitlements.
- Audit events.
- Supabase Storage upload/download.
- Backend Health readiness.

To reuse a stable verification workspace:

```sh
AGORA_VERIFY_WORKSPACE_ID=agora-verify-your-name
```

The verifier is non-destructive. It does not delete existing rows and does not touch your main `AGORA_WORKSPACE_ID` unless you explicitly reuse that same workspace ID.

## Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| API starts in `json-file` mode | `AGORA_STORAGE_DRIVER` is still `json` | Set `AGORA_STORAGE_DRIVER=supabase` and restart `npm run dev:api`. |
| Supabase sign-in controls fail | Auth driver or anon key is missing | Set `AGORA_AUTH_DRIVER=supabase` and `SUPABASE_ANON_KEY`, then restart the API. |
| Backend Health says structured records need attention | Migration 001 did not run or table access failed | Rerun `001_supabase_storage.sql`, confirm `SUPABASE_SERVICE_ROLE_KEY`, then refresh Backend Health. |
| Production mode is not ready | Storage and auth drivers are not both Supabase | Set both `AGORA_STORAGE_DRIVER=supabase` and `AGORA_AUTH_DRIVER=supabase`. |
| File upload fails in Supabase mode | Storage bucket is missing or named differently | Create a private `agora-files` bucket, or set `AGORA_SUPABASE_STORAGE_BUCKET` to the actual bucket name. |
| RLS or membership behavior looks wrong | Migration 002 did not run | Rerun `002_supabase_auth_rls.sql`, sign in again, then refresh Backend Health. |
| `npm run test:supabase` fails on network or credentials | `.env` values are placeholders or unreachable | Confirm URL/key values and run the command from an environment that can reach Supabase. |

## Pre-Launch Gate

Before inviting a real team:

- Backend Health reports Supabase storage and Supabase Auth.
- `npm run test:supabase` passes.
- `AGORA_DEMO_AUTH=false`.
- `AGORA_PASSWORDLESS_AUTH=false` unless intentionally enabled for a trusted environment.
- `AGORA_ALLOWED_ORIGINS` lists only expected browser origins.
- A private Supabase Storage bucket exists.
- A portable workspace export has been downloaded from Data.
