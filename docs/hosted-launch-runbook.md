# Hosted Launch Runbook

Use this runbook when moving Agora from a local pilot to a hosted workspace with real users.

For provider-specific handoff shape, use [`hosted-provider-recipes.md`](./hosted-provider-recipes.md) alongside this runbook. It separates static app hosting, long-running API hosting, Supabase, Docker-hosted deployments, secrets placement, and acceptance checks.

## 1. Freeze The Candidate

- Confirm the GitHub Actions `QA` workflow is green for the release commit.
- Export a portable workspace bundle from Data.
- Run `npm run verify:production -- --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict`.
- Run `npm run qa`.
- Run `npm run verify`.
- Keep the previous hosted deployment available until post-cutover checks pass.

`npm run verify:production` is the single hosted gate. It runs hosted environment verification, hosted deploy rehearsal, upgrade safety, and launch bundle readiness when a bundle is provided. Use `--quick --skip-audit` only for preflight rehearsals, not for the final candidate gate.

## 2. Configure Hosted Environment

- Set `AGORA_ALLOWED_ORIGINS` to the exact hosted app origin.
- Set `AGORA_ALLOW_LOCALHOST_ORIGINS=false`; localhost CORS is for development only.
- Set `AGORA_PUBLIC_APP_URL` to the hosted HTTPS app URL.
- Set `AGORA_STRICT_CSP=true` or run the app/static server with `NODE_ENV=production`.
- Set `AGORA_EMAIL_FROM`, `AGORA_FEATURE_REQUEST_EMAIL`, and SMTP credentials for invitations, feature request owner emails, and requester updates.
- Keep `AGORA_DEMO_AUTH=false` and `AGORA_PASSWORDLESS_AUTH=false`.
- Set `AGORA_STRUCTURED_LOGS=true` if your host captures JSON stdout logs.
- Set `AGORA_BACKUP_DIR` to a durable mounted path, choose `AGORA_BACKUP_RETENTION_FILES`, and enable `AGORA_BACKUP_SCHEDULER_ENABLED=true` when the API process should write scheduled backups itself.
- Use SMTP or webhook password reset delivery, and keep `AGORA_PASSWORD_RESET_RETURN_TOKEN=false`.
- Keep `AGORA_AI_ALLOW_CLIENT_BASE_URL=false` unless a trusted self-hosted admin workflow needs it; if enabled, configure `AGORA_AI_ALLOWED_BASE_URLS` with hosted HTTPS provider origins.
- Keep public feedback limits configured with `AGORA_PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS`, `AGORA_PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS`, and `AGORA_PUBLIC_FEATURE_BODY_LIMIT_BYTES`.

## 3. Prove Persistence

- Run migrations `001_supabase_storage.sql` through `006_workspace_revisions.sql` in numeric order.
- Create the private Supabase Storage bucket.
- Set `AGORA_STORAGE_DRIVER=supabase` and `AGORA_AUTH_DRIVER=supabase`.
- Restart the API, sign in, refresh Backend Health, and confirm production mode is ready.
- Re-run `npm run verify:hosted` after each environment change; it should block demo auth, passwordless auth, manual reset-token exposure, localhost CORS, missing SMTP credentials, missing scheduled backups, and unsafe AI provider settings.
- Re-run `npm run verify:production -- --quick --skip-audit --allow-missing-backup` after early environment changes when a fresh production backup is not available yet.
- Confirm Email diagnostics shows SMTP, sender, invitations, feature request owner, and password reset delivery in the expected state.
- Run `POST /api/backups/run` or click Run Server Backup from Backend Health, then confirm Backend Health shows the latest backup.
- Run `npm run test:supabase` against a test workspace after migration or environment changes.

## 4. Verify Product Surfaces

- Confirm `/api/health` responds publicly.
- Sign in and confirm `/api/backend/health`, `/api/payments/config`, and `/api/marketplace/catalog`.
- Open Settings > Account and complete Hosted onboarding: owner account, API sync, invite path, email delivery, feedback loop, and recovery proof.
- Send a teammate/client invite and confirm it queues email delivery.
- Submit a public feature request and confirm it creates a task and queues email delivery.
- Move that feature request to another status, add a requester update, and confirm requester email queues when an email is present.
- Publish and reload the marketplace catalog.
- Check desktop, phone, and tablet widths in a real browser.

## 5. Cut Over And Watch

- Invite the first admin or manager only after Backend Health gates pass.
- Keep the latest portable bundle and API backup close during the first session.
- Watch request metrics, background jobs, failed syncs, and audit events after the first real workflow.
- Keep the `X-Request-Id` from any failed browser/API report so it can be matched against `/api/observability` and structured logs.
- Download the redacted Admin Diagnostics packet from Backend Health before opening a support issue or handing off to another operator.
- If state, auth, or migration behavior looks wrong, roll back the deployment and restore from the latest known-good bundle or Supabase backup.
