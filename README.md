# Agora

Open source project management for teams that want clarity without lock-in.

Agora is a self-hostable project management workspace inspired by tools like Asana and Nifty. It is designed for teams that need projects, tasks, views, collaboration, milestones, and visibility while keeping control of their data and workflow.

## Status

Agora is in early prototype development. The current app is a dependency-free browser prototype with seeded workspace data, first-run onboarding, guided tutorial mode, launch-readiness guidance, a Cmd/Ctrl+K command palette, keyboard shortcuts, local multi-workspace switching, clean/demo workspace setup, local persistence, local workspace backups, PWA installability, an offline app shell, mobile task actions, customizable workspace themes, command-style search results, saved views with update/rename/pin controls, workspace settings, member roles, a permission matrix, company-scoped access controls, team invitations, invite expiry/resend/revoke controls, first-owner signup, password login, Supabase email/password auth, password reset/change flows, optional passwordless API sessions, API-first company/project/task records, structured records endpoints, data import/export, switcher imports for common competitor CSV/JSON task exports, API snapshot sync, polling-based realtime refresh, a clear Settings split for account, sync, integrations, payments, security, and developer readiness, a storage adapter foundation, optional Supabase snapshot and structured record persistence, authenticated file uploads/downloads, deployment readiness checks, a dependency-free API scaffold, optional demo auth, API rate limiting, scoped client and company writes, security headers, merged local/API audit log UI, a PostgreSQL schema draft, command-center inbox lanes, mention and watched-task notifications, a dedicated AI Operator page, local AI operator planning, server-side bring-your-own-AI adapters, operator briefs, previewable operator actions, an applied-action log, client/company portals, client approvals, live collaboration presence, same-page cursor presence, workspace chat, lightweight whiteboards, task-view awareness, stale edit warnings, workspace pulse, automation recommendations and previews, editable automation rules, company portfolios, objective/goal tracking, editable companies, daily task planning, inbox notifications, notification badges and toasts, configurable reporting dashboards, capacity planning, copyable status reports, a searchable project-template library and installable template marketplace for agency, software, finance, creative, marketing, research, nonprofit, media, and people workflows, a payment-provider foundation with local entitlements, creator-defined template pricing, charity-directed payout metadata, and gated premium template access for future Stripe/manual/x402 use, project and task templates that can be created from live work, automations, project docs and files, intake forms, custom task fields, task dependencies, Gantt-style timelines, project filters, project PM snapshots, task creation, project edit/duplicate actions, subtasks, comments, activity, employee time tracking, list view, board view, calendar view, project workspaces, milestones, project timelines, and a My Work view.

## Quick Start

Agora currently runs without package dependencies. You only need Node.js 18+ and npm.

1. Clone the repo and enter it.

```sh
git clone https://github.com/thedudeb/Agora.git
cd Agora
```

2. Copy the environment template.

```sh
cp .env.example .env
```

The default `.env` uses local JSON storage and serves the app at `http://127.0.0.1:5174`.

3. Start the web app.

```sh
npm run dev
```

Then open `http://127.0.0.1:5174`.

The prototype stores changes in browser local storage. Use the sidebar workspace switcher to create, duplicate, archive, and switch local workspaces. Use the Dashboard setup panel to choose demo data or start with a clean workspace. Use Data to create local workspace backups, download JSON exports, replace the current workspace from JSON, or import JSON as a new workspace. Use "Reset sample data" in the sidebar to restore the seeded workspace.

4. Start the API in a second terminal.

```sh
npm run dev:api
```

Then open `http://127.0.0.1:8787/api/health`.

With both processes running, open Settings in the app and create the first owner account, then sign in with email and password. API-connected users can sync the workspace from the Data page. If the API is hosted somewhere other than `http://127.0.0.1:8787`, update the API URL in Settings.

