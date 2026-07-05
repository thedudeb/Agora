# Starter Issues

Use these as ready-to-copy issue seeds for contributors. Keep each issue small enough to finish in one PR.

## Docs

### Clarify One Install Path

Labels: `good first issue`, `starter:docs`, `release`, `P2`

Acceptance:

- Pick one install path from [`install.md`](./install.md).
- Confirm each command still matches `package.json`.
- Add one troubleshooting note for the most likely failure.
- Run `npm run release:check`.

### Add A Hosted Demo FAQ

Labels: `good first issue`, `starter:docs`, `demo`, `P2`

Acceptance:

- Add three common questions to [`hosted-demo-runbook.md`](./hosted-demo-runbook.md).
- Include data hygiene, reset cadence, and generated links.
- Run `npm run demo:check`.

## UI Polish

### Mobile Route Scan

Labels: `help wanted`, `starter:ui-polish`, `offline`, `P2`

Acceptance:

- Inspect Dashboard, Today, Data, and Marketplace around `390 x 844`.
- Fix one overlap, cropped button, or unclear empty state.
- Run `npm run check`.
- Include before/after screenshots or route notes.

### Acme Screenshot Polish

Labels: `good first issue`, `starter:ui-polish`, `demo`, `P2`

Acceptance:

- Run `npm run screenshots`.
- Pick one generated Acme screenshot and improve the visible first viewport.
- Keep the screenshot assertion in `scripts/capture-screenshots.js` passing.

## Fixtures

### Add An Anonymized Import Fixture

Labels: `help wanted`, `starter:fixture`, `migration`, `P2`

Acceptance:

- Add a tiny anonymized export fixture for Asana, Trello, Jira, Linear, ClickUp, CSV, or JSON.
- Document expected mapped fields.
- Include skipped/unsupported field expectations.
- Run `npm run test:importers`.

### Add A Template Pack Fixture

Labels: `good first issue`, `starter:fixture`, `template`, `P2`

Acceptance:

- Add or update one reusable template pack for a real workflow.
- Keep it portable JSON with no external secrets.
- Document generated tasks, milestones, roles, and report shape.

## Trust And Release

### Improve One Evidence Matrix Row

Labels: `good first issue`, `trust`, `release`, `P2`

Acceptance:

- Pick one claim in [`trust-evidence-matrix.md`](./trust-evidence-matrix.md).
- Add the exact command or file that proves it.
- Run `npm run trust` if the evidence command changed.

### Fill A Release Candidate Evidence Item

Labels: `help wanted`, `release`, `P1`

Acceptance:

- Pick one pending row in [`release-candidate-v0.1-beta.md`](./release-candidate-v0.1-beta.md).
- Run the command or manual proof on the target commit/platform.
- Paste concise evidence and note remaining risk.

## Plugin And MCP

### Add A Read-Only MCP Example

Labels: `help wanted`, `mcp`, `plugin`, `P2`

Acceptance:

- Add one read-only MCP example or docs snippet.
- Keep write behavior explicitly opt-in.
- Run `npm run test:mcp`.

### Improve Plugin Manifest Example

Labels: `good first issue`, `plugin`, `template`, `automation`, `P2`

Acceptance:

- Add one realistic command/view/importer/template/automation example to the local plugin docs or fixture.
- Explain least-privilege scope.
- Run `npm run test:plugins`.
