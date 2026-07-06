# Beta Feedback Loop

Use this loop when Agora is in the hands of external beta testers. The goal is not to collect a huge wishlist; it is to learn whether real project managers can launch a client workspace, trust recovery, submit feedback, and see that feedback become owned work.

## Tester Profile

Prioritize five to ten testers before widening:

- agency or consultancy project managers running client delivery;
- self-hosters who can test install, backups, upgrade, and export;
- power users who will try CLI, MCP, templates, and migration paths;
- one mobile-heavy tester who can stress PWA/offline behavior;
- one security-minded operator who will review auth, permissions, backups, and audit evidence.

Do not invite real client stakeholders until API auth, permissions, backups, email delivery, and Readiness checks are complete.

## Intake Paths

Use all three paths so testers can report issues where they naturally are:

| Intake | Route Or Surface | Use For |
| --- | --- | --- |
| In-app feature request | `Feature Request` button and `?route=feature-requests` | Authenticated tester ideas, blockers, and workflow gaps. |
| Public feedback form | `#feedback` / `?route=feedback` | Hosted demo or public beta feedback when enabled. |
| GitHub issues | `.github/ISSUE_TEMPLATE/*` | Developer, self-hosting, security, template, and automation pack feedback. |

Public feature requests stay opt-in. Keep `AGORA_PUBLIC_FEATURE_REQUESTS=false` until rate limits, email routing, and abuse handling are verified.

## Triage Cadence

During a guided beta:

- Same day: tag anything blocking setup, auth, export, restore, or demo completion as `P1`.
- Twice weekly: review the Feature Requests board and assign owners.
- Weekly: group feedback into themes: first run, client workflow, recovery, migration, offline, integrations, AI/operator, docs.
- Before each release candidate: close or explicitly accept all `P1` beta blockers.

Every feedback item should have:

- route or command;
- tester role;
- browser/device/API mode;
- expected behavior;
- actual behavior;
- owner;
- launch decision: fix now, document, defer, or reject.

## Core Workflow Scorecard

Ask each guided beta tester to score the existing Acme workflow before collecting wishlist items:

| Question | Pass Signal | Failing Signal |
| --- | --- | --- |
| First win | Tester can start or load the Acme workspace and explain the next PM action within 10 minutes. | Tester gets lost, opens unrelated power-user surfaces, or cannot find the demo path. |
| Client request to work | Tester can follow intake/backlog work into an active project without hand-holding. | Tester cannot tell whether a request is proposed, approved, active, or parked. |
| Client safety | Tester can preview client-visible status and name what remains internal. | Tester worries internal notes, AI actions, or draft work may leak to clients. |
| Recovery trust | Tester understands Autopilot proposals are previewed, auditable, and reversible. | Tester thinks automation will silently change work or message clients. |
| Portability | Tester can export or identify recovery proof before entering real data. | Tester does not trust the workspace can be backed up, moved, or restored. |
| Feedback loop | Tester can submit a feature request and see that it becomes owned work. | Tester feels feedback disappears or has no visible owner/status. |

Record each score as `pass`, `friction`, or `blocker`. Treat blockers in first win, client safety, recovery trust, or portability as `P1` even if the underlying feature technically exists.

## Email And Taskboard Proof

Before inviting public beta testers:

1. Set `AGORA_FEATURE_REQUEST_EMAIL` to the maintainer inbox.
2. Configure SMTP or webhook delivery.
3. Submit one in-app feature request.
4. Submit one public feedback form item if public feedback is enabled.
5. Confirm each item appears on the Feature Requests taskboard.
6. Confirm owner email queues or delivers.
7. Move one request to a new status and confirm requester update behavior when an email is present.

Verification commands:

```sh
npm run beta:check
AGORA_GOLDEN_SUITE=feedback npm run test:golden
npm run test:api
```

## Data Safety

Tell testers:

- Use sample or anonymized project data only.
- Do not enter real customer data, private emails, secrets, service role keys, AI provider keys, Stripe keys, SMTP credentials, or private file URLs.
- Export a portable bundle before imports, destructive testing, browser clearing, or API sync experiments.
- Attach screenshots only after checking they do not include private data.
- Use hosted demo workspaces for demos and local/self-hosted workspaces for sensitive evaluations.

The feedback system should preserve the same product promises as the rest of Agora: no ads, no trackers, portable bundle export, auditable changes, and self-hostable operation.

## Exit Criteria For Widening Beta

Widen beta only when:

- `npm run beta:check` passes.
- Feedback golden QA passes locally or against the hosted beta URL.
- All `P1` beta blockers have an owner and decision.
- Feature request email/taskboard proof is recorded in the release candidate doc.
- The current accepted risks are listed in [`beta-notes.md`](./beta-notes.md) and [`release-candidate-v0.1-beta.md`](./release-candidate-v0.1-beta.md).
