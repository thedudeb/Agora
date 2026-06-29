# Roadmap

This roadmap describes the intended direction for Agora. It will evolve as the prototype turns into a self-hostable product.

## Current Prototype

Agora currently includes a dependency-free browser app, local app server, API scaffold, JSON storage, optional Supabase storage, first-run onboarding, guided tutorial mode, launch-readiness guidance, a Cmd/Ctrl+K command palette, keyboard shortcuts, local multi-workspace switching, clean/demo workspace setup, local workspace backups, account signup/login, Supabase email/password auth, invitations, role permissions, company-scoped access controls, API-first company/project/task records, split Settings tabs for account, sync, security, integrations, and developer readiness, merged local/API audit logs, project/task views, saved views, project PM snapshots, company and client portals, docs/files, intake, templates, automations with previews, notifications, time tracking, import/export, command-style search, copyable status reports, polling-based live refresh, task viewer presence, same-page cursor presence, mentions, watched-task inbox signals, stale edit warnings, customizable workspace themes, deployment readiness checks, accessibility basics, and PWA shell support.

## Phase 0: Project Foundation

- Finalize product requirements.
- Choose initial technical architecture. ✅
- Add development setup documentation. ✅
- Define contribution standards and issue labels.
- Publish a small set of design principles and core user flows.
- Establish the first API, auth, and persistence foundation. ✅
- Draft the database schema for self-hosted deployments. ✅

## Phase 1: MVP

- Workspace creation and member invitations.
- Local workspace switcher with create, duplicate, archive, and switch actions. ✅
- Local backup and restore center for each browser workspace. ✅
- Role-aware authentication, company-scoped access, and session management.
- API-backed workspace persistence. ✅
- Project creation with configurable statuses.
- Task creation, assignment, due dates, priorities, comments, and attachments.
- List and board project views.
- My Work view for assigned tasks across projects.
- Basic in-app notifications.
- Self-hosting setup guide.
- Workspace theme presets and deploy-readiness guidance.
- First-run setup flow with clean/demo workspace choice. ✅
- Guided tutorial mode for new users. ✅
- Launch-readiness panel, keyboard command palette, and shortcut help. ✅

## Phase 2: Team Planning

- Calendar or timeline view.
- Milestones and project dashboards.
- Project templates and project duplication.
- Guest access for client or stakeholder collaboration.
- Saved filters and saved project views. ✅
- Production-grade search and command palette actions. ✅
- Data export for workspace and project content.

## Phase 3: Extensibility

- Webhooks.
- Public API foundations.
- Import from common project management formats.
- Email notification configuration.
- Authentication provider configuration.
- Plugin or integration strategy.

## Later

- Advanced automations.
- Resource planning and capacity views.
- Native mobile apps.
- Theme marketplace/export support for self-hosters.
- Deeper third-party integrations.
- Hosted cloud option, if the community and maintainers decide to pursue it.
