# Install Agora

Agora can run as a dependency-free local app, a Docker Compose stack, or a hosted app/API pair. Start with the setup wizard so environment files and persistent directories are created consistently.

## Fast Local Install

```sh
npm run setup
npm run dev
npm run dev:api
```

Open `http://127.0.0.1:5174`, create the first owner account from Settings, then save the workspace to the API from Data or Settings.

The setup wizard creates:

- `.env` from `.env.example` when one does not exist.
- `server/data/` for local JSON API state.
- `server/data/backups/` for server workspace backups.
- `server/data/uploads/` for local file uploads.

It will not overwrite an existing `.env` unless you pass `--force`.

## Docker Compose Install

```sh
npm run setup -- --profile docker
docker compose up --build
```

Then open:

- App: `http://127.0.0.1:5174`
- API health: `http://127.0.0.1:8787/api/health`

The Compose stack runs separate `app` and `api` services from the same image. API state and server backups live in the `agora-data` volume.

## Hosted Install Prep

```sh
npm run setup -- --profile hosted
```

Then edit `.env` with real Supabase, SMTP/webhook, hosted origin, release, and backup values. Run Supabase migrations `001`, `002`, and `003`, create the private `agora-files` bucket, and validate:

```sh
npm run verify:hosted
npm run rehearse:hosted
```

## CLI Wrapper

Power users can run the same setup through the Agora CLI:

```sh
npm run agora -- setup --profile docker --dry-run
```

Use `--dry-run` in docs, CI, or release review to confirm what setup would touch without writing files.
