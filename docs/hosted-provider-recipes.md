# Hosted Provider Recipes

Agora's hosted shape is a split deployment:

- Static app: serves the browser/PWA files.
- Long-running API: owns secrets, auth, Supabase, email, uploads, backups, payments, integrations, and server-side AI.
- Supabase: Postgres/Auth/Storage when hosted persistence is enabled.

Do not put Supabase service-role keys, SMTP credentials, AI provider keys, payment credentials, webhook secrets, or backup paths into a static app host.

## Shared Hosted Checklist

1. Run `npm run setup -- --profile hosted`.
2. Deploy the static app to an HTTPS static host.
3. Deploy the API to a long-running Node host with persistent storage for `AGORA_BACKUP_DIR`.
4. Set `AGORA_ALLOWED_ORIGINS` to the exact static app origin.
5. Set `AGORA_PUBLIC_APP_URL` to the static app HTTPS URL.
6. Set `AGORA_ALLOW_LOCALHOST_ORIGINS=false`, `AGORA_DEMO_AUTH=false`, and `AGORA_PASSWORDLESS_AUTH=false`.
7. Configure SMTP or webhook password reset delivery.
8. Run Supabase migrations `001`, `002`, and `003`, then create the private file bucket.
9. Run `npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict`.
10. Open Backend Health and Hosted onboarding before inviting users.

## Static App Host

Use this for the browser app only:

- Build step: none required for the dependency-free app shell.
- Start/serve command: static host default or `npm run start`.
- Public files: repo root assets, `index.html`, `src/`, `assets/`, `manifest.webmanifest`, `sw.js`, and `offline.html`.
- Required public env: none. Users enter the API URL inside Agora Settings.

Acceptance checks:

- `https://app.example.com/` loads.
- `https://app.example.com/manifest.webmanifest` loads.
- `https://app.example.com/offline.html` loads.
- Browser install/PWA prompt works where supported.
- The app can connect to the API URL from Settings without CORS errors.

## Node API Host

Use a long-running Node service for the API:

- Install command: `npm ci --omit=dev`
- Start command: `npm run start:api`
- Health check: `/api/health`
- Persistent disk: mount a durable path for `AGORA_BACKUP_DIR`
- Logs: enable structured log capture when possible

Minimum API environment:

```sh
AGORA_API_PORT=8787
AGORA_ALLOWED_ORIGINS=https://app.example.com
AGORA_ALLOW_LOCALHOST_ORIGINS=false
AGORA_PUBLIC_APP_URL=https://app.example.com
AGORA_STRICT_CSP=true
AGORA_STRUCTURED_LOGS=true
AGORA_RELEASE_CHANNEL=production
AGORA_RELEASE_COMMIT=<git-sha>
AGORA_BACKUP_DIR=/var/lib/agora/backups
AGORA_BACKUP_RETENTION_FILES=20
AGORA_BACKUP_SCHEDULER_ENABLED=true
AGORA_DEMO_AUTH=false
AGORA_PASSWORDLESS_AUTH=false
AGORA_PASSWORD_RESET_RETURN_TOKEN=false
AGORA_PASSWORD_RESET_DELIVERY=smtp
```

Add Supabase, SMTP/webhook, AI, payment, integration, and webhook secrets only on this API service.

Acceptance checks:

- `/api/health` shows the expected release metadata.
- `/api/backend/health` passes after sign-in.
- Settings > Account hosted onboarding completes.
- Invite, password reset, public feedback, and requester update email paths queue or deliver as configured.
- Server backup can be created and restored in a drill.

## Supabase

Use Supabase for hosted persistence/Auth/Storage:

1. Run `server/migrations/001_supabase_storage.sql`.
2. Run `server/migrations/002_supabase_auth_rls.sql`.
3. Run `server/migrations/003_background_jobs.sql`.
4. Create the private storage bucket configured by `AGORA_SUPABASE_STORAGE_BUCKET`.
5. Set `AGORA_STORAGE_DRIVER=supabase` and `AGORA_AUTH_DRIVER=supabase` on the API.
6. Run `npm run test:supabase` against a disposable verification workspace.

Keep `SUPABASE_SERVICE_ROLE_KEY` API-only. Never expose it to the static app or desktop client.

## Docker Host

For a single-machine server, Docker Compose remains the simplest hosted shape:

```sh
npm run setup -- --profile docker
docker compose up --build
```

Use a reverse proxy or platform HTTPS layer in front of the app and API. Keep the `agora-data` volume durable and backed up.

## Cutover Decision

Invite users only when:

- `npm run verify:production` passes with a real backup and portable bundle.
- `npm run qa`, `npm run trust`, and `npm run package:check` pass for the release commit.
- Backend Health is green for auth, storage, email, files, backups, production mode, and public surfaces.
- A rollback target and recovery artifact are recorded in the release-candidate handoff.
