# Packaging

Agora should be easy to evaluate, self-host, install offline, and move away from. Packaging is tracked in [`packaging/release-manifest.json`](../packaging/release-manifest.json), then verified with:

```sh
npm run package:check
npm run agora -- package-check
npm run agora -- package-check --json
```

For the current channel audit, see [`packaging-audit-2026-07-05.md`](./packaging-audit-2026-07-05.md). It records which paths are beta-ready, which are internal-ready, and what still blocks a polished public release.

## Release Channels

| Channel | Artifact | Best For | Primary Check |
| --- | --- | --- | --- |
| Source install | Git checkout or source archive | Developers and self-hosters | `npm run setup -- --dry-run` |
| Docker Compose | App/API containers plus persistent volume | Small teams and quick servers | `npm run setup -- --profile docker --dry-run` |
| Hosted web/API | Static app plus long-running API | Production teams | `npm run verify:hosted` |
| Offline PWA | Browser-installable app shell | iOS, Android, Chromebook, desktop browser | `npm run test:golden` |
| macOS desktop | DMG and ZIP | Offline-capable native desktop users | `npm --prefix desktop run pack:mac` |
| Windows desktop | NSIS installer and portable executable | Offline-capable native desktop users | `npm --prefix desktop run pack:win` |
| Agora CLI | Node.js command wrapper | Power users and self-hosters | `npm run agora -- verify --quick` |
| Local MCP server | stdio MCP server | Local AI/MCP clients with user-scoped API access | `npm run test:mcp` |
| Portable data | Workspace JSON/CSV/Markdown bundle | Migration, backup, exit, and restore | `npm run test:fixtures` |

## Release Gate

Before publishing a release candidate:

```sh
npm run package:check
npm run trust
npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict
npm run qa
npm run security
```

Use `--allow-missing-backup` only for local dry rehearsals. For desktop releases, run the platform pack command on the target OS, then test launch with Wi-Fi disabled.

## Release Handoff

Every release candidate should include:

- Product version and Git commit.
- `npm run package:check` output.
- `npm run trust` output.
- Hosted verification output for the target environment.
- Recovery proof from a current server backup or portable workspace bundle.
- Known gaps from `packaging/release-manifest.json`.
- Platform notes for source, Docker, hosted, PWA, desktop, CLI, MCP, and portable data.

## Packaging Rules

- Every channel must declare required files and verification commands in `packaging/release-manifest.json`.
- Docker keeps web and API processes separate, with API data and backups in a named volume.
- PWA packaging must keep the manifest, service worker, offline page, icons, and screenshots together.
- Desktop packaging must bundle the local app shell and avoid packaged secrets.
- Hosted packaging must keep secrets on the API service, never in the static app.
- Portable data packaging must remain fixture-backed so exports can be inspected outside Agora.

If a release channel becomes aspirational instead of shippable, mark it clearly in the manifest or remove it from release notes until the check is meaningful again.
