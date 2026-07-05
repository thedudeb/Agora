# Packaging Audit - 2026-07-05

Audit target: `main` after Trust Center proof work.

Agora's packaging story is good enough for a serious beta handoff, but not yet a fully polished public release across every platform. The strongest paths today are source install, Docker Compose, hosted web/API, offline PWA, CLI/MCP, and portable workspace bundles. Desktop packaging exists and is wired for macOS and Windows, but broad public distribution still needs signing and platform-specific smoke passes.

## Verification

Run before shipping a release candidate:

```sh
npm run package:check
npm run trust
npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict
npm run qa
npm run security
```

Use `--allow-missing-backup` only for local rehearsals. Production releases should use a fresh server backup and a current portable workspace bundle.

## Channel Status

| Channel | Status | Evidence | Remaining polish |
| --- | --- | --- | --- |
| Source install | Beta-ready | `package.json`, `package-lock.json`, `scripts/agora-setup.js`, `docs/install.md` | Add tagged source archives when release automation exists. |
| Docker Compose | Beta-ready | `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `docs/install.md` | Add registry image publishing and digest pinning for public releases. |
| Hosted web/API | Beta-ready with operator setup | `docs/deployment.md`, `docs/hosted-launch-runbook.md`, `scripts/hosted-env-verify.js` | Add provider-specific deployment recipes after first real deployments. |
| Offline PWA | Beta-ready | `manifest.webmanifest`, `sw.js`, `offline.html`, app icons, screenshot plan | Run manual install/airplane-mode checks on real iOS and Android devices for each release candidate. |
| macOS desktop | Internal-ready | `desktop/package.json`, Electron shell, `docs/desktop-app.md` | Code signing, notarization, offline launch QA, and secure session checks on a packaged app. |
| Windows desktop | Internal-ready | `desktop/package.json`, Electron shell, `docs/desktop-app.md` | Code signing, installer/uninstaller QA, portable mode QA, and secure session checks on a packaged app. |
| Agora CLI | Beta-ready | `scripts/agora-cli.js`, README commands, `docs/install.md` | Add shell completion only after command names settle. |
| Local MCP server | Local v0-ready | `scripts/agora-mcp-server.js`, `docs/mcp-server.md`, `docs/mcp-security-audit.md` | Remote MCP should wait for OAuth, origin checks, rate limits, and deeper audit logging. |
| Portable data | Beta-ready | `docs/portable-workspace.md`, fixture bundle, `server/portable-fixtures-test.js` | Keep fixtures refreshed when schema or marketplace artifacts change. |

## Release Handoff

Every release candidate should include:

- Product version and Git commit.
- `npm run package:check` output.
- `npm run trust` output.
- Hosted verification output for the target environment.
- Recovery proof from a current server backup or portable workspace bundle.
- Known gaps copied from `packaging/release-manifest.json`.
- Platform notes for PWA, Docker, hosted, desktop, CLI, MCP, and portable data.

## Recommended Next Work

1. Fill out `docs/release-candidate-handoff-template.md` for the next beta candidate.
2. Add signed/notarized desktop release evidence for macOS and Windows.
3. Add Docker registry publishing and digest pinning before broad public releases.
4. Run real iOS and Android PWA install plus airplane-mode checks for each release candidate.
