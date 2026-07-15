# Checks Index

Use this page to choose the smallest check that proves the thing you changed. `npm run check` is the default local gate before a pull request; the focused checks below are for faster iteration.

## Most Common

| Goal | Command | Use When |
| --- | --- | --- |
| Full local confidence | `npm run check` | Before pushing most code or docs that mention scripts. |
| Browser product sweep | `npm run test:golden` | Before pushing user-facing route, interaction, or layout changes. |
| Release handoff | `npm run qa` | Before beta handoff, release tag, hosted deploy, or large demo. |
| Security posture | `npm run security` | Before auth, permissions, session, CSP, API, or dependency-sensitive changes. |
| Fast CLI verification | `npm run verify:quick` | When browser QA is not needed and you want a compact local signal. |
| Production upgrade readiness | `npm run verify:upgrade` | Before migrations, production deploys, or restoring from server backups. |

## Frontend Architecture

| Goal | Command | Use When |
| --- | --- | --- |
| Module order and route wrappers | `npm run test:modules` | Changing `index.html`, `sw.js`, route wrappers, or split frontend modules. |
| Frontend size budgets | `npm run test:budgets` | Adding route code, large markup, or new cached frontend assets. |
| Check discoverability | `npm run test:check-discoverability` | Changing README, contributing docs, QA docs, or this checks index. |
| Product surface contracts | `npm run test:product-surfaces` | Moving route rendering or proof surfaces between modules. |
| Board command behavior | `npm run test:board-commands` | Changing board filters, empty states, or command handling. |
| Project/board render quality | `npm run test:project-board-quality` | Changing `src/app-project-board.js` render context, Gantt, or board derivations. |
| Accessibility guardrails | `npm run test:a11y` | Changing UI copy, buttons, dialogs, navigation, or keyboard-visible surfaces. |

See [`docs/architecture.md`](./architecture.md) for module ownership and split-route rules.

## Browser Golden Paths

| Goal | Command | Use When |
| --- | --- | --- |
| Full browser route sweep | `npm run test:golden` | User-facing app changes. |
| Inbox route | `npm run test:golden:inbox` | Inbox queue, clear-day mode, or inbox rendering. |
| Recovery route | `npm run test:golden:recovery` | Data, backups, import preview, or recovery proof changes. |
| Board route | `npm run test:golden:board` | Kanban board, board controls, or board empty states. |
| Project route | `npm run test:golden:project` | Project overview, Gantt, timeline, project command center. |
| Mobile routes | `npm run test:golden:mobile` | Mobile layout, PWA, or native offline planning changes. |
| Readiness routes | `npm run test:golden:readiness` | Production readiness or offline readiness changes. |

For route filtering, retries, hosted smoke tests, and artifacts, see [`docs/qa-gate.md`](./qa-gate.md).

## Data, Migration, And Recovery

| Goal | Command | Use When |
| --- | --- | --- |
| Portable fixtures | `npm run test:fixtures` | Changing portable bundle schemas, fixtures, or automation pack fixtures. |
| Backup and import stress | `npm run test:recovery` | Changing backup, restore, portable import, or disaster recovery behavior. |
| Recovery drill | `npm run drill:recovery -- --fixture` | Proving restore mechanics in isolation. |
| Importers | `npm run test:importers` | Changing migration adapters, concierge output, or importer fixtures. |
| Migration concierge | `npm run migrate:concierge -- <file> --source <source> --workspace <workspace.json>` | Previewing a real third-party export before applying it. |

## API, Hosting, And Production

| Goal | Command | Use When |
| --- | --- | --- |
| API smoke test | `npm run test:api` | Changing API routes, storage, auth, sync, or server contracts. |
| Supabase verification | `npm run test:supabase` | Changing Supabase setup, migrations, storage/auth, or deployment docs. |
| Hosted environment | `npm run verify:hosted` | Checking hosted environment variables and readiness. |
| Hosted rehearsal | `npm run rehearse:hosted` | Rehearsing hosted deployment before public testing. |
| Production verification | `npm run verify:production` | Verifying hosted env, deployment rehearsal, and upgrade safety together. |

## Release, Trust, And Distribution

| Goal | Command | Use When |
| --- | --- | --- |
| Release candidate | `npm run release:check` | Before release-candidate handoff. |
| Release evidence | `npm run release:evidence` | Collecting local release gate outputs into `release/evidence`. |
| Distribution matrix | `npm run distribution:check` | Validating per-channel release evidence. |
| Distribution evidence | `npm run distribution:evidence -- --release <release>` | Generating per-channel proof bundles. |
| Packaging manifest | `npm run package:check` | Changing packaging channels, install docs, or release manifest. |
| Trust Center report | `npm run trust` | Changing trust posture, privacy, security docs, portability, or AI/data policy. |

## Extension And Power-User Surfaces

| Goal | Command | Use When |
| --- | --- | --- |
| Plugin manifests | `npm run test:plugins` | Changing plugin contracts, examples, or marketplace extension docs. |
| MCP server | `npm run test:mcp` | Changing MCP tools, resources, or API bridge behavior. |
| Ecosystem registry | `npm run ecosystem` | Changing plugins, MCP, connectors, templates, automations, or marketplace artifacts. |
| CLI wrapper | `npm run agora -- verify` | Running power-user verification through the CLI surface. |
