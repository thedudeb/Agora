# Distribution Proof

Use this ledger for every release candidate. Packaging metadata says what Agora intends to ship; this file says what proof is required before telling real users that a channel works.

Run:

```sh
npm run distribution:check
npm run package:check
npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict
npm run drill:recovery -- --backup <server-backup.json>
```

## Release Evidence Matrix

| Channel ID | Channel | Required Proof | Release Evidence |
| --- | --- | --- | --- |
| source | Source install | Clean checkout, `npm run setup`, `npm run dev`, export portable bundle. | Fill per release. |
| docker-compose | Docker Compose | `docker compose config`, boot app/API, confirm persistent API data volume and server backup path. | Fill per release. |
| hosted | Hosted web/API deployment | Hosted `/api/health`, Backend Health, email diagnostics, feature request task/email, server backup. | Fill per release. |
| pwa-offline | Offline PWA | Install from browser, launch in airplane-mode, create local edit, export portable bundle offline. | Fill per release. |
| desktop-macos | macOS desktop shell | Pack on macOS, launch with network disabled, local edit, export bundle, document signing/notarization status. | Fill per release. |
| desktop-windows | Windows desktop shell | Pack on Windows, install/uninstall or portable launch, local edit, export bundle, document signing status. | Fill per release. |
| cli | Agora CLI | `npm run agora -- verify --quick`, `npm run agora -- package-check --json`, bundle inspect. | Fill per release. |
| mcp-server | Local MCP server | `npm run test:mcp`, confirm read-only default and write opt-in docs. | Fill per release. |
| portable-data | Portable workspace bundle | `npm run test:fixtures`, import preview, restore drill, inspect JSON/CSV/Markdown bundle contents. | Fill per release. |

## Manual Device Proof

Automation is not enough for installable products. Before external beta, collect at least:

- Android Chrome PWA install, airplane-mode launch, local edit, portable export.
- iPhone Safari or iPad Safari responsive pass, even before native wrappers exist.
- macOS desktop packaged launch with network disabled.
- Windows desktop packaged launch with network disabled.
- Hosted demo browser pass on desktop and mobile widths.

## Accepted Beta Gaps

These gaps are acceptable only when repeated in release notes:

- Desktop apps may be unsigned/not notarized during v0.1 beta.
- Native iOS and Android wrappers are not shipped yet; mobile proof is the offline PWA.
- Docker registry publishing and digest pinning are not required until public binary/container distribution.
- Hosted installs require operator-owned Supabase, SMTP/webhook, domain, and backup configuration.

## Release Sign-Off Rule

Do not tag a broad beta release until:

- every channel has release evidence or an explicit accepted risk;
- at least one portable bundle and one server backup have been captured;
- rollback target and rollback owner are recorded;
- `docs/release-candidate-v0.1-beta.md` links the exact evidence for the release commit.
