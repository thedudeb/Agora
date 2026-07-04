# QA Gate

Use this gate before a beta handoff, release tag, hosted deploy, or large product demo.

## Main Command

```sh
npm run qa
```

This runs:

- syntax checks for app, server, scripts, MCP, and desktop wrapper files;
- dependency audit for the root and desktop package lockfiles;
- admin security regression checks, including hosted strict-CSP health gates;
- portable fixture validation;
- recovery stress tests;
- migration importer tests;
- browser golden-path QA.

The same gate is available to power users through:

```sh
npm run agora -- qa
```

For hosted deploy rehearsal, run:

```sh
npm run rehearse:hosted
```

Use `--quick --skip-audit` for a local dry run when network access or browser QA is not needed.

## CI Gate

GitHub Actions runs the same release QA gate on pushes to `main`, pull requests into `main`, and manual workflow dispatches.

Workflow: `.github/workflows/qa.yml`

The CI job uses Node.js 22 and the runner's installed Chrome/Chromium. If dependency audit or browser QA fails, the workflow fails; browser failures upload `qa-artifacts` with the failing route DOM, metadata, and a screenshot when Chrome can capture one.

## Browser Coverage

`npm run test:golden` starts the local static app and checks:

- app shell, PWA manifest, offline fallback, and security headers;
- dashboard, launch flow, readiness, hosted setup diagnostics, readiness exports, templates, marketplace, Data, Settings, feature request triage, and public feedback routes;
- mobile dashboard and public feedback widths;
- Data recovery, offline app readiness, workspace schema, settings sync, settings security, and feedback intake copy.

The runner accepts `AGORA_GOLDEN_BASE_URL` for hosted smoke tests:

```sh
AGORA_GOLDEN_BASE_URL=https://example.com npm run test:golden
```

For faster route debugging, narrow the browser pass by suite or route text:

```sh
AGORA_GOLDEN_SUITE=workspace npm run test:golden
AGORA_GOLDEN_ONLY="Project command center" npm run test:golden
AGORA_GOLDEN_SUITE=admin AGORA_GOLDEN_ONLY=settings npm run test:golden
```

Useful suites today are `marketing`, `first-run`, `workspace`, `ai`, `release`, `security`, `data`, `admin`, `offline`, `feedback`, and `mobile`. `AGORA_GOLDEN_ONLY` matches the check name, suite, or route as a case-insensitive substring.

Chrome route checks retry once by default when Chrome times out. Tune that with:

```sh
AGORA_GOLDEN_RETRIES=2 AGORA_GOLDEN_TIMEOUT_MS=120000 npm run test:golden
```

Set `AGORA_GOLDEN_ARTIFACT_DIR=qa-artifacts` to write route DOM, failure metadata, Chrome stdout/stderr tails, and screenshots when Chrome can capture one. Timeout failures still write metadata even when no DOM is available.

## Manual Follow-Up

Automation is the gate, not the whole bug bash. After `npm run qa` passes, do one manual pass on:

- real Android Chrome PWA install and airplane-mode launch;
- iPhone-width Safari or WebKit preview;
- desktop wrapper launch with the network disabled;
- one full export, import preview, and restore from a generated portable bundle;
- one feature request submission against a running API with email configured.
