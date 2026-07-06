# Agora v0.1 Beta Accepted Gaps

Use this board to keep beta scope honest. These gaps are acceptable for guided `v0.1-beta` only while they remain visible in release notes, install docs, the release candidate record, and tester handoff materials.

## Accepted For Guided Beta

| Gap | Status | User-facing wording | Proof required before widening |
| --- | --- | --- | --- |
| Hosted demo URL | Pending | The public demo URL is not published yet. | Hosted demo URL, reset owner, demo data hygiene review, and hosted demo evidence bundle. |
| Production hosted verification | Pending | Hosted production requires operator-provided Supabase, SMTP/webhook, backup, and domain configuration. | `npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict` against the target environment. |
| Release backup and recovery drill | Pending | Browser-local workspaces should not be the only copy of important work. | Fresh server backup, portable bundle, and `npm run drill:recovery -- --backup <server-backup.json>`. |
| Real device/offline checks | Pending | The PWA is the current mobile install path; native mobile apps are not shipped. | iOS and Android PWA install, airplane-mode launch, local edit, export, and queued sync retry proof. |
| Desktop signing | Accepted beta risk | Desktop packaging exists, but broad public desktop distribution is not signed/notarized yet. | Signed/notarized macOS build, signed Windows installer or documented signing status, and packaged app smoke tests. |
| Native iOS/Android wrappers | Out of scope for v0.1 beta | Native wrappers are planned, not shipped. | Separate native wrapper build, keychain/keystore session evidence, offline launch/edit/export proof. |
| Live payment providers | Foundation only | Payment surfaces are provider foundations; Stripe/x402/live money movement is not enabled by default. | Provider configuration docs, server-side secret proof, webhook verification, entitlement audit, and rollback path. |
| Deep two-way integrations | Foundation only | Integrations are adapter/manifest/sync handoff surfaces until configured. | Per-provider auth, scopes, sync direction, conflict behavior, rate-limit handling, and audit proof. |
| Remote MCP | Out of scope for v0.1 beta | MCP is local v0 only; remote MCP should wait. | OAuth, origin checks, rate limits, transport hardening, and deeper audit logging. |
| First beta tester proof | Pending | The beta feedback loop is ready, but external tester proof is not recorded yet. | At least one guided tester scorecard, feature request taskboard item, owner/status update, and accepted-risk review. |

## Non-Negotiables

- Do not describe native iOS or Android wrappers as shipped.
- Do not describe desktop packages as ready for broad public distribution until signing and platform smoke evidence exist.
- Do not invite real client stakeholders until API auth, permissions, backups, email delivery, and Readiness checks are complete.
- Do not move from guided beta to broad beta without hosted demo proof, recovery proof, real device/offline proof, and first tester scorecard evidence.
- Do not accept real customer data in public demos, screenshots, support requests, or feedback examples.

## Review Cadence

- Review this file before each release evidence refresh.
- Copy any changed accepted risks into [`release-candidate-v0.1-beta.md`](./release-candidate-v0.1-beta.md), [`release-notes-v0.1-beta.md`](./release-notes-v0.1-beta.md), and [`beta-notes.md`](./beta-notes.md).
- Close a gap only when the proof artifact is linked from the release candidate handoff.
