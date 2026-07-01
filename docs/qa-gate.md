# QA Gate

Use this gate before a beta handoff, release tag, hosted deploy, or large product demo.

## Main Command

```sh
npm run qa
```

This runs:

- syntax checks for app, server, scripts, MCP, and desktop wrapper files;
- portable fixture validation;
- recovery stress tests;
- migration importer tests;
- browser golden-path QA.

The same gate is available to power users through:

```sh
npm run agora -- qa
```

## CI Gate

GitHub Actions runs the same release QA gate on pushes to `main`, pull requests into `main`, and manual workflow dispatches.

Workflow: `.github/workflows/qa.yml`

The CI job uses Node.js 20 and the runner's installed Chrome/Chromium. If browser QA fails, the workflow uploads `qa-artifacts` with the failing route DOM, metadata, and a screenshot when Chrome can capture one.

## Browser Coverage

`npm run test:golden` starts the local static app and checks:

- app shell, PWA manifest, offline fallback, and security headers;
- dashboard, launch flow, readiness, templates, marketplace, Data, Settings, feature request triage, and public feedback routes;
- mobile dashboard and public feedback widths;
- Data recovery, offline app readiness, workspace schema, settings sync, settings security, and feedback intake copy.

The runner accepts `AGORA_GOLDEN_BASE_URL` for hosted smoke tests:

```sh
AGORA_GOLDEN_BASE_URL=https://example.com npm run test:golden
```

## Manual Follow-Up

Automation is the gate, not the whole bug bash. After `npm run qa` passes, do one manual pass on:

- real Android Chrome PWA install and airplane-mode launch;
- iPhone-width Safari or WebKit preview;
- desktop wrapper launch with the network disabled;
- one full export, import preview, and restore from a generated portable bundle;
- one feature request submission against a running API with email configured.