The Dashboard includes first-run setup and launch-readiness panels, and the app chrome includes a connection banner for the current local/API mode, setup progress, sync queue state, and a guided Tutorial launcher. Press `Cmd+K` or `Ctrl+K` to open the command palette for navigation, creation, backups, API sync, automations, AI operator actions, and search-result jumps. Press `?` for keyboard help, `/` for search, `N` for a new task, `P` for a new project, `B` for a backup, or `G` then `D/T/B/I/S` to jump to Dashboard, Today, Board, Inbox, or Settings. Tutorial mode walks new users through setup, navigation, filters, work views, daily planning, inbox triage, Settings sync, and creating work. Settings separates account sign-in, workspace configuration, sync state, payment-provider planning, security permissions, integrations, and developer readiness. The Integrations tab includes a connected-tools hub for Slack, GitHub, Google Drive, Google Calendar, Zapier, webhooks, API adapters, sync direction, ownership, subscribed event types, adapter health, signing-secret readiness, and auditable test events. The Payments tab stores provider choice, currency, spend caps, feature gates, x402 lab mode, local entitlements, premium-template grants, and a payment audit trail without moving money. When connected to the API, premium-template grants create a server checkout intent and store a server-issued entitlement through the test/manual payment adapter. The Sync tab shows the API source of truth, save/load controls, backend health refresh, and any failed local syncs waiting to retry. Data and Developer settings include the Backend Health panel after connecting to the API.

Workspace Settings include theme presets, density controls, and deployment readiness. Members and Security settings cover company-scoped access, invitations, current session access, and the role permission matrix so self-hosters can tune Agora before inviting a team.

The global toolbar can save filter setups as reusable views, then update, rename, pin, or forget them later. The Dashboard includes named saved layouts plus a widget picker for active projects, goals, capacity, operator signals, due-soon work, and mobile readiness. Data includes a preview-and-apply switcher import assistant for common competitor CSV/JSON exports from tools like Asana, ClickUp, monday, Trello, Jira, and Linear. Collaboration adds API-backed workspace chat channels plus a lightweight whiteboard for notes, decisions, and risks. Goals provide an objective ladder across companies, owners, linked projects, key results, progress, and portfolio health. Templates include built-in starter packs for client onboarding, software launch, finance close, art exhibition, marketing campaigns, and research sprints, with category filters, search, preview details, and a customization step before creating a project. The Templates page also includes a local marketplace for installable community packs, entitlement-gated premium packs, JSON export for unlocked templates, and JSON import for shared templates. Template creators can set price, currency, creator name, payout wallet/chain, charity recipient, and donation split metadata before exporting a template. Templates can also be created from existing projects or tasks and deleted from the Templates page. Automations include a structured workflow builder with trigger, condition, action, and action-target fields, plus preview, pause, delete, and manual run controls. Reports include project health, company comparison, capacity planning, member workload, risk queues, and a copyable Markdown status report from the current company, project, assignee, status, and priority filters.

When connected to the API, Agora loads companies, projects, tasks, chat messages, and whiteboards from API records, adopts server-returned records after writes, polls for workspace and structured-record changes, merges server-canonical records back into the browser, shows live task viewers and same-page cursor presence, generates inbox items for mentions and watched tasks, and warns before saving over a task that changed while its modal was open.

The API also includes a payment-adapter skeleton for marketplace entitlements:

- `GET /api/payments/config` reports the available test, manual, Stripe, and x402 adapters.
- `POST /api/payments/checkout-intent` creates a server-side intent for a premium marketplace item. Stripe and x402 are intentionally stubbed until real server adapters are configured.
- `POST /api/payments/events` accepts test/manual completion events and writes a server-issued entitlement into the workspace snapshot.
- `GET /api/payments/entitlements` returns the server-issued entitlement list for connected clients.

## Useful Commands

```sh
npm run dev       # serve the browser app
npm run dev:api   # start the local API
npm start         # serve the browser app for a host/runtime
npm run start:api # start the API for a host/runtime
npm run check     # syntax-check app and server files
npm run test:api  # run the dependency-free API smoke test
```

To use different local ports, set `AGORA_APP_PORT` or `AGORA_API_PORT` in `.env`. Add browser origins to `AGORA_ALLOWED_ORIGINS` when hosting the app somewhere other than localhost.

Demo auth and passwordless email login are disabled by default. For trusted demos only, set `AGORA_DEMO_AUTH=true` or `AGORA_PASSWORDLESS_AUTH=true` and restart `npm run dev:api`.

