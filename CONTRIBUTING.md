# Contributing to Agora

Thanks for helping shape Agora. The project is early, but the direction is clear: open source project management without ads, trackers, or lock-in.

## What Helps Most

- Bug reports with clear reproduction steps.
- Product feedback from real project, client, agency, or operations workflows.
- Project templates for specific industries.
- Automation packs for repeatable work.
- Docs improvements, setup notes, screenshots, and demo assets.
- Accessibility and mobile/iPad polish.
- API, Supabase, import/export, and portable bundle test coverage.
- Focused implementation PRs that match the existing dependency-light architecture.

## Local Setup

Agora currently runs without installing app dependencies.

```sh
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:5174`.

For API-backed workflows, run a second terminal:

```sh
npm run dev:api
```

Open `http://127.0.0.1:8787/api/health`, then connect from Settings in the app.

## Checks Before A PR

Run these before opening a pull request:

```sh
npm run check
npm run test:fixtures
npm run test:api
```

Run `npm run test:supabase` when you change Supabase migrations, storage/auth behavior, file uploads, or deployment docs that affect Supabase setup.

## Contribution Principles

- Keep the product approachable for non-technical teams.
- Protect self-hosting, data ownership, and exportability.
- Avoid adding ads, trackers, or behavioral data assumptions.
- Prefer focused workflows over broad all-in-one workspace sprawl.
- Keep AI features permissioned, previewable, auditable, and reversible where possible.
- Use existing app patterns before introducing new abstractions.
- Update docs when behavior, setup, routes, or public positioning changes.

## Good First Issues

These are good starter lanes for contributors:

- Add a project template for a real workflow, such as nonprofit campaigns, podcast production, construction punch lists, course launches, research labs, finance closes, or art exhibitions.
- Add an automation pack for recurring client updates, overdue approvals, meeting follow-ups, release readiness, or weekly reporting.
- Improve docs around Supabase setup, API sync, portable exports, or marketplace packs.
- Capture screenshots listed in `docs/screenshot-demo-plan.md`.
- Audit a route for keyboard navigation and focus states.
- Polish a mobile layout for iPhone and iPad widths.
- Add fixture coverage for portable workspace bundles or automation pack imports.
- Improve empty states with clearer next actions.

## Opening Issues

Helpful issues include:

- What you expected.
- What happened.
- Browser, OS, and whether the API was connected.
- Steps to reproduce.
- Screenshots or screen recordings when visual behavior matters.
- Any relevant terminal output.

For feature proposals, include:

- The user or team role.
- The workflow pain.
- The smallest useful version.
- How the feature should preserve portability, self-hosting, and auditability.

## Pull Request Checklist

- Keep the change focused.
- Explain the user-facing behavior.
- Include screenshots for visual changes.
- Run the relevant checks.
- Update README/docs when public behavior changes.
- Avoid unrelated refactors.
- Do not commit secrets, `.env`, local database files, or generated screenshots unless they belong in an intentional asset folder.

## Project Style

- The current app is dependency-light and mostly plain HTML/CSS/JavaScript.
- Prefer readable, explicit code over clever abstraction.
- Keep UI dense enough for operational work and calm enough for repeated use.
- Use stable dimensions for boards, lists, cards, toolbars, and controls to avoid layout shifts.
- Keep marketing claims honest: early prototype, open source, self-hostable path, no ads, no lock-in.

## Code Of Conduct

Be direct, generous, and respectful. Assume good intent, make room for different experience levels, and keep discussion focused on making Agora better.
