# Agora Launch Kit

Use this file for public launches, community posts, and repeatable social copy.

## One-Liner

Agora is open source project management without ads, trackers, or lock-in.

## Short Pitch

Agora is a self-hostable project management workspace for teams that want projects, clients, daily planning, approvals, docs, automations, time tracking, and reporting without giving up ownership of their data.

## Longer Pitch

Most project management tools are polished, but closed. Teams end up renting their own operating system, fighting noisy interfaces, and trusting opaque AI features with real client context.

Agora is an open source alternative: a practical workspace for projects, company views, client portals, daily planning, templates, automations, docs, files, time tracking, reports, and API-backed persistence. It is built around portability, auditability, and a simple promise: no ads, no trackers, no lock-in.

## Product Hunt Copy

Name:

> Agora

Tagline:

> Open source project management without ads or lock-in.

Description:

> Agora is a self-hostable project management workspace for teams that want Asana-style clarity while owning their data. Manage projects, clients, daily work, approvals, docs, automations, templates, time tracking, and reports from a portable, auditable workspace with no ads or trackers.

Gallery Captions:

1. `assets/screenshots/agora-landing.png` - Open source project management without ads, trackers, or lock-in.
2. `assets/screenshots/agora-dashboard.png` - A browser-local command center with setup, readiness, and project signals.
3. `assets/screenshots/agora-board.png` - Familiar board workflows for real project delivery.
4. `assets/screenshots/agora-mobile-today.png` - Daily planning that works at mobile width.
5. `assets/screenshots/agora-marketplace.png` - Portable project templates and automation packs built around open JSON.

Maker Comment:

> We built Agora because project management should feel like team infrastructure, not another closed attention marketplace. The current prototype includes boards, lists, calendar, daily planning, client portals, company views, templates, automations, time tracking, reports, API sync, Supabase-ready persistence, and an AI Operator with permissions, previews, audit logs, and undo.
>
> The big promise: no ads, no trackers, no lock-in. You can run it locally, connect the API, export portable bundles, and shape the product in the open.

Launch Checklist:

- Use `assets/screenshots/agora-landing.png` as the cover image.
- Add dashboard, board, mobile Today, and marketplace screenshots to the gallery.
- Link to the GitHub repository and README quick start.
- Mention that Agora is an early prototype, but already runs locally with Node.js and no app dependencies.
- Invite feedback on self-hosting, mobile polish, template packs, and what would make Agora credible for real teams.

## Show HN Draft

Title:

> Show HN: Agora - open source project management without ads or lock-in

Body:

> Hey HN, we are building Agora, an open source project management workspace for teams that want more ownership over their operating layer.
>
> It includes the expected project management pieces: boards, lists, calendar, daily planning, company/client views, approvals, docs/files, time tracking, reports, templates, automations, and notifications.
>
> The opinionated parts are portability and trust:
>
> - no ads or trackers
> - local-first prototype path
> - portable JSON/CSV/Markdown exports
> - optional API persistence
> - Supabase-ready storage/auth
> - AI Operator with permissions, previews, rationale, audit logs, and undo
> - template/automation marketplace primitives built around open JSON
>
> It is still early, but it runs locally with Node and no app dependencies. Feedback on the product direction, self-hosting path, and what would make it viable for real teams would be hugely helpful.

## X / Threads Launch Thread

Suggested attachment order: landing screenshot, dashboard screenshot, board screenshot, mobile Today screenshot, marketplace screenshot.

1. We are building Agora: open source project management without ads, trackers, or lock-in.

2. Most project tools are polished but closed. Your tasks, docs, automations, and client workflows become something you rent.

3. Agora is different: boards, lists, calendar, daily planning, client portals, company views, docs, files, approvals, time tracking, reports, templates, and automations.

4. The promise is simple: your workspace should not be an ad surface.

5. Agora can run locally, connect to an API, use Supabase-backed persistence, and export portable JSON/CSV/Markdown bundles.

6. We are also building AI with receipts: permissions, previews, rationale, audit logs, and undo. Useful, but not mysterious.

