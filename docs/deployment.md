# Agora Deployment Guide

This guide covers the blessed production path for Agora: Vercel/static app hosting, one long-running Node API service, Supabase persistence/Auth/Storage, SMTP or webhook email delivery, strict CSP, request observability, and server-side workspace backups.

## Local First Run

```sh
npm run setup
npm run dev
npm run dev:api
```

Open `http://127.0.0.1:5174`, go to Settings, create the first owner account, then save the workspace to the API from Settings or Data.

## Hosted Path Overview

For the current product shape, deploy Agora as two surfaces:

- Static app: Vercel or another static host that serves the repo root.
- API: a long-running Node service that runs `npm run start:api`, owns secrets, sends email, talks to Supabase, writes server backups, and serves authenticated uploads/downloads.

The recommended first production deployment is:

```text
Browser -> Vercel/static Agora app -> hosted Node API -> Supabase Postgres/Auth/Storage
```

The browser app should only know the Agora API URL entered in Settings. Keep Supabase service-role keys, SMTP credentials, AI provider keys, payment keys, webhook secrets, and backup paths on the API server.

For local setup, Docker Compose, and hosted environment bootstrap, see [`install.md`](./install.md). For provider handoff details across static app hosts, long-running Node API hosts, Supabase, and Docker servers, see [`hosted-provider-recipes.md`](./hosted-provider-recipes.md). `npm run setup -- --profile hosted` creates the production-shaped `.env` scaffold without filling secrets.

Recommended first production sequence:

1. Deploy the static app and API behind HTTPS.
2. Set the required production environment variables below.
3. Configure Supabase storage/auth and run migrations `001` through `007`.
4. Configure SMTP or password-reset webhook delivery.
5. Sign in, open Settings > Account, and use Hosted onboarding to complete owner, API sync, invite, email, feedback, and recovery checks.
6. Before upgrades or migration changes, run `npm run verify:upgrade`; for new launches, run `npm run verify:production -- --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict`, refresh Backend Health, and confirm production gates, email diagnostics, background jobs, structured records, backups, and Supabase mode are green.
7. Run `npm run security`, `npm run qa`, and confirm the GitHub Actions `QA + Security` workflow passes for the release commit.

## Required Production Environment

```sh
AGORA_APP_PORT=5174
AGORA_API_PORT=8787
AGORA_ALLOWED_ORIGINS=https://your-agora-app.example.com
AGORA_ALLOW_LOCALHOST_ORIGINS=false
AGORA_PUBLIC_APP_URL=https://your-agora-app.example.com
AGORA_EMAIL_FROM=Agora <no-reply@your-domain.example>
AGORA_FEATURE_REQUEST_EMAIL=owner@your-domain.example
AGORA_PUBLIC_FEATURE_BODY_LIMIT_BYTES=24576
AGORA_SESSION_TTL_SECONDS=28800
AGORA_INVITATION_TTL_DAYS=14
AGORA_PASSWORD_RESET_TTL_MINUTES=30
AGORA_DEMO_AUTH=false
AGORA_PASSWORDLESS_AUTH=false
AGORA_STRICT_CSP=true
AGORA_STRUCTURED_LOGS=true
AGORA_RELEASE_CHANNEL=production
AGORA_RELEASE_COMMIT=your-git-sha
AGORA_RELEASE_DATE=2026-07-03T00:00:00Z
AGORA_BACKUP_DIR=/var/lib/agora/backups
AGORA_BACKUP_RETENTION_FILES=20
AGORA_BACKUP_SCHEDULER_ENABLED=true
AGORA_BACKUP_INTERVAL_HOURS=24
AGORA_PUBLIC_FEATURE_REQUESTS=false
AGORA_GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
AGORA_AI_PROVIDER=local
AGORA_AI_ALLOW_CLIENT_BASE_URL=false
AGORA_AI_ALLOWED_BASE_URLS=
```

Use HTTPS in front of both app and API in production. Keep `AGORA_ALLOWED_ORIGINS` limited to the browser origins that should call the API, and keep implicit localhost CORS disabled outside development.

Backend Health reports production gates for the hosted path:

