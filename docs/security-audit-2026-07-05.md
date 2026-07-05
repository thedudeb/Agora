# Security Audit - 2026-07-05

Audit target: `b004d39`

Generated: `2026-07-05T12:22:30Z`

## Scope

This follow-up audit verifies the production security hardening work completed after the whole-repo security review:

- Hosted production environment verifier fails risky deployment settings.
- Desktop API sessions use OS-backed Electron `safeStorage` when available.
- Production security docs reflect current behavior and launch gates.
- Public endpoint abuse cases are covered by API smoke tests.
- Dependency audits are clean at moderate severity or higher.

## Verification

All commands below passed:

```sh
npm run check
npm run test:admin-security
npm run test:fixtures
npm run test:importers
npm run test:plugins
npm run test:api
npm run test:mcp
node scripts/hosted-env-verify.js --env tests/fixtures/hosted-production.env --require-github
npm audit --audit-level=moderate
npm --prefix desktop audit --audit-level=moderate
```

Notes:

- `npm run test:api` and `npm run test:mcp` require binding an ephemeral `127.0.0.1` server; they passed after the sandbox allowed local bind.
- `npm --prefix desktop audit --audit-level=moderate` requires npm registry access; it passed after network access was allowed.

## Result

No moderate-or-higher dependency vulnerabilities were reported. The security regression and API smoke suites now cover the main risky surfaces from the previous audit: token export redaction, realtime bearer handling, production CORS defaults, public invite lookup rate limiting, public feature abuse limits, portal action abuse handling, signed webhook replay, hosted verifier gates, and desktop secure session storage.

## Remaining Follow-Up

- Run `npm run verify:hosted` against the real production environment before inviting a real team.
- Run `npm run test:supabase` against a disposable Supabase verification workspace before enabling hosted Supabase storage/auth.
- Re-run this audit after adding mobile keychain/keystore implementations or live payment adapters.
