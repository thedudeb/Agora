# Beta Test Script

Use this script when handing Agora to a first external tester. The goal is to learn whether a real project manager can understand the Acme client-delivery workflow, trust recovery, export their work, and submit feedback without live narration. Run the follow-up operating loop in [`beta-feedback-loop.md`](./beta-feedback-loop.md).

Plan for 30 to 45 minutes. Capture screenshots or notes for any confusing copy, broken layout, failed command, or step where the tester asks what to do next.

## Setup

- Start from a clean browser profile or clear the local Agora workspace data.
- Run `npm run dev` and open the app.
- Keep a terminal open in the repo root.
- Optional hosted/API pass: run `npm run dev:api`, connect from Settings, and repeat the script with API sync enabled.

## Core Workflow Scorecard

Score each item as `pass`, `friction`, or `blocker` before collecting wishlist ideas:

| Question | Pass Signal | Notes |
| --- | --- | --- |
| First win | Tester can start or load the Acme workspace and explain the next PM action within 10 minutes. |  |
| Client request to work | Tester can follow intake/backlog work into an active project without hand-holding. |  |
| Client safety | Tester can preview client-visible status and name what remains internal. |  |
| Recovery trust | Tester understands Autopilot proposals are previewed, auditable, and reversible. |  |
| Portability | Tester can export or identify recovery proof before entering real data. |  |
| Feedback loop | Tester can submit a feature request and see that it becomes owned work. |  |

Treat blockers in first win, client safety, recovery trust, or portability as `P1`, even if the underlying feature technically exists.

## Pass Criteria

- The tester can follow the Acme story from PM triage to recovery proof.
- The tester can explain what the next PM action is without opening every route.
- The tester can identify client-visible versus internal context.
- The tester can describe why Autopilot will not silently change work or message clients.
- The tester can create a backup, export a portable bundle, or identify where recovery proof lives.
- The tester can submit a feature request and find the Feature Requests board.
- No route renders a view error, horizontal overlap, or unusable mobile control.

## Script

1. Open the app and load the Acme demo from the landing page or `?route=command-center&demoAction=sampleAgencyWorkspace`.
   Expected: the Command Center makes the highest-risk PM action obvious.

2. Ask the tester to explain what should happen next.
   Expected: they can name the client request, owner/risk context, and next action without a tour.

3. Open Project Backlog.
   Expected: the tester can tell whether a request is proposed, approved, active, parked, or rejected.

4. Open Client Visibility.
   Expected: the tester can preview what the client can see and name what remains internal.

5. Open the launch project timeline.
   Expected: the tester can spot schedule risk, dependency risk, or slipped work before sending an update.

6. Open Reports and copy or draft a client update.
   Expected: the update is credible enough to use as a starting point without rebuilding status manually.

7. Open Project Autopilot or the launch recovery path.
   Expected: the tester understands recovery proposals are previewed, auditable, and reversible before anything applies.

8. Open Data and create or identify recovery proof.
   Expected: the tester can create a backup, export a portable bundle, and explain the restore path.

9. Submit one feature request from the top bar or public feedback route.
   Expected: the request appears on the Feature Requests board and can be triaged.

10. Switch to a mobile-width viewport and repeat the quick path: Command Center -> Client Visibility -> Data.
    Expected: the route content appears without awkward overlap, and core actions remain usable.

## Optional Power-User Follow-Up

Use these only after the core scorecard is complete:

- Run the CLI readiness check against a portable bundle fixture.
- Review CLI or MCP docs for local automation.
- Review migration concierge output for a sample import.
- Review sprint, portfolio, marketplace, payment, plugin, or native mobile planning surfaces.

CLI readiness commands:

```sh
npm run agora -- launch check tests/fixtures/portable-workspace-bundle.json
npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json --json
```

Expected: the commands print a readable readiness report and JSON bundle summary.

## Failure Notes

For each failure, record:

- Route or command.
- Browser width/device.
- Scorecard item affected.
- What the tester expected.
- What happened instead.
- Screenshot or terminal output.
- Whether refreshing fixed it.
- Launch decision: fix now, document, defer, or reject.

## Required Commands Before Beta

```sh
npm run qa
npm run beta:check
npm run verify:quick
npm run test:golden
npm run test:recovery
```

For a fuller preflight:

```sh
npm run verify
npm run launch:check
```
