# Agora v0.1 Beta Release Candidate

Use this as the live release record for the first external beta candidate. Update it before tagging, deploying, or sending Agora to a team outside the maintainers.

## Release Decision

- Version: `0.1.0-beta`
- Candidate status: not tagged
- Release owner: Agora maintainer
- Target audience: agencies, consultants, self-hosters, and power users evaluating the Acme client-delivery workflow
- Decision: hold until the evidence ledger is filled from a clean release branch or release tag

## Evidence Ledger

Paste command output or link CI artifacts for the exact commit being released.

| Gate | Required Evidence | Status |
| --- | --- | --- |
| Release discipline | `npm run release:check` | Pending for release commit |
| Hosted demo | `npm run demo:check` | Pending for release commit |
| Screenshots | `npm run screenshots` and inspect Acme screenshot set | Pending for release commit |
| Packaging | `npm run package:check` | Pending for release commit |
| Trust evidence | `npm run trust` | Pending for release commit |
| QA | `npm run qa` | Pending for release commit |
| Security | `npm run security` | Pending for release commit |
| Production verify | `npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict` | Pending real hosted env |
| Recovery drill | `npm run drill:recovery -- --backup <server-backup.json>` | Pending real release backup |

## Acme Demo Gate

The release demo must use [`acme-client-launch-demo.md`](./acme-client-launch-demo.md).

Required before publishing:

- Follow [`hosted-demo-runbook.md`](./hosted-demo-runbook.md).
- Generate hosted links with `npm run demo:links -- --base <demo-url> --demo acme-client-launch --markdown`.
- Run `npm run demo:check`.
- Run `AGORA_GOLDEN_SUITE=demo npm run test:golden`.
- Refresh the screenshots named in [`screenshot-demo-plan.md`](./screenshot-demo-plan.md).
- Record or re-record the short demo using [`demo-video-script.md`](./demo-video-script.md) and [`demo-video-production-checklist.md`](./demo-video-production-checklist.md).
- Confirm the hosted demo contains no real customer data, secrets, private emails, or paid-provider credentials.

## Platform Evidence

| Channel | Required Proof Before External Beta | Status |
| --- | --- | --- |
| Source install | Clean checkout, `npm run setup`, `npm run dev`, export bundle | Pending |
| Docker Compose | `docker compose config`, boot app/API, persistent data volume check | Pending |
| Hosted web/API | Hosted app/API health, backend health, invite/email diagnostics, backup path | Pending |
| Offline PWA | Install on Android Chrome, install/open on desktop, airplane-mode launch, export offline | Pending |
| macOS desktop | Pack locally, launch offline, export bundle, document signing status | Pending |
| Windows desktop | Pack on Windows runner or machine, launch offline, export bundle, document signing status | Pending |
| Agora CLI | `npm run agora -- verify --quick`, bundle inspect, demo links | Pending |
| Local MCP server | `npm run test:mcp`, read-only default, write opt-in documented | Pending |
| Portable data | Fixture validation, backup drill, import preview, restore proof | Pending |

## Known Gaps

These are acceptable for v0.1 beta only if they remain clearly documented in release notes and install docs:

- Desktop builds are not signed/notarized for broad public distribution.
- Native iOS and Android wrappers are not shipped; mobile install is the offline PWA.
- Hosted production launches require operator-provided Supabase, SMTP/webhook, backup, and domain configuration.
- Real production upgrades require a fresh server backup and strict verification.

## Rollback Plan

- Previous known-good commit: fill before release
- Hosted rollback target: fill before release
- Backup artifact: fill before release
- Portable bundle: fill before release
- Rollback owner: fill before release
- Trigger conditions: failed auth, corrupted workspace state, failed restore drill, broken export/import path, failed hosted health check, or security regression

## Sign-Off

- Product:
- Engineering:
- Security/trust:
- Release owner:
