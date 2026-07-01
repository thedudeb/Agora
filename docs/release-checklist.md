# Release Checklist

Use this checklist before tagging, deploying, or telling a team to run Agora in production.

## 1. Local App

- Run `npm run dev` and open `http://127.0.0.1:5174`.
- Confirm the landing page, Dashboard, Today, Board, Marketplace, Permissions, Data, Settings, and mobile-width navigation render.
- Create a local backup from Data before testing destructive imports.
- Export a portable workspace bundle and confirm it includes `workspace.json`, templates, automations, Markdown, CSV, audit, and operator context.

## 2. Local API

- Copy `.env.example` to `.env`.
- Run `npm run dev:api`.
- Open `http://127.0.0.1:8787/api/health`.
- Connect from Settings, save to API, load from API, and refresh Backend Health.
- Open Marketplace, publish the local catalog, then load the API catalog.
- Open Admin > Permissions and confirm roles, member scopes, and Operator guardrails match the intended launch posture.

## 3. Supabase

- Follow [`supabase-setup.md`](./supabase-setup.md) for the full setup and troubleshooting path.
- Run `server/migrations/001_supabase_storage.sql`.
- Run `server/migrations/002_supabase_auth_rls.sql`.
- Run `server/migrations/003_background_jobs.sql`.
- Create the private `agora-files` bucket.
- Set `AGORA_STORAGE_DRIVER=supabase`, `AGORA_AUTH_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `AGORA_SUPABASE_STORAGE_BUCKET`.
- Restart the API and verify Backend Health shows Supabase storage and Supabase Auth.
- Confirm Backend Health shows Supabase environment credentials set, structured records reachable, file uploads configured, and production mode ready.
- Run `npm run test:supabase` against a test workspace before pointing a real team at the project.

## 4. Verification Commands

```sh
npm run verify
npm run launch:check
```

For quicker iteration or debugging, the underlying commands are:

```sh
npm run check
npm run test:fixtures
npm run test:golden
npm run test:api
```

Fix any failure before releasing. `launch:check` runs quick verification plus browser golden-path QA. `test:golden` browser-checks the first-run dashboard, template-to-project path, marketplace automation path, and portable recovery path. `test:api` covers auth, permissions, structured records, payments, marketplace publishing, scheduler behavior, audit logs, and API persistence.

## 5. Security Gate

- Keep `SUPABASE_SERVICE_ROLE_KEY`, AI provider keys, Stripe keys, SMTP secrets, and webhook secrets server-only.
- Disable `AGORA_DEMO_AUTH` and `AGORA_PASSWORDLESS_AUTH` outside trusted demos.
- Confirm `AGORA_ALLOWED_ORIGINS` only includes expected app origins.
- Review Admin > Permissions for excess admins, workspace import access, and Operator client-data access.
- Export a recovery bundle before importing data, changing auth settings, or switching storage drivers.

## 6. Deploy

- Deploy the static app with `npm run start` or the static host equivalent.
- Deploy the API with `npm run start:api`.
- Set production environment variables in the host dashboard, not in client code.
- Confirm `/api/health`, `/api/backend/health`, `/api/payments/config`, and `/api/marketplace/catalog` respond after sign-in.
- Run a real browser pass on desktop, iPhone width, and iPad width.

## 7. Rollback

- Keep the previous deployment available until API sync, auth, file upload, marketplace, and workspace load checks pass.
- If a release corrupts workspace state, restore from the latest portable bundle or local/API backup.
- If a migration fails, stop the API, restore Supabase from backup, and redeploy the previous release.