- `Allowed origins`: `AGORA_ALLOWED_ORIGINS` is set to the exact browser origin.
- `Production CORS policy`: implicit localhost origins are disabled and all configured browser origins are hosted HTTPS origins.
- `Public app URL`: `AGORA_PUBLIC_APP_URL` is a hosted HTTPS URL for invite, reset, and feedback emails.
- `Auth entrypoints`: demo and passwordless auth are disabled.
- `Password reset delivery`: SMTP or webhook delivery is configured, with browser token return disabled.
- `Team email delivery`: SMTP, sender, invitations, and feature request owner emails are configured.
- `Public feature abuse limits`: public feedback body and rate limits are intentionally low.
- `Rate-limit IP source`: direct socket IPs are used unless `AGORA_TRUST_PROXY=true` is intentionally enabled behind a trusted proxy.
- `Strict CSP`: hosted app/static servers run with `AGORA_STRICT_CSP=true` or `NODE_ENV=production`.
- `Workspace backups`: the API can write scheduled server-side backups to a durable mounted directory.
- `AI provider hardening`: provider keys stay server-side; client-provided AI base URLs are disabled or explicitly allowlisted.

The API also exposes release metadata on `/api/health`, `/api/capabilities`, Backend Health, and redacted Admin Diagnostics. Set `AGORA_RELEASE_COMMIT` and `AGORA_RELEASE_DATE` from your deploy host when available; Vercel and Render commit variables are detected automatically.

Settings > Account also shows Hosted onboarding, which is the operator-facing path for first-owner signup, API sync, teammate/client invite, email delivery, public feedback, and recovery proof.

## Production Verification

Use one command for the hosted production gate:

```sh
npm run verify:production -- --env .env.production --backup /var/lib/agora/backups/agora-workspace-backup-latest.json --bundle ./agora-launch-bundle.json --strict
```

That command chains:

- Hosted environment verification.
- Hosted deploy rehearsal.
- Upgrade and backup safety checks.
- Portable launch bundle readiness when `--bundle` is provided.

For an early environment rehearsal before a fresh server backup exists:

```sh
npm run verify:production -- --env .env.production --quick --skip-audit --allow-missing-backup
```

## Supabase Persistence

For the dedicated setup guide, troubleshooting table, and pre-launch gate, see [`supabase-setup.md`](./supabase-setup.md).

1. Create a Supabase project.
2. Run `server/migrations/001_supabase_storage.sql`.
3. Run `server/migrations/002_supabase_auth_rls.sql`.
4. Run `server/migrations/003_background_jobs.sql`.
5. Run `server/migrations/004_auth_sessions.sql`.
6. Run `server/migrations/005_rate_limit_buckets.sql`.
7. Run `server/migrations/006_workspace_revisions.sql`.
8. Run `server/migrations/007_sparkz_pilot_reviews.sql`.
7. Create a private Storage bucket named `agora-files`.
8. Set:

