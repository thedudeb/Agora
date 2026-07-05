# Contributing To Agora

Thanks for helping make Agora a real open source product. The best first contributions are small, testable, and tied to the client-facing project-management wedge: agencies, consultants, self-hosters, and power users who need no ads, no lock-in, portable data, and auditable AI.

## What Helps Most

- Bug reports with clear reproduction steps.
- Product feedback from real project, client, agency, or operations workflows.
- Project templates for specific industries.
- Automation packs for repeatable work.
- Docs improvements, setup notes, screenshots, and demo assets.
- Accessibility and mobile/iPad polish.
- API, Supabase, import/export, and portable bundle test coverage.
- Focused implementation PRs that match the existing dependency-light architecture.

## Start Here

1. Read [`docs/contributor-path.md`](./docs/contributor-path.md).
2. Pick a starter issue lane from [`docs/starter-issues.md`](./docs/starter-issues.md).
3. Run the quick local checks:

```sh
npm run check
npm run demo:check
npm run release:check
```

4. For product-facing changes, include the smallest useful acceptance test or screenshot note.
5. For security, migration, data export, plugin, MCP, or API changes, include rollback and portability notes.

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

Run these before opening most pull requests:

```sh
npm run check
npm run test:fixtures
npm run test:api
```

Use focused gates when your change touches those surfaces:

```sh
npm run demo:check
npm run release:check
npm run test:importers
npm run test:plugins
npm run test:mcp
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

## Contribution Lanes

- Bug fix: reproduce, patch narrowly, add a regression check when practical.
- Docs improvement: make setup, hosting, release, or trust evidence easier to follow.
- Template pack: contribute reusable project workflows that can be represented as portable Agora JSON.
- Automation pack: contribute previewable rules with clear trigger, condition, action, and rollback language.
- Migration fixture: add anonymized competitor exports or importer edge cases.
- Plugin/MCP proposal: use the least-privilege extension contracts and document read/write behavior.

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

## Review Bar

A good PR explains:

- user problem and affected route/docs/script;
- exact verification commands run;
- data ownership, export, auth, permission, or privacy impact;
- rollback behavior for state-changing work;
- screenshots or generated artifacts when UI/launch assets change.

Keep changes scoped. If a PR touches app behavior, release gates, docs, and screenshots all at once, split it unless the story truly needs one atomic change.

## Project Style

- The current app is dependency-light and mostly plain HTML/CSS/JavaScript.
- Prefer readable, explicit code over clever abstraction.
- Keep UI dense enough for operational work and calm enough for repeated use.
- Use stable dimensions for boards, lists, cards, toolbars, and controls to avoid layout shifts.
- Keep marketing claims honest: early prototype, open source, self-hostable path, no ads, no lock-in.

## Code Of Conduct

Be direct, generous, and respectful. Assume good intent, make room for different experience levels, and keep discussion focused on making Agora better.
