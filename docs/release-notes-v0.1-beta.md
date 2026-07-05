# Agora v0.1 Beta Release Notes

Status: draft until the hosted demo URL, production verification, device proof, and beta tester loop are filled in.

## What This Beta Is

Agora is an open source, local-first project command center for agencies and consultants running client work with approvals, portals, reusable workflows, auditable AI, and portable data.

The v0.1 beta is for guided evaluation by project managers, self-hosters, and power users. It is not a hands-off managed SaaS.

## Best First Path

1. Open the hosted Acme demo: `<demo-url>`.
2. Follow the Acme client-launch story.
3. Review Data recovery proof.
4. Submit one feature request.
5. If self-hosting, run the Quick Start and export a portable bundle.

## Highlights

- Acme client-launch demo from intake to recovery proof.
- Power-user Kanban, project backlog, Gantt-style timeline, reports, and client visibility workflows.
- Trust Center evidence for no ads, no trackers, portability, recovery, AI policy, and security posture.
- CLI, MCP server, Docker/hosted/PWA/desktop packaging paths.
- Migration concierge for Asana, Trello, Jira, Linear, ClickUp, CSV, and JSON previews.
- Beta feedback loop that routes requests to the taskboard and maintainer inbox when configured.

## Known Beta Limits

- Desktop builds are not signed/notarized for broad public distribution.
- Native iOS and Android wrappers are not shipped yet; mobile proof is the offline PWA.
- Hosted production launches require operator-owned Supabase, SMTP/webhook, backup, and domain configuration.
- Public feedback is opt-in and should stay rate-limited.
- Browser-local workspaces should not be the only copy of important work.

## Verification Summary

Latest local evidence bundle: [`release/evidence/20260705T153426Z-3099231`](../release/evidence/20260705T153426Z-3099231/README.md)

Passed locally:

- release discipline
- hosted demo readiness
- distribution proof ledger
- beta feedback loop
- packaging manifest
- trust evidence
- Acme demo browser golden path
- feedback browser golden path
- full release QA
- security gate

Still required before broad beta:

- public hosted demo URL;
- hosted production verify with real env, backup, and bundle;
- real device/offline checks;
- source/Docker/hosted/PWA/desktop/CLI/MCP/portable distribution evidence;
- first beta tester feedback proof.

## Feedback

Use the in-app Feature Request button, the public feedback form if enabled, or GitHub issues. Do not include real customer data, private emails, secrets, service-role keys, payment credentials, or private file URLs.
