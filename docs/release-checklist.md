# Release Checklist

Use this checklist before tagging, deploying, or telling a team to run Agora in production.

For the hosted cutover sequence, use the [`hosted-launch-runbook.md`](./hosted-launch-runbook.md) alongside this checklist.

For the automated product gate, use [`qa-gate.md`](./qa-gate.md).

## 1. Local App

- Run `npm run dev` and open `http://127.0.0.1:5174`.
- Confirm the landing page, Dashboard, Today, Board, Marketplace, Permissions, Data, Settings, and mobile-width navigation render.
- Confirm Android Chrome can install Agora as a standalone PWA with the launcher icon, screenshots, and shortcuts from `manifest.webmanifest`.
- Confirm the installed Android PWA opens in airplane mode, supports local edits, and can export workspace JSON offline.
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
- Confirm Backend Health shows Supabase environment credentials set, structured records reachable, file uploads configured, Email diagnostics, and production mode ready.
- Run `npm run test:supabase` against a test workspace before pointing a real team at the project.

## 4. Verification Commands

Confirm the GitHub Actions `QA` workflow is green for the commit being released.

```sh
npm run release:evidence
npm run release:check
npm run distribution:evidence -- --release v0.1-beta
npm run qa
npm run verify
npm run trust
npm run package:check
npm run verify:upgrade
npm run drill:recovery -- --backup <server-backup.json>
npm run launch:check
```

For quicker iteration or debugging, the underlying commands are:

```sh
npm run check
npm run test:fixtures
npm run test:importers
npm run test:golden
npm run test:api
```

Fix any failure before releasing. `release:evidence` writes timestamped local gate output to `release/evidence/<commit>/` and updates the live candidate doc. `release:check` verifies the live candidate handoff, manifest gate, and release docs are connected. `distribution:evidence` writes the per-channel source, Docker, hosted, PWA, desktop, CLI, MCP, and portable-data proof bundle used to fill the release ledger. `qa` runs quick verification plus browser golden-path QA. `trust` verifies the customer-facing trust evidence. `package:check` verifies the source, Docker, hosted, PWA, desktop, CLI, MCP, and portable-data release manifest. `verify:upgrade` checks migration-file presence and latest server-backup validity before production upgrades. `drill:recovery` proves the selected backup can restore into an isolated workspace file with matching identity and counts. `launch:check` remains the shorter launch-focused gate. `test:importers` checks generic CSV, Trello JSON, and migration concierge planning/apply behavior. `test:golden` browser-checks the app shell, PWA/offline fallback, first-run dashboard, template-to-project path, marketplace automation path, Data recovery/schema/offline readiness, Settings sync/security/feedback tabs, feature request triage, and mobile/public feedback paths. `test:api` covers auth, permissions, structured records, payments, marketplace publishing, scheduler behavior, audit logs, and API persistence.

## 5. Security Gate

- Keep `SUPABASE_SERVICE_ROLE_KEY`, AI provider keys, Stripe keys, SMTP secrets, and webhook secrets server-only.
- Disable `AGORA_DEMO_AUTH` and `AGORA_PASSWORDLESS_AUTH` outside trusted demos.
- Confirm `AGORA_ALLOWED_ORIGINS` only includes expected app origins.
- Confirm Email diagnostics is acceptable for the environment: SMTP/sender configured for invites and feature requests, and SMTP or webhook configured for password reset in production.
- Review Admin > Permissions for excess admins, workspace import access, and Operator client-data access.
- If enabling MCP, review `docs/mcp-server.md` and `docs/mcp-security-audit.md`, keep `AGORA_MCP_ALLOW_WRITES=false` by default, and use a least-privilege user token.
- For customer migrations, run `npm run migrate:concierge -- <export-file> --source <source> --workspace <workspace.json> --backup <backup-or-bundle.json>` first, review field coverage, skipped data, warnings, confidence, rollback evidence, and sample tasks, then run `npm run agora -- migrate preview` before applying the imported workspace to a new output file.
- Export a recovery bundle before importing data, changing auth settings, or switching storage drivers.

## 6. Deploy

- Deploy the static app with `npm run start` or the static host equivalent.
- Deploy the API with `npm run start:api`.
- Set production environment variables in the host dashboard, not in client code.
- Confirm `/api/health`, `/api/backend/health`, `/api/payments/config`, and `/api/marketplace/catalog` respond after sign-in.
- Confirm `/api/health` and Settings > Developer show the expected app/server version and deploy commit.
- Open Settings > Account and complete Hosted onboarding.
- Open Backend Health and confirm the hosted launch runbook shows environment, persistence, email, public surface, recovery, and billing posture.
- Send one invite and one public feature request, then confirm the email jobs queue or deliver through the configured provider.
- Run a real browser pass on desktop, Android phone width, iPhone width, and iPad width.

## 7. Rollback

- Keep the previous deployment available until API sync, auth, file upload, marketplace, and workspace load checks pass.
- If a release corrupts workspace state, restore from the latest portable bundle or local/API backup.
- If a migration fails, stop the API, restore Supabase from backup, and redeploy the previous release.
- Before retrying the upgrade, rerun `npm run verify:upgrade` and confirm the backup artifact is fresh.
