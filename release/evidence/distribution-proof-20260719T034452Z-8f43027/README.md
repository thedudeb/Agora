# Distribution Evidence

- Generated: 2026-07-19T03:44:52.993Z
- Branch: main
- Commit: 8f43027
- Dirty worktree: no
- Product version: 0.1.0
- Release: v0.1-beta

Use this bundle to fill [docs/distribution-proof.md](../../../docs/distribution-proof.md) and the Platform Evidence table in [docs/release-candidate-v0.1-beta.md](../../../docs/release-candidate-v0.1-beta.md).

## Channel Checklist

### Source install (source)

- Artifact: Git checkout or source archive
- Platforms: macOS, Windows, Linux
- Entrypoint: `npm run setup`

Required files:
- [ ] `package.json`
- [ ] `package-lock.json`
- [ ] `scripts/agora-setup.js`
- [ ] `docs/install.md`

Verification commands:
- [ ] `npm run setup -- --dry-run`
- [ ] `npm run check`

Manual proof:
- [ ] Start from a clean checkout or source archive.
- [ ] Open the app locally and export a portable workspace bundle.
- [ ] Record OS, Node version, and browser used.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: None recorded yet.
```

### Docker Compose (docker-compose)

- Artifact: Container image plus compose stack
- Platforms: macOS, Windows, Linux, server
- Entrypoint: `docker compose up --build`

Required files:
- [ ] `Dockerfile`
- [ ] `docker-compose.yml`
- [ ] `.dockerignore`
- [ ] `docs/install.md`

Verification commands:
- [ ] `npm run setup -- --profile docker --dry-run`
- [ ] `docker compose config`

Manual proof:
- [ ] Boot app and API services from Docker Compose.
- [ ] Confirm the API data volume persists after restart.
- [ ] Record backup path or backup artifact.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: Registry publishing and digest pinning are not required until public container distribution.
```

### Hosted web/API deployment (hosted)

- Artifact: Static web app plus long-running API service
- Platforms: Vercel, Render, Fly.io, Railway, Node host
- Entrypoint: `npm run start && npm run start:api`

Required files:
- [ ] `vercel.json`
- [ ] `server/api.js`
- [ ] `server/static.js`
- [ ] `docs/deployment.md`
- [ ] `docs/hosted-launch-runbook.md`

Verification commands:
- [ ] `npm run verify:hosted`
- [ ] `npm run rehearse:hosted`

Manual proof:
- [ ] Confirm hosted app URL and API health endpoint.
- [ ] Open Backend Health and record persistence, email, backup, and public-surface status.
- [ ] Submit a feature request or invite email if enabled.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: None recorded yet.
```

### Offline PWA (pwa-offline)

- Artifact: Installable browser app
- Platforms: iOS, Android, desktop browser
- Entrypoint: `Open hosted app and install from browser`

Required files:
- [ ] `manifest.webmanifest`
- [ ] `sw.js`
- [ ] `offline.html`
- [ ] `assets/icons/agora-192.png`
- [ ] `assets/icons/agora-512.png`

Verification commands:
- [ ] `npm run test:golden`

Manual proof:
- [ ] Install from Android Chrome or a desktop browser.
- [ ] Launch in airplane mode or with networking disabled.
- [ ] Create a local edit and export a portable bundle while offline.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: Native iOS/Android wrappers are not shipped; offline mobile proof is PWA-only.
```

### macOS desktop shell (desktop-macos)

- Artifact: DMG and ZIP
- Platforms: macOS
- Entrypoint: `npm --prefix desktop run pack:mac`

Required files:
- [ ] `desktop/package.json`
- [ ] `desktop/package-lock.json`
- [ ] `desktop/electron/main.cjs`
- [ ] `desktop/electron/preload.cjs`
- [ ] `docs/desktop-app.md`

Verification commands:
- [ ] `npm run check`
- [ ] `npm --prefix desktop run pack:mac`

Manual proof:
- [ ] Pack on macOS and record signing/notarization status.
- [ ] Launch with networking disabled.
- [ ] Create a local edit and export a portable bundle.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: Unsigned/not notarized is acceptable for v0.1 beta only if release notes repeat it.
```

### Windows desktop shell (desktop-windows)

- Artifact: NSIS installer and portable executable
- Platforms: Windows
- Entrypoint: `npm --prefix desktop run pack:win`

Required files:
- [ ] `desktop/package.json`
- [ ] `desktop/package-lock.json`
- [ ] `desktop/electron/main.cjs`
- [ ] `desktop/electron/preload.cjs`
- [ ] `docs/desktop-app.md`

Verification commands:
- [ ] `npm run check`
- [ ] `npm --prefix desktop run pack:win`

Manual proof:
- [ ] Pack on Windows and record signing status.
- [ ] Install/uninstall or launch portable executable.
- [ ] Launch with networking disabled, create a local edit, and export a portable bundle.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: Unsigned installer is acceptable for v0.1 beta only if release notes repeat it.
```

### Agora CLI (cli)

- Artifact: Node.js command wrapper
- Platforms: macOS, Windows, Linux
- Entrypoint: `npm run agora -- help`

Required files:
- [ ] `scripts/agora-cli.js`
- [ ] `README.md`
- [ ] `docs/install.md`

Verification commands:
- [ ] `npm run agora -- verify --quick`
- [ ] `npm run agora -- package-check --json`

Manual proof:
- [ ] Run quick verification from a fresh shell.
- [ ] Inspect at least one portable bundle.
- [ ] Generate demo links for the release demo URL.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: None recorded yet.
```

### Local MCP server (mcp-server)

- Artifact: stdio MCP server for local power-user clients
- Platforms: macOS, Windows, Linux
- Entrypoint: `npm run mcp`

Required files:
- [ ] `scripts/agora-mcp-server.js`
- [ ] `docs/mcp-server.md`
- [ ] `docs/mcp-security-audit.md`

Verification commands:
- [ ] `npm run test:mcp`

Manual proof:
- [ ] Run the MCP integration test.
- [ ] Confirm read-only default behavior.
- [ ] Record whether write tools are enabled and why.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: None recorded yet.
```

### Portable workspace bundle (portable-data)

- Artifact: JSON/CSV/Markdown workspace export
- Platforms: Agora web, Agora desktop, future mobile shells
- Entrypoint: `Data > Portable workspace bundle`

Required files:
- [ ] `docs/portable-workspace.md`
- [ ] `tests/fixtures/portable-workspace-bundle.json`
- [ ] `server/portable-fixtures-test.js`

Verification commands:
- [ ] `npm run test:fixtures`
- [ ] `npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json`

Manual proof:
- [ ] Validate portable workspace fixtures.
- [ ] Preview an import before applying it.
- [ ] Run a restore drill from the selected backup or bundle.

Evidence to paste:

```md
- Status: pending
- Operator:
- Environment/device:
- Commands run:
- Artifacts:
- Notes:
- Accepted risk: None recorded yet.
```

## Sign-Off Checklist

- Every channel has evidence or an explicit accepted risk.
- At least one portable bundle is captured and linked.
- At least one server backup is captured and linked for API-backed releases.
- Rollback owner and rollback target are filled in the release candidate.
- The hosted demo evidence bundle is linked before broad sharing.
