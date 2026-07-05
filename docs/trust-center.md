# Trust Center

Agora's trust story should be inspectable, not just persuasive. The Trust Center combines the in-app trust posture with a repository-level report that verifies the evidence self-hosters, security reviewers, and project managers need before they invite a real team.

Run it locally:

```sh
npm run trust
npm run agora -- trust
npm run agora -- trust --json
```

## What The Report Checks

- Public promise: the README states the no ads, no trackers, no lock-in position.
- Runtime privacy: app, service worker, manifest, and server runtime files are scanned for common tracker tokens.
- Secret handling: SECURITY.md documents server-only production secrets for Supabase, AI, payments, SMTP, and webhooks.
- Security headers: the app and API expose CSP, referrer, content-type, and opener policy protections.
- Operational support: release metadata and redacted Admin Diagnostics are available for production support.
- Recovery: disaster recovery drills are documented and runnable from server backups.
- Upgrade safety: production upgrades have a backup and migration preflight gate.
- Portability: portable workspace bundles are documented and fixture-backed.
- Migration: competitor imports have a concierge preflight with field coverage, cleanup, rollback, apply strategy, reviewer checklist, and regression coverage before data touches a workspace.
- Hosted readiness: hosted environment checks and launch runbooks exist.
- Ecosystem safety: plugin, MCP, connector, template, and automation extension points are declared and validated.

## Customer-Facing Evidence

For a project manager evaluating Agora, the strongest evidence is:

1. Export a portable workspace bundle from Data.
2. Run `npm run drill:recovery -- --fixture` or a real backup drill.
3. Run `npm run verify:upgrade -- --backup <server-backup.json>` before an upgrade.
4. For migrations, run `npm run migrate:concierge -- <export-file> --source <source> --workspace <workspace.json> --backup <backup-or-bundle.json>` and review the report before applying.
5. Run `npm run verify:hosted` and refresh Backend Health before inviting a real team.
6. Run `npm run trust` and attach the output to the launch checklist.

The report intentionally avoids printing secret values. It checks that the right controls and docs exist, then points reviewers to the files that back each claim.

## Operator Cadence

- Before a beta customer: run `npm run trust`, `npm run verify:hosted`, and `npm run qa`.
- Before a production upgrade: run `npm run verify:upgrade`, `npm run drill:recovery`, and `npm run trust`.
- After adding an integration, plugin, MCP tool, payment adapter, or AI provider: run `npm run ecosystem`, `npm run security`, and `npm run trust`.

Any failed Trust Center check should block launch until the missing evidence is restored or the product claim is intentionally revised.
