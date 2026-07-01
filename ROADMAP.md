# Agora Roadmap

Agora is open source project management without ads, trackers, or lock-in. This roadmap keeps the public direction clear while the prototype moves toward a self-hostable product teams can trust.

## Product North Star

Agora should become a calm, inspectable project command center for teams that need projects, clients, daily planning, approvals, automations, docs, time tracking, reporting, and auditable AI without giving up ownership of their workspace.

## Current Prototype

Agora currently includes:

- Browser app with local persistence and no app dependencies.
- Static app server and dependency-free API scaffold.
- Local JSON storage plus optional Supabase storage/auth.
- First-run onboarding, guided tutorial mode, launch readiness, command palette, keyboard shortcuts, and PWA shell.
- Dashboard, Today, Inbox, Board, List, Calendar, My Work, Time, Reports, Goals, Companies, Client Portal, Docs/Files, Intake, Templates, Automations, Marketplace, Data, Audit, Permissions, Operator, and Settings views.
- Workspace switcher with create, duplicate, archive, and local backups.
- Member invitations, owner signup, password auth, Supabase auth, role permissions, and company-scoped access.
- API-backed workspace snapshots and structured records.
- Portable JSON/CSV/Markdown exports and competitor import helpers.
- Notifications, watched tasks, mentions, inbox signals, scheduler endpoints, and notification history.
- Collaboration primitives: chat, whiteboards, same-page cursor presence, live task viewers, and stale edit warnings.
- AI Operator with local mode, bring-your-own-AI server adapters, permissions, previews, rationale, audit ledger, and undo paths.
- Template and automation marketplace primitives, including API-backed catalog publishing and creator payout metadata.
- Payment-adapter foundation for test/manual/Stripe/x402 marketplace entitlement flows.
- Marketing strategy, launch kit, release checklist, deployment guide, and portable workspace documentation.

## Now

These are the highest-priority areas before a broader public launch.

- Record and publish the demo video using the captured screenshot set, launch kit, and time-coded script.
- Keep screenshot automation current as launch routes and responsive captures change.
- Keep tightening landing-page proof around no ads, self-hosting, portable exports, client work, and auditable AI.
- Keep README scanning sharp with refreshed screenshots, quick feature blocks, and a clear "who this is for" section.
- Keep local setup boring: `cp .env.example .env`, `npm run dev`, `npm run dev:api`, `npm run check`, `npm run test:api`.
- Keep Supabase setup validation current as migrations, Backend Health, and the verifier evolve.
- Add issue templates for bug reports, feature proposals, templates, automations, and docs improvements.
- Expand fixture tests for portable bundles, marketplace packs, and import/export behavior.

## Next

These make Agora more credible for real teams and contributors.

- Improve marketplace flows: preview hosted packs, show trust metadata, and support community contribution review.
- Add richer onboarding for first owner setup, Supabase connection, and first project creation.
- Build contributor-friendly starter issues for templates, automations, integrations, docs, accessibility, and mobile polish.
- Add a public comparison page or doc for Asana, Nifty, ClickUp, monday, Notion, Linear, and open source alternatives.
- Expand screenshot automation to cover portal, data export, permissions, Operator, and tablet views.
- Strengthen API persistence around conflict handling, record-level sync, and migration safety.
- Expand accessibility verification across keyboard-only use, focus states, color contrast, reduced motion, and screen reader landmarks.
- Improve mobile and tablet flows for Today, Board, Inbox, Marketplace, and Settings.
- Validate the optional Electron desktop shell on macOS and Windows with signed release requirements documented.

## Later

These are larger bets after the core self-hosted path is stable.

- Native mobile apps or a deeper mobile wrapper around the PWA.
- Signed Windows and macOS desktop release pipeline with auto-update strategy.
- Integration adapters for Slack, GitHub, Google Drive, Google Calendar, Zapier, and custom webhooks.
- Plugin or extension strategy for self-hosters.
- Theme marketplace/export support.
- Advanced automations with condition builders, logs, retries, and approval gates.
- More complete resource planning, forecasting, billing, and retainer workflows.
- Real Stripe and x402 payment adapters with webhook verification.
- Hosted cloud option, only if the community and maintainers decide it fits the project.

## Contribution Lanes

Good places to help:

- Project templates for specific industries.
- Automation packs for common workflows.
- Docs and launch assets.
- Accessibility audits and fixes.
- Mobile/iPad layout polish.
- API smoke tests and portable fixture coverage.
- Supabase setup verification and deployment recipes.
- Integrations and import/export adapters.

## Release Principles

- No ads, no trackers, no attention marketplace.
- Keep data portable and exportable.
- Keep secrets server-only.
- Prefer practical workflows over sprawling configuration.
- Keep AI actions permissioned, previewable, auditable, and reversible where possible.
- Document tradeoffs when the product makes an opinionated choice.
