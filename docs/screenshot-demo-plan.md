# Screenshot And Demo Plan

Use this plan to create consistent launch assets for GitHub, Product Hunt, social posts, and the landing page.

## Goals

- Show the product is real in the first five seconds.
- Prove the core promise: no ads, no lock-in, self-hostable, portable, auditable.
- Show workflows for agencies, consultants, open source teams, and privacy-conscious operators.
- Keep screenshots repeatable so new releases can refresh the same asset set.

## Capture Setup

- Start the app with `npm run dev`.
- Start the API with `npm run dev:api` when capturing sync, marketplace, permissions, or backend health.
- Use the seeded Acme Studio workspace unless a specific clean workspace is needed.
- Use a desktop viewport around `1440 x 1000`.
- Also capture mobile widths around `390 x 844` and tablet widths around `834 x 1194`.
- Hide browser chrome if creating marketing screenshots.
- Keep the sidebar visible for desktop captures unless the screen is about mobile navigation.

## Required Screenshots

### 1. Landing Hero

Purpose: public first impression.

Route: `#landing`

Show:

- Agora brand.
- No ads / self-hostable / portable exports / auditable AI proof row.
- Hero background and primary CTA.

Use for:

- README top image.
- Product Hunt gallery.
- Social launch thread.

### 2. Dashboard

Purpose: prove the app is an operational command center.

Route: `#dashboard`

Show:

- Setup or launch readiness.
- Active project metrics.
- Operator or due-soon widgets.
- Connection/readiness signals if API is connected.

Use for:

- README feature overview.
- Demo video opening after landing.

### 3. Today

Purpose: show daily planning and practical work focus.

Route: `#daily`

Show:

- Planned tasks.
- Focus blocks or daily lanes.
- Clear next actions.

Use for:

- Social post about daily work.
- Mobile screenshot.

### 4. Board

Purpose: show familiar project management.

Route: `#board`

Show:

- Multiple columns.
- Realistic tasks.
- Priority/status/assignee metadata.

Use for:

- Product Hunt gallery.
- README "project views" section.

### 5. Client Portal

Purpose: show multi-company/client-ready workflow.

Route: `#portal`

Show:

- Client-safe updates.
- Approvals or shared project status.
- Scoped stakeholder visibility.

Use for:

- Agency and consultant positioning.

### 6. Marketplace

Purpose: show templates, automations, and extensibility.

Route: `#marketplace`

Show:

- Project template marketplace.
- Automation packs.
- API catalog publish/load panel if connected.
- Creator/pricing/charity payout metadata where visible.

Use for:

- Open marketplace story.
- Template contributor call.

### 7. Data Export

Purpose: prove portability.

Route: `#data`

Show:

- Portable workspace export.
- Backup or import preview panel.
- JSON/CSV/Markdown language.

Use for:

- No lock-in messaging.
- Self-hosting docs.

### 8. Permissions Audit

Purpose: prove trust and governance.

Route: `#permissions`

Show:

- Role matrix.
- Member scopes.
- Operator guardrails.
- Import/admin risk flags.

Use for:

- AI with receipts messaging.
- Security/trust posts.

### 9. Operator

Purpose: show AI without mystery.

Route: `#operator`

Show:

- Operator permissions/trust panel.
- Previewable actions.
- Rationale or audit language.

Use for:

- AI governance post.
- Demo clip.

### 10. Mobile Navigation

Purpose: show iPhone/iPad care.

Routes: `#dashboard`, `#today`, `#marketplace`

Show:

- Responsive sidebar/top navigation.
- No overlapping text.
- Main workflows usable without desktop width.

Use for:

- Mobile strategy updates.
- README trust signal.

## Demo Video Flow

Target length: 75 to 120 seconds.

1. Landing: "Agora is open source project management without ads or lock-in."
2. Dashboard: show command center and launch readiness.
3. Today: plan the day.
4. Board/List: move normal project work.
5. Client Portal: show stakeholder-safe visibility.
6. Marketplace: install or publish a pack.
7. Data: export a portable workspace bundle.
8. Permissions: show roles and Operator guardrails.
9. Close: "Run it locally, connect the API, export your data, and shape it in the open."

## File Naming

Use predictable names:

- `assets/screenshots/landing-hero-desktop.png`
- `assets/screenshots/dashboard-desktop.png`
- `assets/screenshots/today-mobile.png`
- `assets/screenshots/board-desktop.png`
- `assets/screenshots/client-portal-desktop.png`
- `assets/screenshots/marketplace-desktop.png`
- `assets/screenshots/data-export-desktop.png`
- `assets/screenshots/permissions-audit-desktop.png`
- `assets/screenshots/operator-trust-desktop.png`
- `assets/screenshots/ipad-dashboard.png`

## Quality Checklist

- Text is legible at social preview sizes.
- No private tokens, service-role keys, emails, or local paths are visible.
- No browser extension UI appears.
- No modals block the main product story unless the modal is the subject.
- Sidebar and topbar do not overlap content.
- Mobile captures show usable controls, not just squeezed desktop UI.
- The screenshot supports one clear claim.
