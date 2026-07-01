# Beta Notes

Agora is ready for guided beta use by technical founders, small agencies, and self-hosting-minded teams. It is not yet a hands-off SaaS with production onboarding, billing enforcement, or managed support.

## What Works Best

- Launch Flow gives a guided path for the first client workspace.
- Dashboard, Today, Inbox, Board, List, Calendar, My Work, Reports, Goals, Docs, Data, Settings, Readiness, and Marketplace render in the browser app.
- Local browser storage works without an API.
- Portable workspace bundles include workspace JSON, Markdown, CSV, templates, automations, audit history, and operator context.
- Local backups and restore previews are available from Data and Readiness.
- Marketplace templates and automation packs can be installed, exported, imported, and validated.
- The CLI can run verification, inspect bundles, check launch readiness, and stress-test recovery.
- The API supports local JSON persistence, sessions, invitations, audit events, notifications, marketplace publishing, payments metadata, and file routes.
- Supabase can be used for hosted persistence and auth when the documented migrations and environment variables are configured.

## Known Limitations

- Browser-local workspaces live in local storage. Clearing browser data removes local-only state unless a portable bundle or backup exists.
- Local backups are stored in the browser. Export a portable bundle before risky imports or machine/browser changes.
- The app has no hosted multi-tenant billing enforcement beyond the current entitlement and payment-planning surfaces.
- Email, SMTP, password reset delivery, and webhook delivery require API configuration and environment variables.
- Supabase setup is manual: migrations, RLS/auth settings, storage bucket, and environment variables must be configured by the operator.
- Desktop packaging exists as a path, but beta validation should prioritize the browser app unless the tester is specifically evaluating desktop.
- AI/operator features are deterministic by default. External AI providers require separate configuration and should be reviewed for data policy fit.
- Mobile is usable, but dense admin routes are optimized for tablet/desktop review after the quick launch path.
- Import flows should be previewed first. Do not replace important workspaces without a fresh bundle or backup.

## Do Not Trust Yet

- Do not treat browser-local storage as the only copy of important client work.
- Do not invite a real client before API auth, permissions, backups, and Readiness have been checked.
- Do not expose demo auth or passwordless auth outside trusted demos.
- Do not put service role keys, AI provider keys, Stripe keys, SMTP secrets, or webhook secrets in client-visible code.
- Do not assume a Supabase project is production-ready until `npm run verify:supabase` and Backend Health both pass.

## Recommended Beta Path

1. Run `npm run verify:quick`.
2. Run `npm run test:golden`.
3. Follow [`beta-test-script.md`](./beta-test-script.md).
4. Export a portable bundle.
5. Run `npm run agora -- launch check <bundle.json>`.
6. Review Readiness in the app.
7. Record confusing copy, broken layout, failed commands, and any step that needed explanation.

## Feedback To Capture

- Was the first useful action obvious?
- Did Launch Flow make the product feel guided?
- Did Readiness explain what was safe or incomplete?
- Did recovery feel trustworthy?
- Did local mode versus API mode make sense?
- Did mobile navigation feel usable enough for quick checks?
- Which route felt too dense or unclear?

## Before Widening Beta

- Run the full [`release-checklist.md`](./release-checklist.md).
- Run the manual [`beta-test-script.md`](./beta-test-script.md) on desktop and mobile width.
- Confirm screenshots are current with `npm run screenshots`.
- Confirm `npm run launch:check` passes.
- Write down any accepted risks in release notes.
