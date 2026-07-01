# Beta Test Script

Use this script when handing Agora to a first external tester. The goal is to confirm that a person can launch a workspace, prove recovery, and understand what to do next without live narration.

Plan for 30 to 45 minutes. Capture screenshots or notes for any confusing copy, broken layout, failed command, or step where the tester asks what to do next.

## Setup

- Start from a clean browser profile or clear the local Agora workspace data.
- Run `npm run dev` and open the app.
- Keep a terminal open in the repo root.
- Optional hosted/API pass: run `npm run dev:api`, connect from Settings, and repeat the script with API sync enabled.

## Pass Criteria

- The tester can find Launch Flow from the landing page, Dashboard, sidebar, or command palette.
- The tester can create or identify a first client project.
- The tester can install or review the recommended handoff automation pack.
- The tester can create a backup, export a portable bundle, and run a CLI readiness check.
- The tester can find Readiness and explain the remaining open items.
- No route renders a view error, horizontal overlap, or unusable mobile control.

## Script

1. Open the app and go to Launch Flow.
   Expected: the page explains the first workspace sequence and shows launch progress.

2. Create the client workspace structure.
   Expected: a client/company and first project exist, and the launch progress updates.

3. Review the recommended Client Onboarding template.
   Expected: Templates opens with the recommended starter template visible and usable.

4. Return to Launch Flow and install the Agency Client Handoff automation pack.
   Expected: the automation pack installs or is clearly marked as already installed.

5. Create a recovery backup from Launch Flow or Readiness.
   Expected: backup count increases and Readiness reflects recovery evidence.

6. Open Data and download a portable bundle.
   Expected: the bundle downloads and Data explains the restore path.

7. Run the CLI readiness check against a portable bundle fixture.
   ```sh
   npm run agora -- launch check tests/fixtures/portable-workspace-bundle.json
   npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json --json
   ```
   Expected: the commands print a readable readiness report and JSON bundle summary.

8. Open Readiness.
   Expected: launch, production, backend, recovery, access, audit, and CLI sections are visible with clear next actions.

9. Prepare a teammate invite.
   Expected: local mode saves a draft invite; API mode sends or creates an API-backed invite.

10. Switch to a mobile-width viewport and repeat the quick path: Dashboard -> Launch Flow -> Readiness -> Data.
    Expected: the route content appears without awkward overlap, and the filter toolbar scrolls horizontally.

## Failure Notes

For each failure, record:

- Route or command.
- Browser width/device.
- What the tester expected.
- What happened instead.
- Screenshot or terminal output.
- Whether refreshing fixed it.

## Required Commands Before Beta

```sh
npm run verify:quick
npm run test:golden
npm run test:recovery
```

For a fuller preflight:

```sh
npm run verify
npm run launch:check
```