For deployment details, Vercel static hosting, Supabase Storage setup, SMTP/webhook password reset delivery, and release checks, see [`docs/deployment.md`](./docs/deployment.md).

## Supabase Storage

Agora works out of the box with local JSON API storage. To use Supabase for API persistence:

1. Create a Supabase project.
2. Run `server/migrations/001_supabase_storage.sql` and `server/migrations/002_supabase_auth_rls.sql` in the Supabase SQL editor.
3. Create a private Supabase Storage bucket named `agora-files`.
4. Set these values in `.env`:

```sh
AGORA_STORAGE_DRIVER=supabase
AGORA_AUTH_DRIVER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AGORA_SUPABASE_STORAGE_BUCKET=agora-files
```

5. Restart `npm run dev:api`.

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not paste it into browser settings or client code. `SUPABASE_ANON_KEY` is safe for browser-based Supabase Auth clients, but Agora's API still reads it from the server environment when validating access tokens.

`002_supabase_auth_rls.sql` adds `public.agora_workspace_memberships`, helper functions around `auth.uid()`, and RLS policies for snapshots, audit events, and structured record tables. The API can sign users up or in with Supabase email/password auth from Settings, exchange a Supabase Auth `access_token`, or accept that token directly as a Bearer token when `AGORA_AUTH_DRIVER=supabase`.

Invitations and memberships can be assigned to a company. Scoped users only receive the company workspace records they are allowed to see, and whole-workspace snapshot saves stay limited to workspace-wide admin sessions.

Use the Backend Health panel, or `GET /api/backend/health` with an authenticated bearer token, to confirm that Supabase storage, Supabase Auth, RLS-backed memberships, workspace snapshots, and structured records are reachable.

## AI Operator

Agora includes a local deterministic operator by default, plus an optional server-side adapter for OpenAI-compatible APIs, Ollama, or a custom endpoint. Provider secrets stay on the API server.

```sh
AGORA_AI_PROVIDER=openai
AGORA_AI_MODEL=gpt-4o-mini
AGORA_AI_BASE_URL=https://api.openai.com/v1
AGORA_AI_API_KEY=your-server-side-key
```

For Ollama:

```sh
AGORA_AI_PROVIDER=ollama
AGORA_AI_MODEL=llama3.1
AGORA_AI_BASE_URL=http://127.0.0.1:11434
```

Restart `npm run dev:api`, connect to the API from Settings, then open Operator to draft workspace and project briefs. Operator can also preview and apply task follow-ups, approval requests, approval chases, Today planning, and client updates while recording each applied action in the workspace log. Keep `AGORA_AI_API_KEY` server-only.

## Product Principles

- Clear enough for non-technical teams.
- Practical enough for day-to-day project work.
- Open enough to self-host, inspect, extend, and contribute to.
- Focused enough to avoid becoming a bloated all-in-one workspace.

## Planned MVP

- Workspaces, members, and roles.
- Projects with list, board, and calendar or timeline views.
- Tasks with assignees, due dates, priorities, comments, attachments, and subtasks.
- Project dashboards for progress, overdue work, milestones, and recent activity.
- Templates for common workflows such as product roadmaps, client delivery, campaigns, and operations.
- Self-hosting documentation, data export, and an initial integration surface.

## Repository Structure

- `prds/` contains product requirements and planning documents.
- `index.html` contains the first browser prototype shell.
- `src/` contains prototype application logic and styles.
- `server/` contains the dependency-free app server, API scaffold, JSON development storage, Supabase migration, and PostgreSQL schema draft.
- `docs/mobile-strategy.md` outlines the PWA-first path toward a dedicated mobile app.
- `templates/` contains marketplace template examples and contribution format notes.
- `assets/` contains brand and interface assets.
- `ROADMAP.md` outlines the release direction.
- `CONTRIBUTING.md` explains how to contribute.
- `.github/ISSUE_TEMPLATE/` contains starter issue templates.

## Name

In ancient Greece, the agora was a public gathering place for discussion, trade, and civic organization. This project uses that idea as a metaphor for a shared place where teams gather around their work.

## License

Agora is licensed under the GNU Affero General Public License v3.0. See `LICENSE` for details.
