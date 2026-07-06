# Agora v0.1 Beta Release Candidate Handoff

Use this as the filled handoff packet for the first guided external beta. It complements the live release record in [`release-candidate-v0.1-beta.md`](./release-candidate-v0.1-beta.md).

## Release Identity

- Version: `0.1.0-beta`
- Git commit: pending final release tag after hardening docs and evidence refresh
- Latest indexed evidence commit: `a078c4a`
- Release owner: Agora maintainer
- Target audience: agencies, consultants, self-hosters, and power users evaluating the Acme client-delivery workflow
- Release date: pending
- Candidate status: guided beta, not broad public production

## Required Gate Output

Latest local evidence bundle:

- Bundle: [`release/evidence/20260706T022503Z-a078c4a`](../release/evidence/20260706T022503Z-a078c4a/README.md)
- Generated: 2026-07-06T02:25:03.274Z
- Dirty worktree: no
- Mode: browser
- Status: PASS

| Gate | Current evidence | Handoff status |
| --- | --- | --- |
| `npm run release:check` | [`release-check.txt`](../release/evidence/20260706T022503Z-a078c4a/release-check.txt) | Passed in latest local evidence |
| `npm run demo:check` | [`demo-check.txt`](../release/evidence/20260706T022503Z-a078c4a/demo-check.txt) | Passed in latest local evidence |
| `npm run distribution:check` | [`distribution-check.txt`](../release/evidence/20260706T022503Z-a078c4a/distribution-check.txt) | Passed in latest local evidence |
| `npm run beta:check` | [`beta-check.txt`](../release/evidence/20260706T022503Z-a078c4a/beta-check.txt) | Passed in latest local evidence |
| `npm run package:check` | [`package-check.txt`](../release/evidence/20260706T022503Z-a078c4a/package-check.txt) | Passed in latest local evidence |
| `npm run trust` | [`trust.txt`](../release/evidence/20260706T022503Z-a078c4a/trust.txt) | Passed in latest local evidence |
| `AGORA_GOLDEN_SUITE=demo npm run test:golden` | [`golden-demo.txt`](../release/evidence/20260706T022503Z-a078c4a/golden-demo.txt) | Passed in latest local evidence |
| `AGORA_GOLDEN_SUITE=feedback npm run test:golden` | [`golden-feedback.txt`](../release/evidence/20260706T022503Z-a078c4a/golden-feedback.txt) | Passed in latest local evidence |
| `npm run qa` | not in current browser evidence bundle | Refresh before release tag |
| `npm run security` | not in current browser evidence bundle | Refresh before release tag |
| `npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict` | none yet | Pending real hosted environment |
| `npm run drill:recovery -- --backup <server-backup.json>` | none yet | Pending real release backup |

Before tagging or sending to external teams, regenerate a clean full bundle from the final commit with:

```sh
npm run release:evidence -- --full
```

## Platform Notes

| Channel | Status | Evidence | Accepted risk |
| --- | --- | --- | --- |
| Source install | Beta-ready | `package.json`, `package-lock.json`, `scripts/agora-setup.js`, [`install.md`](./install.md) | Tagged source archives can wait for release automation. |
| Docker Compose | Beta-ready | `Dockerfile`, `docker-compose.yml`, `.dockerignore`, [`install.md`](./install.md) | Registry publishing and digest pinning are pending. |
| Hosted web/API | Beta-ready with operator setup | [`deployment.md`](./deployment.md), [`hosted-launch-runbook.md`](./hosted-launch-runbook.md), `scripts/hosted-env-verify.js` | Requires operator-provided Supabase, SMTP/webhook, backups, and domain config. |
| Offline PWA | Beta-ready | `manifest.webmanifest`, `sw.js`, `offline.html`, app icons | Real iOS/Android install and airplane-mode proof is still pending for the release candidate. |
| macOS desktop | Internal-ready | `desktop/package.json`, Electron shell, [`desktop-app.md`](./desktop-app.md) | Not signed/notarized; broad public distribution is not ready. |
| Windows desktop | Internal-ready | `desktop/package.json`, Electron shell, [`desktop-app.md`](./desktop-app.md) | Not signed; installer/uninstaller and portable-mode QA are still pending. |
| Agora CLI | Beta-ready | `scripts/agora-cli.js`, README commands, [`install.md`](./install.md) | Shell completion can wait until commands settle. |
| Local MCP server | Local v0-ready | `scripts/agora-mcp-server.js`, [`mcp-server.md`](./mcp-server.md), [`mcp-security-audit.md`](./mcp-security-audit.md) | Remote MCP waits for OAuth, origin checks, rate limits, and deeper audit logging. |
| Portable data | Beta-ready | [`portable-workspace.md`](./portable-workspace.md), fixture bundle, `server/portable-fixtures-test.js` | Refresh fixtures when schema or marketplace artifacts change. |

## Manual PM Pass

- Canonical Acme client-launch demo works from generated links.
- Landing page explains the agency/consultant wedge.
- First-run setup reaches a useful workspace in under 10 minutes.
- Client visibility review clearly separates shared and internal context.
- Autopilot recovery proposals are visibly previewed, auditable, and reversible.
- Data export and recovery proof are understandable before real customer data is entered.
- Payments surfaces are labeled as provider foundations when no live adapter is configured.
- Integrations surfaces are labeled as adapter/manifest/sync handoff when full third-party sync is not configured.
- Mobile-width Dashboard, Command Center, Client Visibility, Readiness, and Data are usable.

## Known Gaps

These are accepted for `v0.1-beta` only while they stay visible in release notes, install docs, and the release candidate record:

- Desktop builds are not signed/notarized for broad public distribution.
- Native iOS and Android wrappers are not shipped; mobile install is the offline PWA.
- Hosted production launches require operator-provided Supabase, SMTP/webhook, backup, and domain configuration.
- Real production upgrades require a fresh server backup and strict verification.
- Hosted demo URL, production verification, real device/offline checks, release backup, portable bundle, and beta tester follow-up are still pending.

## Rollback Plan

- Previous known-good commit: `a078c4a` until a newer release tag is cut and verified.
- Hosted rollback target: pending hosted environment.
- Backup artifact: pending release backup.
- Portable bundle: pending release portable workspace bundle.
- Owner who can approve rollback: Agora maintainer.
- Trigger conditions: failed auth, corrupted workspace state, failed restore drill, broken export/import path, failed hosted health check, security regression, or client-visible data leak risk.

## Sign-Off

- Product: pending after Acme demo scorecard pass
- Engineering: pending after final full release evidence
- Security/trust: pending after final `npm run security` and trust evidence review
- Release owner: pending hosted demo, recovery, and beta feedback proof