```sh
AGORA_STORAGE_DRIVER=supabase
AGORA_AUTH_DRIVER=supabase
AGORA_WORKSPACE_ID=workspace-acme
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AGORA_SUPABASE_STORAGE_BUCKET=agora-files
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or client settings. Agora uses it only from the API server for persistence and private file-object access.

With `AGORA_AUTH_DRIVER=supabase`, the Settings account form can sign users up or in with Supabase email/password auth through the Agora API server. The browser never needs Supabase service-role credentials; it only talks to Agora.

After the migrations and bucket are ready, restart the API, sign in again, then refresh Backend Health from Settings or Data. For Supabase-backed deployments, the health panel should show:

- Storage: `supabase`
- Auth: `supabase`
- Supabase environment: URL set / anon key set / service role set
- Structured records reachable
- File uploads configured for the Supabase bucket
- Hosted launch gates passing
- Production mode ready

Then verify the real Supabase project through the Agora API:

```sh
npm run test:supabase
```

This starts a temporary local API server using the configured Supabase credentials. It writes to a unique verification workspace by default, then checks snapshots, structured records, notification scheduler permissions, payments/entitlements, audit events, and Supabase Storage upload/download. To reuse a stable verification workspace, set:

```sh
AGORA_VERIFY_WORKSPACE_ID=agora-verify-your-name
```

The verification script is non-destructive. It does not delete existing rows and does not touch the main `AGORA_WORKSPACE_ID` unless you explicitly set `AGORA_VERIFY_WORKSPACE_ID` to the same value.

## Upgrade Safety

Before changing production API code, applying migrations, or switching storage/auth drivers, run:

```sh
npm run verify:upgrade
```

This confirms the release contains the required migration files and that the API has a fresh, parseable server workspace backup. Then run `npm run drill:recovery -- --backup <server-backup.json>` to prove an isolated restore. For the full maintenance sequence, see [`upgrade-checklist.md`](./upgrade-checklist.md) and [`disaster-recovery-drill.md`](./disaster-recovery-drill.md).

## Backend Scheduler

The notification scheduler can run two ways:

```sh
AGORA_SCHEDULER_ENABLED=false
AGORA_SCHEDULER_INTERVAL_SECONDS=60
```

- `AGORA_SCHEDULER_ENABLED=true`: the API process runs the scheduler loop.
- `AGORA_SCHEDULER_ENABLED=false`: call `POST /api/scheduler/notifications/run` from a trusted cron worker with an admin/manager session.

Only sessions with `scheduler:run` can process due reminders. Keep cron credentials server-side and avoid calling the scheduler directly from public browser automation.

## Password Reset

Agora supports reset-token creation and confirmation through the API. Production deployments should deliver reset tokens through SMTP or a webhook-backed email workflow.

Invitations and feature requests use the same SMTP settings. Set `AGORA_FEATURE_REQUEST_EMAIL` to receive an email whenever the in-app or public feature request form saves a task. The shareable public form lives at `#feedback` on your deployed app URL, but the public feature-request API is disabled by default. Set `AGORA_PUBLIC_FEATURE_REQUESTS=true` only when you are ready to accept public submissions, and tune public abuse limits with `AGORA_PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS`, `AGORA_PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS`, and `AGORA_PUBLIC_FEATURE_BODY_LIMIT_BYTES`.

The API also applies in-memory rate limits to public discovery/config reads, authenticated write bursts, expensive operations such as backups/imports/uploads/AI/scheduler/payment actions, and concurrent realtime streams. `429` responses include `Retry-After`. Tune these with:

```sh
AGORA_RATE_LIMIT_DRIVER=memory
AGORA_EDGE_RATE_LIMITS_ENABLED=false
AGORA_PUBLIC_READ_RATE_LIMIT_ATTEMPTS=120
AGORA_PUBLIC_READ_RATE_LIMIT_WINDOW_MS=60000
AGORA_AUTHENTICATED_WRITE_RATE_LIMIT_ATTEMPTS=240
AGORA_AUTHENTICATED_WRITE_RATE_LIMIT_WINDOW_MS=60000
AGORA_EXPENSIVE_API_RATE_LIMIT_ATTEMPTS=30
AGORA_EXPENSIVE_API_RATE_LIMIT_WINDOW_MS=600000
AGORA_REALTIME_CONNECTION_LIMIT_PER_SESSION=6
AGORA_REALTIME_CONNECTION_LIMIT_PER_IP=30
AGORA_RATE_LIMIT_MAX_KEYS=5000
```

For multi-instance hosted deployments, keep these app-level limits and either set `AGORA_RATE_LIMIT_DRIVER=supabase` after running migration `005_rate_limit_buckets.sql`, or add an edge, Redis, Upstash, or provider-level limiter and set `AGORA_EDGE_RATE_LIMITS_ENABLED=true` to document that every API worker is protected.

Invitation, feature request, and requester update emails are queued through persisted background job state. JSON deployments store this in `background-jobs.json`; Supabase deployments store it in `agora_background_jobs` after migration `003_background_jobs.sql`. API sessions store only hashed token identifiers in `agora_auth_sessions` after migration `004_auth_sessions.sql`, which keeps session rotation and revocation durable across restarts. Tune queue pressure and retry timing with:

```sh
AGORA_BACKGROUND_JOB_MAX_QUEUE=100
AGORA_BACKGROUND_JOB_BASE_RETRY_MS=5000
AGORA_BACKGROUND_JOB_MAX_RETRY_MS=60000
```

