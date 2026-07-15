# Production Readiness

Agora is usable as an offline-first project workspace today, with optional API sync for hosted teams. This checklist explains what is ready, what needs configuration, and what to verify before using it for real client or team work.

## Ready Today

- Local browser workspace with projects, tasks, boards, timelines, sprints, docs, files, decisions, feature requests, and audit history.
- Offline-first PWA shell with cached app assets, offline fallback, and local storage recovery paths.
- Portable workspace bundle with JSON, CSV, Markdown, audit log, templates, automations, and offline storage contract.
- Local backups and restore preview flows before imports, API restores, or migration changes.
- Client visibility controls for portal links, share packets, client-visible tasks, and internal notes.
- Trust surfaces for portability, recovery, AI auditability, security gates, and client-safe sharing.
- CLI and MCP surfaces for power users and automation-oriented workflows.

## Needs Configuration

- Hosted API sync requires a configured API base URL, authentication provider, and backend health checks.
- Email delivery needs a real mail provider or server-side integration. Local email handoff records are not the same as sent mail.
- Browser notifications require user permission and, for production delivery, server-side scheduling.
- Native desktop and mobile packages should verify the offline storage contract against each target build.
- Team security depends on role setup, invitation review, and production auth/session configuration.

## Preflight Checklist

1. Run `npm run check`.
2. Run `npm run test:golden`.
3. Create a local backup from Data.
4. Download the portable bundle and manifest.
5. Preview an import or restore path before replacing workspace data.
6. Review Settings > Sync for API status and failed sync attempts.
7. Review Settings > Security for sessions, roles, and production gates.
8. Review client visibility before sharing portal links or packets.
9. Confirm feature request routing and email handoff behavior.
10. Save the release evidence or handoff notes for the workspace owner.

## Known Limits

- Local recovery proves browser portability; it does not prove cloud parity unless API sync is configured and healthy.
- Offline work stays local until sync reconnects, so conflict review remains part of production operations.
- AI/operator actions are designed for visible rationale and auditability, but provider keys and data handling must be configured server-side for hosted deployments.
- Large customer workspaces should be tested with realistic data volume before rollout.

## Owner Handoff

Before a project owner depends on Agora, give them three things:

- A recovery receipt from Data showing backup, bundle, offline contract, restore rehearsal, and current limitations.
- A trust proof review from the dashboard showing recovery, portability, AI audit, client safety, and security status.
- A short operations note explaining who owns sync health, backup cadence, user access, and client sharing.
