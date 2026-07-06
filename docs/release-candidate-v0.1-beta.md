# Agora v0.1 Beta Release Candidate

Use this as the live release record for the first external beta candidate. Update it before tagging, deploying, or sending Agora to a team outside the maintainers.

## Release Decision

- Version: `0.1.0-beta`
- Candidate status: not tagged
- Release owner: Agora maintainer
- Target audience: agencies, consultants, self-hosters, and power users evaluating the Acme client-delivery workflow
- Decision: hold until the evidence ledger is filled from a clean release branch or release tag
- Filled handoff: [`release-candidate-v0.1-beta-handoff.md`](./release-candidate-v0.1-beta-handoff.md)

## Evidence Ledger

Paste command output or link CI artifacts for the exact commit being released.

Generate the local evidence bundle with:

```sh
npm run release:evidence
```

| Gate | Required Evidence | Status |
| --- | --- | --- |
| Release discipline | `npm run release:check` | Passed in latest local evidence |
| Hosted demo | `npm run demo:check` and `npm run demo:hosted:check -- --base <demo-url> --write-evidence` | Local gate passed; public demo URL pending |
| Screenshots | `npm run screenshots` and inspect Acme screenshot set | Pending for release commit |
| Distribution proof | `npm run distribution:check`, `npm run distribution:evidence -- --release <release>`, and fill `docs/distribution-proof.md` evidence rows | Ledger gate passed; channel proof pending |
| Beta feedback loop | `npm run beta:check` and submit one feature request through the beta path | Local gate passed; tester proof pending |
| Packaging | `npm run package:check` | Passed in latest local evidence |
| Trust evidence | `npm run trust` | Passed in latest local evidence |
| QA | `npm run qa` | Passed in latest local evidence |
| Security | `npm run security` | Passed in latest local evidence |
| Production verify | `npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict` | Pending real hosted env |
| Recovery drill | `npm run drill:recovery -- --backup <server-backup.json>` | Pending real release backup |




## Latest Local Evidence Bundle

- Generated: 2026-07-06T03:14:28.744Z
- Commit: 80f9e8d
- Dirty worktree: no
- Mode: browser
- Status: PASS
- Bundle: [release/evidence/20260706T031428Z-80f9e8d](../release/evidence/20260706T031428Z-80f9e8d/README.md)

| Gate | Status | Evidence |
| --- | --- | --- |
| Release candidate discipline | PASS | [release-check.txt](../release/evidence/20260706T031428Z-80f9e8d/release-check.txt) |
| Hosted demo readiness | PASS | [demo-check.txt](../release/evidence/20260706T031428Z-80f9e8d/demo-check.txt) |
| Distribution proof ledger | PASS | [distribution-check.txt](../release/evidence/20260706T031428Z-80f9e8d/distribution-check.txt) |
| Beta feedback loop | PASS | [beta-check.txt](../release/evidence/20260706T031428Z-80f9e8d/beta-check.txt) |
| Packaging manifest | PASS | [package-check.txt](../release/evidence/20260706T031428Z-80f9e8d/package-check.txt) |
| Trust evidence | PASS | [trust.txt](../release/evidence/20260706T031428Z-80f9e8d/trust.txt) |
| Acme demo browser golden path | PASS | [golden-demo.txt](../release/evidence/20260706T031428Z-80f9e8d/golden-demo.txt) |
| Feedback browser golden path | PASS | [golden-feedback.txt](../release/evidence/20260706T031428Z-80f9e8d/golden-feedback.txt) |

Manual evidence still required: hosted demo URL, hosted production verify, real device/offline checks, release backup, portable bundle, and beta tester follow-up.

## Latest Distribution Evidence Bundle

- Generated: pending
- Commit: pending
- Bundle: pending
- Channels covered: source, docker-compose, hosted, pwa-offline, desktop-macos, desktop-windows, cli, mcp-server, portable-data
- Paste-in: pending

## Acme Demo Gate

The release demo must use [`acme-client-launch-demo.md`](./acme-client-launch-demo.md).

## Hosted Demo Evidence

- Demo URL: pending
- Public feedback URL: pending
- Generated Acme links: pending
- Hosted demo evidence bundle: pending
- `npm run demo:hosted:check -- --base <demo-url>`: pending
- `npm run demo:hosted:check -- --base <demo-url> --golden`: pending
- Reset timestamp: pending
- Reset owner: pending
- Demo data hygiene review: pending

Required before publishing:

- Follow [`hosted-demo-deployment.md`](./hosted-demo-deployment.md).
- Follow [`hosted-demo-runbook.md`](./hosted-demo-runbook.md).
- Generate hosted links with `npm run demo:links -- --base <demo-url> --demo acme-client-launch --markdown`.
- Run `npm run demo:hosted:check -- --base <demo-url>`.
- Run `npm run demo:hosted:check -- --base <demo-url> --write-evidence` and link the generated `release/evidence/hosted-demo-<timestamp>-<commit>/README.md`.
- Run `npm run demo:check`.
- Run `AGORA_GOLDEN_SUITE=demo npm run test:golden`.
- Refresh the screenshots named in [`screenshot-demo-plan.md`](./screenshot-demo-plan.md).
- Record or re-record the short demo using [`demo-video-script.md`](./demo-video-script.md) and [`demo-video-production-checklist.md`](./demo-video-production-checklist.md).
- Confirm the hosted demo contains no real customer data, secrets, private emails, or paid-provider credentials.

## Beta Feedback Gate

- Follow [`beta-feedback-loop.md`](./beta-feedback-loop.md).
- Use [`beta-invite-pack.md`](./beta-invite-pack.md) for the first tester invite.
- Run `npm run beta:check`.
- Run `AGORA_GOLDEN_SUITE=feedback npm run test:golden` before widening beta.
- Submit one in-app feature request and confirm it appears on the Feature Requests taskboard.
- If public feedback is enabled, submit one public form item and confirm owner email queues or delivers.

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

Canonical accepted-gaps board: [`known-gaps-v0.1-beta.md`](./known-gaps-v0.1-beta.md)

## Release Notes

Draft release notes: [`release-notes-v0.1-beta.md`](./release-notes-v0.1-beta.md)

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
