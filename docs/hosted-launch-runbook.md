# Hosted Launch Runbook

Use this runbook when moving Agora from a local pilot to a hosted workspace with real users.

## 1. Freeze The Candidate

- Run `npm run verify`.
- Run `npm run launch:check`.
- Export a portable workspace bundle from Data.
- Keep the previous hosted deployment available until post-cutover checks pass.

## 2. Configure Hosted Environment

- Set `AGORA_ALLOWED_ORIGINS` to the exact hosted app origin.
- Set `AGORA_PUBLIC_APP_URL` to the hosted HTTPS app URL.
- Keep `AGORA_DEMO_AUTH=false` and `AGORA_PASSWORDLESS_AUTH=false`.
- Use SMTP or webhook password reset delivery, and keep `AGORA_PASSWORD_RESET_RETURN_TOKEN=false`.
- Keep public feedback limits configured with `AGORA_PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS`, `AGORA_PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS`, and `AGORA_PUBLIC_FEATURE_BODY_LIMIT_BYTES`.

## 3. Prove Persistence

- Run migrations `001_supabase_storage.sql`, `002_supabase_auth_rls.sql`, and `003_background_jobs.sql`.
- Create the private Supabase Storage bucket.
- Set `AGORA_STORAGE_DRIVER=supabase` and `AGORA_AUTH_DRIVER=supabase`.
- Restart the API, sign in, refresh Backend Health, and confirm production mode is ready.
- Run `npm run test:supabase` against a test workspace after migration or environment changes.

## 4. Verify Product Surfaces

- Confirm `/api/health` responds publicly.
- Sign in and confirm `/api/backend/health`, `/api/payments/config`, and `/api/marketplace/catalog`.
- Submit a public feature request and confirm it creates a task and queues email delivery.
- Publish and reload the marketplace catalog.
- Check desktop, phone, and tablet widths in a real browser.

## 5. Cut Over And Watch

- Invite the first admin or manager only after Backend Health gates pass.
- Keep the latest portable bundle and API backup close during the first session.
- Watch request metrics, background jobs, failed syncs, and audit events after the first real workflow.
- If state, auth, or migration behavior looks wrong, roll back the deployment and restore from the latest known-good bundle or Supabase backup.
