# Agora Beta

Agora is ready for a focused beta with teams that want local-first, self-hostable project management without ads, trackers, or export lock-in.

This beta is best for agencies, consultants, and small project teams that can try Agora on a real client-style workspace and give direct feedback on onboarding, collaboration, feedback intake, recovery, and hosted setup.

## Who Should Try It

- Agencies or consultants managing client delivery, approvals, handoffs, and status updates.
- Operators who care about portable data, local-first workflows, and self-hosting.
- Small teams comfortable running an early product and reporting rough edges.

## What To Expect

Agora currently includes:

- browser-local workspace mode with backups, imports, exports, and portable bundles;
- optional API sync with local JSON storage or Supabase storage/auth;
- project views, templates, automations, client portals, collaboration, goals, reports, docs/files, custom fields, and feature-request triage;
- invite, password reset, public feedback, and requester-update email paths through the API;
- release QA in GitHub Actions and `npm run qa`.

This is still beta software. Expect UI papercuts, incomplete payment adapters, and integration surfaces that are ready for testing but not yet a polished SaaS.

## Beta Setup

1. Run the local app and API.

```sh
cp .env.example .env
npm run dev
npm run dev:api
```

2. Open `http://127.0.0.1:5174`.

3. In Settings > Account:

- create or sign in as the first owner;
- save or load the workspace through the API;
- refresh Backend Health;
- review Hosted onboarding.

4. In Settings > Feedback:

- confirm Email diagnostics;
- copy the public feedback link;
- submit one feature request.

5. In Data:

- create a backup;
- download a portable bundle;
- preview an import before replacing anything.

## Hosted Beta Checklist

Before inviting an outside tester:

- GitHub Actions `QA` is green for the release commit.
- `npm run qa` passes locally.
- `AGORA_ALLOWED_ORIGINS` is restricted to the hosted app origin.
- `AGORA_PUBLIC_APP_URL` is the hosted HTTPS app URL.
- `AGORA_DEMO_AUTH=false`.
- `AGORA_PASSWORDLESS_AUTH=false`.
- SMTP or webhook password reset delivery is configured for production.
- SMTP, sender, invitation, and feature-request owner email diagnostics are acceptable.
- Supabase migrations `001`, `002`, and `003` have run when using Supabase.
- A recovery bundle has been exported before the beta session.

## Feedback

Use the in-app Feature Request button or the public feedback link from Settings > Feedback.

For each issue, include:

- what you were trying to do;
- the route or screen;
- browser/device width;
- whether API sync was connected;
- what happened;
- what you expected instead.

## Data And Exit Promise

Beta testers should be able to leave with their data. Use Data to export workspace JSON, task CSV, time CSV, Markdown reports, and the portable workspace bundle.

Do not store production secrets in browser settings. Keep Supabase service-role keys, SMTP credentials, AI provider keys, payment keys, and webhook secrets on the API server only.

## Known Limits

- Stripe and x402 payment adapters are skeletons until real checkout/webhook integrations are configured.
- External integrations are represented as configurable adapters and audit events, not full third-party sync clients.
- Email delivery depends on the API server and SMTP/webhook configuration.
- Offline-native iOS, Android, Windows, and Mac wrappers are planned around the existing local-first storage contract; the browser PWA and Mac shell are the current proof points.
