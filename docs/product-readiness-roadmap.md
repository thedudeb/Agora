# Agora Product Readiness Roadmap

This is the working product-management checklist for turning Agora from a powerful prototype into a product real teams can confidently adopt.

## Product Wedge

Agora should first be unmistakably excellent for agencies and consultants running client-facing project work. That wedge fits the strongest parts of the product today: client portals, approvals, time, reusable templates, audits, offline/local-first control, imports, and AI actions with previews and undo.

The broader promise stays intact: open source project management without ads, trackers, or lock-in. The near-term product focus should make the first user feel, "This was built for the way my team delivers client work."

## Working Sequence

| Step | Status | Outcome | Acceptance Criteria |
| --- | --- | --- | --- |
| 1. Crystal-clear primary persona | Complete | A visitor, new user, and contributor can explain who Agora is best for in one sentence. | README, roadmap, demo copy, and first-run setup all name the agency/consultant client-work wedge without excluding open source teams. |
| 2. Ruthless first-run experience | Complete | A new workspace reaches "I can run a real project here" in under 10 minutes. | First-run asks preferred project-management style, recommends a starter setup, creates/imports a project, and shows a visible completion path. |
| 3. Production hosted path | Complete | A self-hoster can deploy and verify Agora without hand-holding. | Install, deployment, health checks, backups, upgrade checks, and env validation form one boring, repeatable path. |
| 4. Real collaboration confidence | Complete | Teams trust multi-person work instead of treating Agora as a solo local app. | Presence, stale edit warnings, comments/chat, notifications, permissions, and audit logs have clear user-facing states and failure handling. |
| 5. Opinionated workflows | Complete | Agora ships useful operating systems, not just flexible primitives. | Agency retainer, client onboarding, scrum delivery, and solo founder presets produce boards, timelines, reports, templates, automations, and dashboards. |
| 6. Polished migration story | In progress | A team can bring real work from competitors safely. | Import concierge previews mappings, warnings, rollback, skipped data, and clean next steps for Asana, Trello, Jira, Linear, ClickUp, and generic CSV/JSON. |
| 7. Trust center and proof | Planned | Buyers and self-hosters can verify security, privacy, portability, and AI behavior. | Trust Center links to evidence reports, security audits, export guarantees, AI policy, backup drills, and dependency/runtime checks. |
| 8. Real packaging and distribution | Planned | Users can install Agora where they work. | PWA, desktop, Docker, hosted deploy, MCP, and CLI paths have clear release checks, version metadata, and upgrade guidance. |
| 9. Focused demo dataset and story | Planned | The demo shows one memorable real workflow instead of a feature inventory. | Demo links, screenshots, sample data, and video script follow the same agency/client delivery scenario from intake to approval to report. |
| 10. Sustainable contributor path | Planned | Open source contributors know where to help without becoming maintainers first. | Issue templates, starter issues, extension contracts, fixture examples, contribution lanes, and review criteria are easy to find. |

## Step 1: Primary Persona

Primary wedge: client-facing project management for agencies and consultants who need local-first control.

Positioning sentence:

> Agora is an open source, local-first project command center for agencies and consultants running client work with approvals, portals, reusable workflows, auditable AI, and portable data.

Keep these secondary audiences visible but subordinate:

- Privacy-conscious teams that want project management without ads, trackers, or export lock-in.
- Open source maintainers who want inspectable workflows, portable data, and contribution-friendly automation.
- Power users who want CLI, MCP, local-first sync, backups, imports, and self-hosted control.

Immediate work:

- Done: make the README lead with the primary wedge.
- Done: make the public roadmap point to this product-readiness checklist.
- Done: make first-run/tutorial copy ask users to shape Agora around their working style, starting with agency/client delivery.

## Step 2: First-Run Experience

The first run should behave like a setup assistant, not a product tour.

Recommended preference choices:

- Agency/client delivery
- Scrum/software team
- Solo founder/operator
- Internal operations
- Blank/custom workspace

Each choice should set:

