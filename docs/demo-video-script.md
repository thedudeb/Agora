# Agora Demo Video Script

Use this script for a 75 to 120 second launch demo. Keep the pacing calm: the point is to show that Agora is already a real workspace, not to tour every feature. The default story is Acme Studio taking one client request from intake to recovery proof.

## Recording Setup

- Run the app with `npm run dev`.
- Use the seeded Acme Studio workspace.
- Start at `http://127.0.0.1:5174/?route=landing`.
- Record desktop at roughly `1440 x 1000`.
- Keep the sidebar visible after entering the app.
- Avoid typing secrets, emails, local paths, or service-role keys.
- If recording mobile, use `390 x 844` and capture Today after the desktop pass.

## Core Voiceover

Agora is open source project management without ads, trackers, or lock-in.

It is built for teams that need a practical command center for projects, clients, daily work, approvals, docs, automations, time tracking, reports, and AI help without giving up ownership of the workspace.

## Run Of Show

| Time | Route | What To Show | Voiceover |
| --- | --- | --- | --- |
| 0:00-0:08 | `?route=landing` | Landing hero and proof row. | "This is Agora: open source project management without ads, trackers, or lock-in." |
| 0:08-0:22 | `?route=command-center&demoAction=sampleAgencyWorkspace` | New client request, blockers, promises, and next best actions. | "Here is the PM morning view: one client request, the promises at risk, and the next actions to keep delivery moving." |
| 0:22-0:36 | `?route=project-backlog` | Scope request into active work. | "Agora keeps future work visible before it becomes a project, then lets the team promote scoped work deliberately." |
| 0:36-0:52 | `?route=portal` and `?route=visibility` | Client portal, approval packet, and visibility warnings. | "For agencies and consultants, client-safe portals and visibility review keep approvals moving without exposing internal noise." |
| 0:52-1:08 | `?route=gantt` | Timeline, dependency risk, and delivery pressure. | "Timeline and Gantt views show the delivery risk behind the board so a PM can act before a date slips." |
| 1:08-1:24 | `?route=reports` | Copyable client update. | "When the client asks where things stand, reports turn project state into a useful update instead of another manual status scramble." |
| 1:24-1:38 | `?route=data` | Portable export and backup language. | "The no-lock-in promise is practical: export a portable workspace with JSON, CSV, Markdown, templates, automations, audit, and operator context." |
| 1:38-1:50 | `?route=permissions` | Role matrix and Operator guardrails. | "AI actions are permissioned, previewable, and auditable, with rationale and undo paths where possible." |
| 1:50-2:00 | `?route=landing` or GitHub repo | Closing CTA. | "Run it locally, connect the API, export your data, and shape Agora in the open." |

## Short Cutdown

Use this 35 to 45 second version for social clips:

1. Landing: no ads, self-hostable, portable exports, auditable AI.
2. Dashboard: setup and launch readiness.
3. Today: daily planning.
4. Board: real project work.
5. Marketplace: templates and automations.
6. Data or Permissions: portability or AI governance.
7. Close on GitHub.

## Screenshot Pairings

- `assets/screenshots/agora-landing.png`: opening frame, Product Hunt gallery cover, social first image.
- `assets/screenshots/agora-dashboard.png`: README and demo proof that the app is real.
- `assets/screenshots/agora-mobile-today.png`: mobile planning proof.
- `assets/screenshots/agora-board.png`: familiar project management proof.
- `assets/screenshots/agora-inbox.png`: command-center and notification proof.
- `assets/screenshots/agora-marketplace.png`: templates, automations, and open marketplace proof.

## Editing Notes

- Use captions for the four product promises: No ads, Self-hostable, Portable exports, Auditable AI.
- Keep transitions simple and fast.
- Prefer real UI labels over marketing overlays.
- End with the GitHub URL and local setup commands:

```sh
cp .env.example .env
npm run dev
npm run dev:api
```
