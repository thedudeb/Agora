# Agora Product Requirements Document

## TL;DR

Build Agora, an open source project management platform for teams that want Asana or Nifty-like project clarity without vendor lock-in. The first release should make it easy to self-host, create workspaces and projects, plan work across multiple views, collaborate on tasks, and track progress with enough polish for day-to-day team use.

Current prototype note: Agora now has a dependency-free browser app, local API, JSON storage, optional Supabase persistence, account auth, invitations, roles, client portals, project/task views, time tracking, notifications, templates, automations, import/export, PWA shell support, and baseline accessibility features.

## Background

- Modern teams often rely on SaaS tools such as Asana, Nifty, ClickUp, Monday, or Jira to manage projects, tasks, milestones, and collaboration.
- Open source alternatives exist, but many feel either too technical, too issue-tracker oriented, or too narrow for non-engineering teams.
- Target users need a practical project hub that supports repeatable workflows, cross-functional visibility, and simple collaboration from day one.
- The product should prioritize self-hosting, transparent governance, extensibility, and a generous hosted option later if the project chooses to offer one.

## Problem & Target Users

- Small and mid-sized teams need structured project management but are sensitive to SaaS cost, privacy, data residency, or lock-in.
- Agencies, startups, nonprofits, internal operations teams, and open source maintainers need shared visibility across projects without heavy setup.
- Technical admins want a self-hosted system that is easy to deploy and maintain, while end users want a polished app that does not feel like an admin tool.
- Existing open source tools often underserve timeline planning, client-friendly collaboration, project dashboards, templates, and non-technical workflows.

## Goals & Success Metrics

- Enable a new team to go from deployment to first active project in under 30 minutes.
- Support core project workflows: create projects, create tasks, assign owners, set dates, organize status, comment, attach files, and track progress.
- Offer at least three useful project views: list, board, and calendar or timeline.
- Reach strong activation: at least 60% of new workspaces create one project with five or more tasks in the first week.
- Establish open source viability: public docs, contribution guide, issue templates, and a simple extension direction for integrations.

## Solution Overview

- Provide a workspace-based project management app with projects, tasks, milestones, views, comments, notifications, and member roles.
- Make the default experience simple enough for non-technical teams, while preserving admin controls needed for self-hosted deployments.
- Include opinionated starter templates for common workflows such as product roadmap, client delivery, marketing campaign, sprint planning, and operations tracker.
- Prioritize a clean web app for the initial release, with responsive layouts for mobile review and light task updates.
- Treat integrations as a second layer: useful import/export and webhooks first, deeper app integrations after core workflows are stable.

## User Experience

- New admin creates a workspace, invites teammates, chooses a template, and lands in a ready-to-use project with sample structure they can edit or clear.
- Project manager creates tasks, groups them by section/status, assigns owners, sets due dates, adds priority, and switches between list, board, and calendar/timeline views.
- Team member opens "My Work" to see assigned tasks across projects, update status, comment, and filter by due date or priority.
- Stakeholder opens a project dashboard to see milestones, overdue work, recent activity, and progress without needing to inspect every task.
- Admin manages members, roles, workspace settings, export options, and basic self-hosting health information.

## Requirements

### Workspace & Accounts

- Users can create or join a workspace and belong to multiple workspaces.
- Workspace admins can invite, remove, and change roles for members.
- Roles include owner, admin, member, and guest or limited collaborator.
- Users can manage profile details, notification preferences, and account security basics.

### Projects & Tasks

- Users can create projects with name, description, owner, visibility, start date, due date, and template.
- Users can create tasks with title, description, assignee, status, priority, due date, tags, comments, attachments, and subtasks or checklist items.
- Users can organize tasks by section, status, assignee, due date, priority, and tags.
- Users can bulk update common fields such as assignee, status, date, and tag.
- Completed tasks remain searchable and visible through filters.

### Project Views

- List view supports inline editing, sorting, filtering, grouping, and bulk selection.
- Board view supports drag-and-drop status movement and clearly shows task owner, priority, and due date.
- Calendar or timeline view shows dated tasks and milestones with simple rescheduling.
- Users can save at least one custom view per project.
- Project dashboards summarize progress, overdue work, upcoming milestones, and recent activity.

### Collaboration

- Users can comment on tasks, mention teammates, and receive notifications for relevant changes.
- Users can attach files or links to tasks and project descriptions.
- Activity history captures important task and project changes.
- Guests can be invited to specific projects with limited permissions.
- Notifications are available in-app, with email as a configurable option.

### Templates & Onboarding

- New workspaces can start from an empty workspace or a guided template.
- Project templates include reusable task sections, default statuses, and sample milestones.
- Onboarding prompts guide admins through inviting members and creating the first project.
- Users can duplicate projects and save existing projects as templates.

### Open Source & Self-Hosting

- The project includes clear installation docs for local development and production deployment.
- Admins can configure environment settings, storage, email, and authentication providers.
- The product supports data export for workspace, project, task, comment, and attachment metadata.
- The repository includes contribution guidelines, license, roadmap, code of conduct, and public issue templates.
- The system exposes webhooks or a documented integration surface for future extensions.

## Out of Scope

- Native mobile apps for the first release.
- Advanced enterprise portfolio management, resource forecasting, and capacity planning.
- Built-in chat, video calls, whiteboards, docs suite, or full CRM functionality.
- Full automation builder comparable to Zapier, Asana Rules, or ClickUp Automations.
- Deep two-way integrations with every major SaaS tool in the initial launch.

## Open Questions

- Should the first release prioritize calendar or timeline as the third project view?
- Should guests be included in the MVP, or deferred until core member collaboration is proven?
- Should the project include a hosted cloud offering at launch, or focus exclusively on self-hosting first?
- How opinionated should statuses and workflows be across templates versus fully customizable from day one?

## Assumptions

| Assumption | Confidence |
| --- | --- |
| The product should target cross-functional teams, not only software engineering teams. | High |
| The MVP should compete on usability, self-hosting, and transparency rather than maximum feature count. | High |
| List, board, and calendar/timeline views are enough for the first release. | Medium |
| Admins will expect Docker-based deployment documentation early. | Medium |
| Open source users will value exportability and integration hooks before deep built-in automations. | Medium |

## Decisions Made

| Decision | Outcome |
| --- | --- |
| License | AGPL-3.0-only |
| First mobile path | PWA-first, with native app consideration later |
| Initial persistence path | Local JSON for development, Supabase Postgres as the first production-ready adapter |