- Starter projects and templates
- Default dashboard layout
- Board columns and card fields
- Suggested automations
- Suggested reports
- Client/privacy defaults
- First success checklist

Current product state:

- Done: the First run panel asks for a project-management style.
- Done: the onboarding wizard counts project style as a setup step.
- Done: choosing a style can route the user to the right first workspace surface.
- Done: each preference applies workspace defaults, including dashboard layout, board fields, saved views, suggested automations, route, sprint/timeline settings, and client/privacy defaults where relevant.

## Step 3: Production Hosted Path

The hosted path should be boring on purpose.

Key product surfaces:

- `docs/install.md`
- `docs/deployment.md`
- `docs/hosted-launch-runbook.md`
- `docs/upgrade-checklist.md`
- `docs/disaster-recovery-drill.md`
- Readiness page
- Backend Health
- CLI verification commands

Acceptance test: a new self-hoster can deploy, create the first owner, verify backups, run health checks, upgrade safely, and export evidence without reading source code.

Current product state:

- Done: `npm run verify:production` gives self-hosters one hosted gate for env verification, deploy rehearsal, upgrade safety, and optional launch bundle readiness.
- Done: README, install docs, deployment docs, and hosted launch runbook point to the single production verification path.
- Done: the Readiness CLI panel shows the production verification command and quick rehearsal variant.

## Step 4: Collaboration Confidence

Collaboration must show state, ownership, and failure modes clearly.

Needed polish:

- Presence and cursor states that explain who is active and where.
- Stale edit handling that makes conflict risk understandable.
- Comment/chat decisions that can become durable tasks, risks, or decisions.
- Notification controls that prevent noise.
- Permission explanations near sensitive client/company actions.
- Offline/API sync conflict states that a PM can resolve.

Current product state:

- Done: the Collaboration hub includes a collaboration confidence panel for live transport, soft edit locks, sync conflicts, notification delivery, permission risk, audit trail, and active collaborators.
- Done: the panel links directly to Sync, Notifications, Permissions, and Audit so PMs can resolve weak spots from one place.

## Step 5: Opinionated Workflows

Agora should ship a few excellent operating systems before it tries to be everything.

Priority workflow packs:

- Done: Agency retainer OS
- Done: Client onboarding and delivery
- Done: Scrum sprint command center
- Done: Founder launch room
- Done: Internal operations tracker

Each pack should include a template, board, timeline, reports, automations, docs, and a "what good looks like" demo state.

## Step 6: Migration Story

Migration should feel reversible and understandable.

Core behaviors:

- Preview before apply.
- Show mapped, skipped, and risky fields.
- Preserve original IDs when possible.
- Create backups before mutation.
- Generate a human-readable migration report.
- Offer rollback for applied imports.

## Step 7: Trust Center And Proof

Trust cannot live only in claims.

Evidence to collect:

- Security audits
- Dependency audit output
- Backup and recovery drills
- Export examples
- AI/operator action logs
- Permission matrix
- Sync failure handling
- Hosted readiness reports

## Step 8: Packaging And Distribution

Distribution should match the power-user promise.

Paths to keep healthy:

- Browser/PWA
- Docker Compose
- Desktop shell
- CLI
- MCP server
- Hosted API
- Supabase-backed deployment

## Step 9: Demo Dataset And Story

The demo should show a single believable company.

Recommended story: Acme Studio runs a client onboarding project, receives a new client request, turns it into scoped work, manages approvals, checks timeline risk, drafts a client update, exports a status report, and verifies the workspace can be backed up or moved.

## Step 10: Contributor Path

Agora should make contribution feel safe and useful.

Needed surfaces:

- Bug report template
- Feature request template
- Template pack proposal template
- Automation pack proposal template
- Docs improvement template
- Starter issue labels
- Fixture examples
- Extension review checklist

## Review Cadence

After each product push, update this file:

- Mark completed work.
- Add evidence links.
- Move the next highest-leverage step into "In progress".
- Keep the product wedge honest.
