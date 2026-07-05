# Hosted Demo Deployment

Use this when creating the public Agora demo URL. The demo must be safe to share, resettable, and aligned with the Acme client-launch story.

## Target Shape

- Static app URL: `https://demo.your-domain.example`
- Optional API URL: same origin or a clearly paired API host
- Workspace: seeded Acme Studio demo data only
- Primary story: [`acme-client-launch-demo.md`](./acme-client-launch-demo.md)
- Operating runbook: [`hosted-demo-runbook.md`](./hosted-demo-runbook.md)

Do not use a real customer workspace as the public demo.

## Required Environment

Set these on the hosted app/API environment:

```sh
AGORA_PUBLIC_APP_URL=https://demo.your-domain.example
AGORA_ALLOWED_ORIGINS=https://demo.your-domain.example
AGORA_ALLOW_LOCALHOST_ORIGINS=false
AGORA_STRICT_CSP=true
AGORA_DEMO_AUTH=false
AGORA_PASSWORDLESS_AUTH=false
AGORA_PUBLIC_FEATURE_REQUESTS=false
```

If the demo includes API-backed feedback, also configure:

```sh
AGORA_FEATURE_REQUEST_EMAIL=maintainer@example.com
AGORA_EMAIL_FROM=Agora Demo <demo@example.com>
AGORA_PUBLIC_FEATURE_RATE_LIMIT_ATTEMPTS=10
AGORA_PUBLIC_FEATURE_EMAIL_RATE_LIMIT_ATTEMPTS=3
AGORA_PUBLIC_FEATURE_BODY_LIMIT_BYTES=32768
```

Keep production secrets out of the demo. Use demo-only SMTP/webhook credentials, demo-only Supabase projects, and demo-only backup locations.

## Deploy Sequence

1. Deploy the static app and optional API using the same commit as the release candidate.
2. Confirm `/api/health` if the API is deployed.
3. Open the app and reset sample data.
4. Generate the hosted Acme links:

   ```sh
   npm run demo:links -- --base https://demo.your-domain.example --demo acme-client-launch --markdown
   ```

5. Run the hosted smoke check:

   ```sh
   npm run demo:hosted:check -- --base https://demo.your-domain.example
   ```

6. Run hosted browser QA when Chrome is available:

   ```sh
   npm run demo:hosted:check -- --base https://demo.your-domain.example --golden
   ```

7. Paste the URL, generated links, smoke output, and reset proof into [`release-candidate-v0.1-beta.md`](./release-candidate-v0.1-beta.md).

## Reset Proof

Before publishing, record:

- demo URL;
- commit SHA;
- reset timestamp;
- who reset it;
- whether API sync is enabled;
- whether public feedback is enabled;
- portable bundle or server backup location if API-backed;
- screenshot or note confirming no real customer data is visible.

## Acceptance Checks

- `npm run demo:hosted:check -- --base <demo-url>` passes.
- `npm run demo:hosted:check -- --base <demo-url> --golden` passes before broad sharing.
- Acme links open command center, project backlog, client visibility, timeline, reports, and recovery proof.
- Public feedback is disabled or rate-limited and routed to the maintainer inbox.
- Feature request taskboard works if public feedback is enabled.
- The demo can be reset without touching production data.

## Failure Handling

- If the smoke check fails on generated links, fix `demos/workspaces.json` or `scripts/demo-links.js`.
- If live route checks fail, roll back the hosted deployment or redeploy the previous known-good commit.
- If personal data appears, take the demo offline, reset seeded data, rotate demo-only secrets, and capture an incident note in the release candidate.
- If public feedback is abused, disable `AGORA_PUBLIC_FEATURE_REQUESTS` and lower rate limits before reopening it.
