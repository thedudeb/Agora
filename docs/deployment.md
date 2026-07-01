# Agora Deployment Guide

This guide covers the current dependency-free Agora deployment path: static app server, API server, optional Supabase persistence, Supabase Auth, and file uploads.

## Local First Run

```sh
cp .env.example .env
npm run dev
npm run dev:api
```

Open `http://127.0.0.1:5174`, go to Settings, create the first owner account, then save the workspace to the API from Settings or Data.

## Required Production Environment

```sh
AGORA_APP_PORT=5174
AGORA_API_PORT=8787
AGORA_ALLOWED_ORIGINS=https://your-agora-app.example.com
AGORA_PUBLIC_APP_URL=https://your-agora-app.example.com
AGORA_EMAIL_FROM=Agora <no-reply@your-domain.example>
AGORA_FEATURE_REQUEST_EMAIL=owner@your-domain.example
AGORA_SESSION_TTL_SECONDS=28800
AGORA_INVITATION_TTL_DAYS=14
AGORA_PASSWORD_RESET_TTL_MINUTES=30
AGORA_DEMO_AUTH=false
AGORA_PASSWORDLESS_AUTH=false
```

Use HTTPS in front of both app and API in production. Keep `AGORA_ALLOWED_ORIGINS` limited to the browser origins that should call the API.

Backend Health reports production gates for the hosted path:

- `Allowed origins`: `AGORA_ALLOWED_ORIGINS` is set to the exact browser origin.
- `Auth entrypoints`: demo and passwordless auth are disabled.
- `Password reset delivery`: SMTP or webhook delivery is configured, with browser token return disabled.
- `Rate-limit IP source`: direct socket IPs are used unless `AGORA_TRUST_PROXY=true` is intentionally enabled behind a trusted proxy.

## Supabase Persistence

For the dedicated setup guide, troubleshooting table, and pre-launch gate, see [`supabase-setup.md`](./supabase-setup.md).

1. Create a Supabase project.
2. Run `server/migrations/001_supabase_storage.sql`.
3. Run `server/migrations/002_supabase_auth_rls.sql`.
4. Create a private Storage bucket named `agora-files`.
5. Set:

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

Feature requests use the same SMTP settings. Set `AGORA_FEATURE_REQUEST_EMAIL` to receive an email whenever the in-app or public feature request form saves a task. The shareable public form lives at `#feedback` on your deployed app URL.

SMTP:

```sh
AGORA_PASSWORD_RESET_DELIVERY=smtp
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

Settings also includes a Deploy Confidence checklist. Use it before inviting a real team: connect the API, refresh backend health, confirm auth mode, review the role matrix, verify export paths, and choose a workspace theme/density.

For Supabase-backed deployments, run the deeper verifier after every migration or environment change:

```sh
npm run test:supabase
```

## Release Checklist

- Create the first owner account.
- Save or import the workspace snapshot to the API.
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
