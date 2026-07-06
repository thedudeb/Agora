# Agora Product Readiness Roadmap

This is the working product-management checklist for turning Agora from a powerful prototype into a product real teams can confidently adopt.

## Current Operating Mode

Agora is now in beta hardening mode, not feature expansion mode. New surfaces should wait unless they unblock release proof, tester feedback, trust, migration safety, or the Acme client-delivery story.

Near-term work should improve what already exists:

- Make the release evidence current and reproducible.
- Make the Acme demo easier to understand in one pass.
- Make the first-run and beta scorecards expose friction quickly.
- Make migration, export, recovery, permissions, and AI actions feel trustworthy.
- Move advanced surfaces into core only after beta evidence shows they help the primary workflow.

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
| 6. Polished migration story | Complete | A team can bring real work from competitors safely. | Import concierge previews mappings, warnings, rollback, skipped data, and clean next steps for Asana, Trello, Jira, Linear, ClickUp, and generic CSV/JSON. |
| 7. Trust center and proof | Complete | Buyers and self-hosters can verify security, privacy, portability, and AI behavior. | Trust Center links to evidence reports, security audits, export guarantees, AI policy, backup drills, and dependency/runtime checks. |
| 8. Real packaging and distribution | In progress | Users can install Agora where they work. | PWA, desktop, Docker, hosted deploy, MCP, and CLI paths have clear release checks, version metadata, and upgrade guidance. |
| 9. Focused demo dataset and story | In progress | The demo shows one memorable real workflow instead of a feature inventory. | Demo links, screenshots, sample data, and video script follow the same agency/client delivery scenario from intake to approval to report. |
| 10. Sustainable contributor path | Complete | Open source contributors know where to help without becoming maintainers first. | Issue templates, starter issues, extension contracts, fixture examples, contribution lanes, and review criteria are easy to find. |

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

- Done: preview before apply through the CLI migration plan.
- Done: show mapped, skipped, and risky fields in the migration concierge.
- Done: preserve original IDs, source URLs, import batch IDs, and raw source fields where possible.
- Done: require an explicit output workspace for apply so the source workspace remains untouched.
- Done: generate human-readable and JSON migration concierge reports.
- Done: include rollback readiness, backup evidence, and restore steps in the concierge report.
- Done: cover generic CSV, Trello JSON, Asana CSV, Jira CSV, Linear CSV, and ClickUp CSV in importer tests.

Next polish:

- Add real-world fixture exports from beta users as opt-in anonymized test cases.
- Add attachment metadata previews before supporting attachment import.
- Add a UI wrapper around the concierge once the CLI flow has enough customer mileage.

## Step 7: Trust Center And Proof

Trust cannot live only in claims.

Current product state:

- Done: Trust Center documentation links the buyer/security review packet.
- Done: `docs/trust-evidence-matrix.md` maps claims to evidence files, commands, and review cadence.
- Done: `docs/ai-data-policy.md` documents AI provider defaults, data-use rules, user controls, audit evidence, and provider review.
- Done: `docs/security-audit-2026-07-05.md` records security and dependency-audit receipts.
- Done: `npm run trust` verifies privacy posture, security headers, diagnostics, recovery, upgrades, portability, migrations, hosted readiness, extension contracts, evidence matrix, AI policy, and audit receipts.
- Done: backup drills, upgrade gates, migration concierge reports, portable export docs, and hosted readiness runbooks are linked as proof artifacts.

Next polish:

- Add fresh evidence receipts per release candidate instead of relying on a single dated audit.
- Add third-party penetration-test or compliance evidence when Agora is ready for larger customers.
- Add mobile keychain/keystore evidence after native mobile wrappers ship.

## Step 8: Packaging And Distribution

Distribution should match the power-user promise.

Current product state:

- Done: `packaging/release-manifest.json` declares release status, release gate, handoff artifacts, known gaps, and nine distribution channels.
- Done: `npm run package:check` verifies source, Docker Compose, hosted web/API, offline PWA, macOS desktop, Windows desktop, CLI, MCP server, and portable data channels.
- Done: `docs/packaging-audit-2026-07-05.md` records beta-ready, internal-ready, and remaining polish status per channel.
- Done: `docs/install.md` routes users by install intent across local, Docker, hosted, PWA, desktop, CLI, MCP, and portable data paths.
- Done: `docs/hosted-provider-recipes.md` gives operators a static-app/API/Supabase/Docker handoff with secrets placement and acceptance checks.
- Done: `docs/release-candidate-handoff-template.md` records version, commit, gate output, platform notes, known gaps, rollback plan, and sign-off.
- Done: packaging docs define release gate output, recovery proof, known gaps, and per-platform notes required for a release handoff.

Remaining release polish:

- Add signed/notarized desktop release evidence for macOS and Windows.
- Add registry image publishing and digest pinning for Docker releases.
- Run real iOS/Android PWA install and airplane-mode checks per release candidate.
- Fill out the release-candidate handoff template for the next beta candidate.

## Step 9: Demo Dataset And Story

The demo should show a single believable company.

Recommended story: Acme Studio runs a client onboarding project, receives a new client request, turns it into scoped work, manages approvals, checks timeline risk, drafts a client update, exports a status report, and verifies the workspace can be backed up or moved.

Current product state:

- Done: `acme-client-launch` is the canonical demo story in `demos/workspaces.json`.
- Done: `npm run demo:links -- --demo acme-client-launch --markdown` generates a direct handoff with story beats, proof moments, and next clicks.
- Done: `docs/acme-client-launch-demo.md` gives launch, sales, and support a single Acme route handoff.
- Done: `docs/demo-workspaces.md`, `docs/demo-video-script.md`, and `docs/screenshot-demo-plan.md` now lead with the Acme intake-to-recovery flow instead of a feature inventory.
- Done: `AGORA_GOLDEN_SUITE=demo npm run test:golden` covers the canonical Acme route sequence.

Next polish:

- Refresh screenshots against the canonical story.
- Record a short demo using the canonical route sequence.

## Step 10: Contributor Path

Agora should make contribution feel safe and useful.

Current product state:

- Done: `CONTRIBUTING.md` gives contributors the top-level contribution workflow and review bar.
- Done: `.github/ISSUE_TEMPLATE/*` covers bugs, production issues, feature requests, support diagnostics, product questions, docs, templates, and automation packs.
- Done: `.github/PULL_REQUEST_TEMPLATE.md` asks for verification, product/trust impact, rollback notes, and fixture hygiene.
- Done: `docs/contributor-path.md` defines contribution lanes, fixture rules, and review criteria.
- Done: `docs/contributor-labels.md` defines starter labels, product-area labels, and priority semantics.
- Done: `docs/starter-issues.md` gives ready-to-copy starter issues for docs, UI polish, fixtures, trust/release, plugin, and MCP work.

## Review Cadence

After each product push, update this file:

- Mark completed work.
- Add evidence links.
- Move the next highest-leverage step into "In progress".
- Keep the product wedge honest.
