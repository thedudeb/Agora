# Acme Client Launch Demo

Use this as the default hosted-demo handoff for project managers evaluating Agora. The goal is to show one believable client-delivery story, not every feature. Use [`hosted-demo-runbook.md`](./hosted-demo-runbook.md) before publishing public links.

## Generate Links

Local:

```sh
npm run demo:links -- --demo acme-client-launch --markdown
```

Hosted:

```sh
npm run demo:links -- --base https://demo.your-domain.example --demo acme-client-launch --markdown
```

Machine-readable:

```sh
npm run demo:links -- --demo acme-client-launch --json
```

## Story

Acme Studio receives a new client launch request. The project manager triages it, scopes it into delivery work, reviews client-safe approvals, checks timeline risk, drafts a client update, and proves the workspace can be exported or restored.

## Route Sequence

| Step | Route | What To Show | Buyer Proof |
| --- | --- | --- | --- |
| 1. Triage request | `?route=command-center&demoAction=sampleAgencyWorkspace` | Attention queue, highest-risk items, client promises, next best actions. | Agora starts from the PM's morning reality, not an empty board. |
| 2. Scope project | `?route=project-backlog` | Backlog projects, intake, pipeline, approved work, promote path. | Future work is deliberate and traceable before it becomes active delivery. |
| 3. Review approvals | `?route=visibility` | Client-safe packet, portal link, approval needs, visibility warnings. | Client collaboration has a review gate so internal notes stay internal. |
| 4. Inspect timeline risk | `?route=project&project=launch&tab=timeline` | Gantt timeline, dependency risk, slipped path, workload warnings. | Schedule risk is visible before the client update. |
| 5. Draft client update | `?route=reports` | Status report, delivery risk, capacity planning, workload, risk queue. | The PM can copy a useful update instead of rebuilding status manually. |
| 6. Prove recovery | `?route=data&demoAction=recoveryPlan` | Recovery confidence, backups, import preview, portable export. | The no-lock-in promise is backed by export and restore evidence. |

## Talk Track

Start with: "Agora is open source project management for client-facing teams that want clarity without ads, trackers, or lock-in."

Then keep the story practical:

- "This is the PM command center: what needs attention, which client promises are at risk, and what should happen next."
- "Before the team commits, the request lives in a project backlog with owner, priority, and promotion context."
- "Client visibility is reviewed before sharing, so approvals move without exposing internal delivery notes."
- "Timeline and Gantt views show the delivery risk behind the board."
- "Reports turn the same project data into a client update."
- "Data export and recovery proof show the team can leave, restore, or self-host without losing the trail."

## Proof Moments

- Command center ties work, risk, decisions, visibility warnings, and follow-up together.
- Client sharing has a visible review step.
- Timeline and reports use the same project state, reducing manual reporting drift.
- Export, backup, import preview, and recovery language make portability concrete.

## QA Gate

Run the focused demo golden path before recording or sharing hosted links:

```sh
npm run demo:check
AGORA_GOLDEN_SUITE=demo npm run test:golden
```

Run the link generator after catalog edits:

```sh
npm run demo:links -- --demo acme-client-launch --markdown
npm run demo:links -- --demo acme-client-launch --json
```
