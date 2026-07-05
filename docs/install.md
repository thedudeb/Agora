# Install Agora

Agora can run as a dependency-free local app, a Docker Compose stack, a hosted app/API pair, an installable PWA, an optional desktop shell, and a power-user CLI/MCP toolchain. Start with the setup wizard when you need environment files and persistent directories created consistently.

## Choose An Install Path

| Path | Best for | Start here | Verification |
| --- | --- | --- | --- |
| Local browser app | Trying Agora on one machine | `npm run setup` | `npm run verify:quick` |
| Docker Compose | Small self-hosted team or server | `npm run setup -- --profile docker` | `npm run package:check` |
| Hosted web/API | Production-style deployment | `npm run setup -- --profile hosted` | `npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict` |
| Offline PWA | iOS, Android, Chromebook, or browser install | Open the hosted/local app and install from the browser | `npm run test:golden` plus manual airplane-mode check |
| Desktop shell | Offline-capable macOS/Windows app | `npm --prefix desktop run pack:mac` or `npm --prefix desktop run pack:win` | Launch packaged app with Wi-Fi disabled |
| CLI | Power users and release operators | `npm run agora -- help` | `npm run agora -- verify --quick` |
| MCP server | Local MCP/AI clients with user-scoped access | `npm run mcp` | `npm run test:mcp` |
| Portable data | Backup, migration, or exit path | Data > Portable workspace bundle | `npm run test:fixtures` |

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
npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict
```

For an early dry rehearsal before a production backup exists, use `npm run verify:production -- --env .env.production --quick --skip-audit --allow-missing-backup`.

## Offline PWA Install

Run the local app or open the hosted app in a supported browser, then install Agora from the browser's app/install menu. The PWA path is the current iOS and Android install story.

Before relying on the installed PWA:

- Confirm the app opens in standalone mode.
- Turn on airplane mode and confirm the app shell opens.
- Create or edit local work.
- Export a workspace JSON or portable bundle while offline.
- Reconnect and confirm queued API sync work can be retried when the API is configured.

## Desktop Shell

The optional Electron shell lives in `desktop/` and bundles the local app shell for macOS and Windows:

```sh
npm --prefix desktop install
npm --prefix desktop run pack:mac
npm --prefix desktop run pack:win
```

Run the macOS pack command on macOS and the Windows pack command on Windows for release candidates. See [`desktop-app.md`](./desktop-app.md) for offline behavior, secure session storage, signing expectations, and platform QA.

## CLI Wrapper

Power users can run setup, verification, migration, bundle inspection, launch checks, trust checks, packaging checks, and recovery drills through the Agora CLI:

```sh
npm run agora -- help
npm run agora -- setup --profile docker --dry-run
npm run agora -- verify --quick
npm run agora -- package-check --json
```

Use `--dry-run` in docs, CI, or release review to confirm what setup would touch without writing files.

## MCP Server

Agora includes a local stdio MCP server for power users who want controlled access from local MCP clients:

```sh
npm run mcp
npm run test:mcp
```

Keep write tools disabled unless the client is trusted and the workflow needs writes. See [`mcp-server.md`](./mcp-server.md) and [`mcp-security-audit.md`](./mcp-security-audit.md).

## Portable Data

Every install path should preserve the no-lock-in escape hatch. From Data, export a portable workspace bundle before risky imports, upgrades, browser resets, machine changes, or customer migrations.

Verify the fixture-backed contract with:

```sh
npm run test:fixtures
npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json
```
