# Hosted Demo Runbook

Use this for the public buyer demo. It is intentionally narrower than the production hosted launch runbook: the goal is a safe, resettable Acme Studio workspace that proves Agora quickly without collecting real customer data. For the concrete deployment checklist, use [`hosted-demo-deployment.md`](./hosted-demo-deployment.md).

## Demo Contract

- Audience: project managers at agencies, consultancies, and client-facing teams.
- Story: [`acme-client-launch-demo.md`](./acme-client-launch-demo.md).
- Public promise: no ads, no trackers, no lock-in, portable data, auditable AI.
- Data policy: no real customer data, no real private emails, no production secrets, no paid-provider credentials.
- Reset cadence: reset the seeded workspace after demos, launch events, and any public testing window; at minimum refresh before each release candidate.

## Required Environment

Use a dedicated demo deployment, not the production workspace for a real team.

Required settings:

```sh
AGORA_DEMO_AUTH=false
AGORA_PASSWORDLESS_AUTH=false
AGORA_PUBLIC_APP_URL=https://demo.your-domain.example
AGORA_ALLOWED_ORIGINS=https://demo.your-domain.example
AGORA_ALLOW_LOCALHOST_ORIGINS=false
AGORA_STRICT_CSP=true
```

Recommended settings:

```sh
AGORA_STRUCTURED_LOGS=true
AGORA_BACKUP_SCHEDULER_ENABLED=true
AGORA_BACKUP_RETENTION_FILES=10
```

Keep SMTP/webhook credentials separate from production. If email is enabled for feature requests, route owner notifications to the maintainer inbox and make the UI copy clear that this is a demo.

## Publish Links

Generate the hosted Acme handoff:

```sh
npm run demo:links -- --base https://demo.your-domain.example --demo acme-client-launch --markdown
```

Generate all follow-up scenario links:

```sh
npm run demo:links -- --base https://demo.your-domain.example --markdown
```

Before sharing links publicly:

```sh
npm run demo:check
npm run demo:hosted:check -- --base https://demo.your-domain.example
AGORA_GOLDEN_SUITE=demo npm run test:golden
```

If checking a deployed demo instead of the local app:

```sh
AGORA_GOLDEN_BASE_URL=https://demo.your-domain.example AGORA_GOLDEN_SUITE=demo npm run test:golden
```

## Reset And Hygiene

Before launch day:

1. Open the demo workspace and reset sample data.
2. Confirm the Acme route sequence works from generated links.
3. Export one portable workspace bundle from Data.
4. Run one server backup if the API is connected.
5. Submit one test feature request and confirm it creates a task and owner notification.
6. Delete any test comments, emails, screenshots, or imported files that look personal.

After public traffic:

1. Export a backup for debugging if anything failed.
2. Reset seeded data.
3. Rotate demo-only tokens or webhook secrets if they appeared in logs or screen recordings.
4. Capture issues in the taskboard with route, browser, timestamp, and expected behavior.

## Acceptance Checklist

- Acme generated links open command center, project backlog, visibility, project timeline, reports, and data recovery proof.
- Demo route QA passes locally or against `AGORA_GOLDEN_BASE_URL`.
- Public demo has no real customer data.
- Auth settings are safe for a demo: `AGORA_DEMO_AUTH=false` and `AGORA_PASSWORDLESS_AUTH=false`.
- Data export and recovery proof are visible without maintainer narration.
- Feature request path creates a triage task and owner notification when email is configured.
- Screenshots and video scripts match the same Acme route sequence.
