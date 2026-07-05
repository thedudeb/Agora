# Demo Video Production Checklist

Use this checklist when recording the 75 to 120 second Acme launch demo. The script lives in [`demo-video-script.md`](./demo-video-script.md); this file is the production checklist for capture, edit, export, and release evidence.

## Preflight

- Run `npm run demo:check`.
- Run `AGORA_GOLDEN_SUITE=demo npm run test:golden`.
- Run `npm run screenshots` and confirm the Acme screenshot files changed intentionally.
- Use the hosted demo URL only after following [`hosted-demo-runbook.md`](./hosted-demo-runbook.md).
- Use a clean browser profile with no extensions, bookmarks bar, private tokens, local paths, or personal emails visible.

## Recording Setup

- Desktop viewport: `1440 x 1000` or close.
- Mobile cutaway viewport: `390 x 844` only if needed.
- Start URL: `?route=landing`.
- Main story URL sequence: the six routes in [`acme-client-launch-demo.md`](./acme-client-launch-demo.md).
- Target length: 75 to 120 seconds.
- Export filename: `assets/videos/agora-acme-client-launch-demo.mp4` when video assets are added to the repo or release bundle.

## Shot List

| Shot | Route | Goal | Max Time |
| --- | --- | --- | --- |
| Opening promise | `?route=landing` | No ads, no trackers, no lock-in. | 8s |
| Triage request | `?route=command-center&demoAction=sampleAgencyWorkspace` | PM morning view and client promises. | 14s |
| Scope project | `?route=project-backlog` | Intake becomes scoped delivery work. | 14s |
| Review approvals | `?route=visibility` | Client-safe sharing and approval warnings. | 16s |
| Inspect risk | `?route=project&project=launch&tab=timeline` | Timeline, Gantt, dependency risk. | 16s |
| Client update | `?route=reports` | Copyable status report. | 16s |
| Recovery proof | `?route=data&demoAction=recoveryPlan` | Export, backup, restore proof. | 14s |
| Trust close | `?route=permissions` | Role and Operator audit. | 10s |

## Acceptance

- The video shows one Acme story, not a feature inventory.
- Each screen appears long enough to read the main heading and one proof label.
- The voiceover mentions open source, local-first control, client-safe approvals, reports, and portable recovery.
- No secrets, real customer data, personal email, browser extension UI, or local filesystem paths are visible.
- The release candidate doc links the final hosted demo URL and video asset location before tagging.
