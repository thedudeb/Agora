# Agora Demo Video Script

Use this script for a 75 to 120 second launch demo. Keep the pacing calm: the point is to show that Agora is already a real workspace, not to tour every feature.

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
| 0:08-0:20 | `?route=dashboard` | Workspace setup, readiness, and command-center metrics. | "It starts as a browser-local workspace, so teams can try it without a SaaS account, then connect the API when they need shared persistence." |
| 0:20-0:32 | `?route=daily` | Today planning, focus note, and task lanes. | "Daily planning keeps the next actions visible instead of turning work into a noisy feed." |
| 0:32-0:44 | `?route=board` | Board columns with real seeded tasks and metadata. | "The familiar project views are here: boards, lists, calendar, task details, dependencies, comments, and status." |
| 0:44-0:58 | `?route=portal` | Client portal or company-safe status. | "For agencies and consultants, company-scoped portals keep clients informed without exposing internal noise." |
| 0:58-1:10 | `?route=marketplace` | Template and automation marketplace panels. | "Templates and automation packs are portable JSON, so teams can share operating playbooks without a closed store." |
| 1:10-1:24 | `?route=data` | Portable export and backup language. | "The no-lock-in promise is practical: export a portable workspace with JSON, CSV, Markdown, templates, automations, audit, and operator context." |
| 1:24-1:38 | `?route=permissions` | Role matrix and Operator guardrails. | "AI actions are permissioned, previewable, and auditable, with rationale and undo paths where possible." |
| 1:38-1:50 | `?route=operator` | Operator panel, action previews, trust language. | "The Operator helps draft briefs and recovery actions, but the team stays in control." |
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
