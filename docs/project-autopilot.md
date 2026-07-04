# Project Autopilot

Project Autopilot is Agora's PM-facing recovery layer. It compares project reality against the plan, explains the drift, proposes recovery scenarios, and keeps a human in charge before anything changes.

## What It Looks At

- Tasks: overdue work, blockers, due dates, owner load, priority, and dependency signals.
- Approvals: pending, needs-changes, and client/internal approval status.
- Project Memory: captured updates, extraction previews, applied memory outcomes, and source snippets from meetings, email, chat, GitHub, clients, docs, CLI, or MCP.
- Client promises: client projects with overdue work, blockers, or approval risk.
- Feature requests and scope signals that should be triaged before they become commitments.

## Safety Model

The Autopilot route includes an Autopilot Safety Center before recovery proposals.

- Allowed with approval: create recovery tasks, create RAID decisions/issues, shift overdue task dates, and rebalance one owner.
- Never automatic: no silent client messages, no deletion/archive, no budget changes, and no bulk reassignment.
- Audit required: approvals, rejections, and undo actions write local audit events with scenario, project, confidence, proposed changes, and recovery metadata.
- One-click undo: applied scenarios record snapshots. Undo restores changed tasks and removes Autopilot-created recovery tasks or RAID items.

## Project Memory Bridge

Project Memory captures messy reality first, then produces structured extraction previews. Autopilot now exposes a bridge panel that shows:

- captured updates,
- structured signals,
- signals currently feeding drift detection,
- captures that still need extraction preview.

This keeps the recovery engine inspectable: PMs can see which memory snippets are becoming schedule, scope, blocker, risk, approval, or client-promise evidence.

## First-Run Demo Path

New users can open the Autopilot demo from Dashboard, Launch Flow, or the command palette with `Try Autopilot demo`. If the workspace has no active projects, Agora loads seeded demo data and opens Project Autopilot. Existing workspaces keep their data and simply open the Autopilot route.

The demo path is meant to prove the operating model quickly:

1. review drift detection,
2. inspect the Safety Center,
3. confirm Project Memory signals,
4. compare recovery scenarios,
5. use the Impact Simulator,
6. apply or reject with audit evidence,
7. undo an applied scenario when needed.

## Current Limits

- Autopilot is local and deterministic in the browser prototype.
- It applies a small set of scoped recovery actions; it does not autonomously message clients or make destructive changes.
- Undo restores the Autopilot change snapshot. If a teammate edits the same record after the scenario is applied, PMs should inspect the audit trail before undoing.
- Server-side policy enforcement and deeper conflict-aware undo are future hardening work.
