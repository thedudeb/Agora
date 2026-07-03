# Demo Workspaces

Agora's hosted demo should let a project manager understand the product before reading setup docs. The repository now includes a reusable demo catalog in [`../demos/workspaces.json`](../demos/workspaces.json) and a link generator for local or hosted deployments.

## Generate Demo Links

For localhost:

```sh
npm run demo:links
```

For a hosted demo:

```sh
npm run demo:links -- --base https://demo.your-domain.example --markdown
```

For one scenario:

```sh
npm run demo:links -- --base https://demo.your-domain.example --demo agency-command-center
```

The same command is available through the CLI:

```sh
npm run agora -- demo links --base https://demo.your-domain.example --markdown
```

## Demo Scenarios

- `agency-command-center`: PM triage for agencies and consultants.
- `scrum-master-room`: sprint planning, burndown, capacity, and release coordination.
- `client-portal-review`: client-safe visibility, approvals, and portal review.
- `open-source-trust-center`: portability, readiness, backups, diagnostics, and release metadata.
- `template-marketplace`: templates, automations, premium metadata, and plugin contracts.

## Hosted Demo Checklist

1. Deploy the static app and API with `AGORA_DEMO_AUTH=false` and `AGORA_PASSWORDLESS_AUTH=false`.
2. Keep the demo workspace seeded and resettable; do not store real customer data.
3. Generate links with `npm run demo:links -- --base <hosted-app-url> --markdown`.
4. Add the generated entry links to the README, launch page, social posts, and support replies.
5. Refresh screenshots after major UI changes with `npm run screenshots`.

The demo should feel like a guided product tour, not a blank account. Link directly into views that prove the wedge: command center, sprint room, client portal, trust center, and template marketplace.