7. For agencies and consultants, Agora includes company-scoped access, client portals, approvals, templates, time tracking, and reports.

8. For open source builders, it is inspectable, remixable, and designed around portable data.

9. The project is early, but already usable as a prototype. Clone it, run it, break it, and tell us what would make it real for your team.

10. GitHub: https://github.com/thedudeb/Agora

## Screenshot-First Social Posts

### Landing

Image: `assets/screenshots/agora-landing.png`

> Agora is open source project management without ads, trackers, or lock-in.
>
> The promise is simple: your workspace should organize work, not monetize attention.

### Dashboard

Image: `assets/screenshots/agora-dashboard.png`

> Agora starts as a browser-local project command center: setup, readiness, projects, inbox signals, and daily work in one place.
>
> Connect the API when you need persistence. Export your workspace when you need ownership.

### Board

Image: `assets/screenshots/agora-board.png`

> The basics still matter.
>
> Agora includes familiar project views like boards, lists, calendars, task details, dependencies, comments, and milestones, wrapped in an open source workspace teams can inspect and export.

### Mobile Today

Image: `assets/screenshots/agora-mobile-today.png`

> Daily planning should survive real life.
>
> Agora's Today view gives teams a practical place to plan the next action, even at phone width.

### Marketplace

Image: `assets/screenshots/agora-marketplace.png`

> Project templates and automations should be portable.
>
> Agora's marketplace primitives use open JSON for template packs, automation packs, creator metadata, pricing, and contribution workflows.

## LinkedIn Post

We are building Agora, an open source project management workspace for teams that want clarity without ads, trackers, or lock-in.

The idea is simple: project management is operational infrastructure. Teams should be able to inspect it, self-host it, export from it, and understand what its AI features are doing.

Agora includes boards, lists, calendar, daily planning, company/client views, approvals, docs, files, automations, templates, time tracking, reports, API sync, Supabase-ready persistence, and an AI Operator with permissions, previews, audit logs, and undo.

This is especially useful for agencies, consultants, and multi-client teams that need client visibility without exposing internal noise.

The project is early, open source, and built around a promise we think should be normal: your workspace should not become an ad surface.

## GitHub Release Notes Draft

## Agora early preview

Agora is an open source project management workspace for teams that want self-hostable project clarity without ads or lock-in.

Highlights:

- Project views: dashboard, board, list, calendar, daily planning, My Work.
- Client work: company views, client portals, approvals, docs, files, reports.
- Operations: time tracking, notifications, templates, automations, custom fields, dependencies.
- Trust: portable exports, backups, role permissions, audit log, Supabase-ready API storage.
- AI: Operator permissions, previews, rationale, audit ledger, undo paths.
- Marketplace: project templates and automation packs with portable JSON.

Run locally:

```sh
cp .env.example .env
npm run dev
npm run dev:api
```

## Screenshot Checklist

Refresh the checked-in launch set with:

```sh
npm run screenshots
```

- Landing hero with no ads/no lock-in proof row.
- Dashboard setup and launch readiness.
- Board view with project tasks.
- Today daily planning page.
- Company or client portal view.
- Marketplace hub with template and automation packs.
- Admin > Permissions audit view.
- Data export/portable bundle panel.
- Operator trust panel with permissions and audit language.

## Demo Video Script

Use [`docs/demo-video-script.md`](./demo-video-script.md) for the full time-coded recording plan.

Short flow:

1. Landing: "Agora is open source project management without ads or lock-in."
2. Dashboard: show projects, setup, and launch readiness.
3. Today: show daily planning and focus work.
4. Board/List: show normal project execution.
5. Company/Portal: show scoped client visibility.
6. Marketplace: install or publish a template or automation pack.
7. Data: show portable export.
8. Permissions/Operator: show role guardrails, previews, rationale, audit language, and undo.
9. Close with: "Run it locally, connect the API, export your data, and shape it in the open."

## Boilerplate

Agora is open source project management for teams that want clarity without ads, trackers, or lock-in. It gives teams a self-hostable workspace for projects, clients, daily planning, approvals, docs, automations, templates, time tracking, reports, and auditable AI workflows.
