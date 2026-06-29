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
AGORA_SESSION_TTL_SECONDS=28800
AGORA_INVITATION_TTL_DAYS=14
AGORA_PASSWORD_RESET_TTL_MINUTES=30
AGORA_DEMO_AUTH=false
AGORA_PASSWORDLESS_AUTH=false
```

Use HTTPS in front of both app and API in production. Keep `AGORA_ALLOWED_ORIGINS` limited to the browser origins that should call the API.

## Supabase Persistence

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

## Password Reset

Agora supports reset-token creation and confirmation through the API. Production deployments should deliver reset tokens through SMTP or a webhook-backed email workflow.

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

## Release Checklist

- Create the first owner account.
- Save or import the workspace snapshot to the API.
- Confirm `AGORA_DEMO_AUTH=false`.
- Confirm `AGORA_PASSWORDLESS_AUTH=false` unless intentionally enabled.
- Confirm CORS only includes trusted app origins.
- Confirm Supabase Storage bucket exists before uploading files.
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
