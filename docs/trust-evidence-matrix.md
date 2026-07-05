# Trust Evidence Matrix

This matrix turns Agora's trust claims into reviewable evidence. Use it for buyer reviews, security questionnaires, self-hosting approvals, and release gates.

| Trust claim | Evidence | Verification command | Review cadence |
| --- | --- | --- | --- |
| Agora does not ship third-party tracking in runtime files. | `scripts/trust-report.js`, `README.md`, `docs/trust-center.md` | `npm run trust` | Every release candidate |
| Production secrets stay server-side. | `SECURITY.md`, `docs/deployment.md`, `scripts/hosted-env-verify.js` | `npm run verify:hosted` | Before production launch and after env changes |
| Browser and API responses use defensive security headers. | `server/static.js`, `server/api.js`, `docs/deployment.md` | `npm run trust` | Every release candidate |
| Public and sensitive endpoints have regression coverage. | `scripts/admin-security-regression.js`, `server/smoke-test.js`, `docs/security-audit-2026-07-05.md` | `npm run test:admin-security && npm run test:api` | Before release and after auth/API changes |
| Dependency audits are clean at moderate severity or higher. | `package.json`, `package-lock.json`, `desktop/package-lock.json`, `docs/security-audit-2026-07-05.md` | `npm audit --audit-level=moderate && npm --prefix desktop audit --audit-level=moderate` | Before release and after dependency updates |
| Workspace data is portable and restorable. | `docs/portable-workspace.md`, `tests/fixtures/portable-workspace-bundle.json`, `scripts/disaster-recovery-drill.js` | `npm run test:fixtures && npm run drill:recovery -- --fixture` | Before launch, before upgrades, quarterly |
| Production upgrades have backup and migration gates. | `docs/upgrade-checklist.md`, `scripts/upgrade-safety-check.js`, `docs/disaster-recovery-drill.md` | `npm run verify:upgrade && npm run drill:recovery -- --backup <server-backup.json>` | Before every production upgrade |
| Competitor migrations are previewable and reversible. | `docs/migration-tool.md`, `scripts/migration-concierge.js`, `scripts/migration-concierge-test.js` | `npm run test:importers` | Before customer migration work |
| AI Operator actions are permissioned, previewable, auditable, and reversible where possible. | `docs/ai-data-policy.md`, `SECURITY.md`, `docs/project-autopilot.md`, `docs/api-agent-contract.md` | `npm run trust` | Before enabling a provider and after Operator changes |
| Hosted deployments have a repeatable launch gate. | `docs/hosted-launch-runbook.md`, `scripts/hosted-env-verify.js`, `scripts/hosted-deploy-rehearsal.js` | `npm run verify:production -- --env .env.production --backup <server-backup.json> --strict` | Before hosted launch and major infra changes |
| Extension surfaces are declared and constrained. | `ecosystem/extension-points.json`, `docs/ecosystem.md`, `docs/plugin-architecture.md`, `docs/mcp-security-audit.md` | `npm run ecosystem && npm run test:plugins && npm run test:mcp` | Before enabling or changing extension points |

## Buyer Packet

For a buyer or security reviewer, include:

1. `docs/trust-center.md`
2. `docs/trust-evidence-matrix.md`
3. `docs/ai-data-policy.md`
4. Latest `npm run trust` output.
5. Latest `npm run security` or equivalent command output.
6. Latest recovery or upgrade evidence from `npm run drill:recovery` and `npm run verify:upgrade`.

Do not attach `.env` files, raw workspace exports, server backups, API tokens, provider keys, SMTP credentials, or customer data unless the reviewer is explicitly authorized to inspect that workspace.

## Open Evidence Gaps

- Live SOC 2, ISO 27001, or third-party penetration-test reports do not exist yet.
- Mobile keychain/keystore evidence should be added after native mobile wrappers ship.
- Live payment-provider evidence should be added after Stripe, x402, or another payment adapter is enabled beyond the current foundation layer.