SMTP:

```sh
AGORA_PASSWORD_RESET_DELIVERY=smtp
AGORA_EMAIL_FROM=Agora <no-reply@your-domain.example>
AGORA_FEATURE_REQUEST_EMAIL=owner@your-domain.example
AGORA_SMTP_HOST=smtp.your-provider.example
AGORA_SMTP_PORT=587
AGORA_SMTP_SECURE=false
AGORA_SMTP_STARTTLS=true
AGORA_SMTP_USER=your-smtp-user
AGORA_SMTP_PASSWORD=your-smtp-password
```

Webhook:

```sh
AGORA_PASSWORD_RESET_DELIVERY=webhook
AGORA_PASSWORD_RESET_WEBHOOK_URL=https://your-email-worker.example.com/agora/password-reset
AGORA_PASSWORD_RESET_WEBHOOK_SECRET=shared-secret
```

The webhook receives JSON with `to`, `name`, `subject`, `text`, `token`, `resetUrl`, and `expiresAt`.

For local/manual administration only:

```sh
AGORA_PASSWORD_RESET_DELIVERY=manual
AGORA_PASSWORD_RESET_RETURN_TOKEN=true
```

That returns the reset token to the browser so an admin can complete the reset without email infrastructure. Keep `AGORA_PASSWORD_RESET_RETURN_TOKEN=false` for hosted production.

## File Uploads

The API accepts uploads from Docs & Files:

- Local JSON driver: stores file objects under `server/data/uploads/`.
- Supabase driver: stores file objects in `AGORA_SUPABASE_STORAGE_BUCKET`.

Downloads are proxied through authenticated Agora API routes, so private bucket objects are not exposed with public URLs.

## Health Checks

Use these after deployment:

```sh
curl https://your-api.example.com/api/health
```

Then sign in and open Settings or Data. Backend Health should show storage, auth, structured records, auth hardening, file uploads, audit log, and production mode readiness.

Settings also includes Hosted onboarding, Email diagnostics, a Deploy Confidence checklist, and the hosted launch runbook. Use them before inviting a real team: connect the API, refresh backend health, confirm auth mode, review the role matrix, verify export paths, configure SMTP/reset delivery, choose a workspace theme/density, and run the hosted cutover steps in [`hosted-launch-runbook.md`](./hosted-launch-runbook.md).

For Supabase-backed deployments, run the deeper verifier after every migration or environment change:

```sh
npm run test:supabase
```

## Release Checklist

- Create the first owner account.
- Save or import the workspace snapshot to the API.
- Refresh Backend Health and confirm Email diagnostics shows SMTP, sender, invitations, feature request owner, and password reset as expected.
- Send or resend one teammate/client invite and confirm the email job queues.
- Submit one public feature request and confirm it creates a task and queues owner email.
- Choose the workspace theme and density in Settings.
- Review the Settings permission matrix for admin, manager, member, and client access.
- Confirm Deploy Confidence shows every expected item as ready for the chosen environment.
- Confirm `AGORA_DEMO_AUTH=false`.
- Confirm `AGORA_PASSWORDLESS_AUTH=false` unless intentionally enabled.
- Confirm CORS only includes trusted app origins.
- Confirm Supabase Storage bucket exists before uploading files.
- Run `npm run test:supabase` when Supabase storage/auth is configured.
- Confirm `AGORA_SCHEDULER_ENABLED` matches your hosting model.
- Confirm payment providers are in test mode unless real checkout adapters and webhook validation are configured.
- Confirm Audit Log loads for admins/project managers.
- Run `npm run check` and `npm run test:api`.

## Vercel Static App

Agora includes `vercel.json` for static app hosting and security headers. This is for the browser app only.

1. Import the GitHub repo into Vercel.
2. Use no build command.
3. Use the repo root as the output directory.
4. Set the app's API URL in Settings after deploy, or pre-seed browser storage for your environment.
5. Host the API separately on a long-running Node service with `npm run start:api`.

Set the API host in `.env`:

```sh
AGORA_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
AGORA_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
```

Vercel serverless functions are not the primary API target for the current dependency-free server because `server/api.js` is a long-running Node HTTP server.
