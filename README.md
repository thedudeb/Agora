# Agora

Open source project management for teams that want clarity without lock-in.

Agora is a self-hostable project management workspace inspired by tools like Asana and Nifty. It is designed for teams that need projects, tasks, views, collaboration, milestones, and visibility while keeping control of their data and workflow.

## Status

Agora is in early prototype development. The current app is a dependency-free browser prototype with seeded workspace data, local persistence, PWA installability, an offline app shell, mobile task actions, workspace settings, member roles, team invitations, first-owner signup, password login, optional passwordless API sessions, structured records endpoints, data import/export, API snapshot sync, a storage adapter foundation, optional Supabase snapshot and structured record persistence, a dependency-free API scaffold, optional demo auth, API rate limiting, scoped client writes, security headers, a PostgreSQL schema draft, command-center inbox lanes, a dedicated AI Operator page, local AI operator planning, server-side bring-your-own-AI adapters, operator briefs, previewable operator actions, an applied-action log, client/company portals, client approvals, live collaboration presence, task-view awareness, stale edit warnings, workspace pulse, automation recommendations, company portfolios, editable companies, daily task planning, inbox notifications, notification badges and toasts, reporting dashboards, project and task templates, automations, project docs and files, intake forms, custom task fields, task dependencies, Gantt-style timelines, project filters, task creation, subtasks, comments, activity, employee time tracking, list view, board view, calendar view, project workspaces, milestones, project timelines, and a My Work view.

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

The prototype stores changes in browser local storage. Use "Reset sample data" in the sidebar to restore the seeded workspace.

4. Start the API in a second terminal.

```sh
npm run dev:api
```

Then open `http://127.0.0.1:8787/api/health`.

With both processes running, open Settings in the app and create the first owner account, then sign in with email and password. API-connected users can sync the workspace from the Data page. If the API is hosted somewhere other than `http://127.0.0.1:8787`, update the API URL in Settings.

Settings and Data include a Backend Health panel after connecting to the API. It shows the active storage/auth drivers, Supabase production-mode readiness, structured collection status, snapshot metadata, and any failed local syncs waiting to retry.

## Useful Commands

```sh
npm run dev       # serve the browser app
npm run dev:api   # start the local API
npm run check     # syntax-check app and server files
npm run test:api  # run the dependency-free API smoke test
```

To use different local ports, set `AGORA_APP_PORT` or `AGORA_API_PORT` in `.env`. Add browser origins to `AGORA_ALLOWED_ORIGINS` when hosting the app somewhere other than localhost.

Demo auth and passwordless email login are disabled by default. For trusted demos only, set `AGORA_DEMO_AUTH=true` or `AGORA_PASSWORDLESS_AUTH=true` and restart `npm run dev:api`.

## Supabase Storage

Agora works out of the box with local JSON API storage. To use Supabase for API persistence:

1. Create a Supabase project.
2. Run `server/migrations/001_supabase_storage.sql` and `server/migrations/002_supabase_auth_rls.sql` in the Supabase SQL editor.
3. Set these values in `.env`:

```sh
AGORA_STORAGE_DRIVER=supabase
AGORA_AUTH_DRIVER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Restart `npm run dev:api`.

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not paste it into browser settings or client code. `SUPABASE_ANON_KEY` is safe for browser-based Supabase Auth clients, but Agora's API still reads it from the server environment when validating access tokens.

`002_supabase_auth_rls.sql` adds `public.agora_workspace_memberships`, helper functions around `auth.uid()`, and RLS policies for snapshots, audit events, and structured record tables. The API can exchange a Supabase Auth `access_token` through Settings, or accept that token directly as a Bearer token when `AGORA_AUTH_DRIVER=supabase`.

Client invitations can be assigned to a company. Accepted client accounts land in the Portal view and only receive the company-scoped workspace records they are allowed to see.

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
- `assets/` contains brand and interface assets.
- `ROADMAP.md` outlines the release direction.
- `CONTRIBUTING.md` explains how to contribute.
- `.github/ISSUE_TEMPLATE/` contains starter issue templates.

## Name

In ancient Greece, the agora was a public gathering place for discussion, trade, and civic organization. This project uses that idea as a metaphor for a shared place where teams gather around their work.

## License

Agora is licensed under the GNU Affero General Public License v3.0. See `LICENSE` for details.
