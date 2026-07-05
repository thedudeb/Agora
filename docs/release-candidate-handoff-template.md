# Release Candidate Handoff Template

Use this template for every beta or public release candidate. Fill it out before tagging, deploying, or handing Agora to an external team.

## Release Identity

- Version:
- Git commit:
- Release owner:
- Target audience:
- Release date:
- Candidate status: beta / production / internal

## Required Gate Output

Paste or link the latest output:

- `npm run package:check`:
- `npm run trust`:
- `npm run qa`:
- `npm run security`:
- `npm run verify:production -- --env .env.production --backup <server-backup.json> --bundle <portable-workspace-bundle.json> --strict`:
- Recovery proof from `npm run drill:recovery -- --backup <server-backup.json>`:

## Platform Notes

| Channel | Status | Evidence | Accepted risk |
| --- | --- | --- | --- |
| Source install |  |  |  |
| Docker Compose |  |  |  |
| Hosted web/API |  |  |  |
| Offline PWA |  |  |  |
| macOS desktop |  |  |  |
| Windows desktop |  |  |  |
| Agora CLI |  |  |  |
| Local MCP server |  |  |  |
| Portable data |  |  |  |

## Manual PM Pass

- Canonical Acme client-launch demo works from generated links.
- Landing page explains the agency/consultant wedge.
- First-run setup reaches a useful workspace in under 10 minutes.
- Data export and recovery proof are understandable.
- Payments surfaces are clearly labeled as beta/provider-foundation when no live adapter is configured.
- Integrations surfaces are clearly labeled as adapter/manifest/sync handoff when full third-party sync is not configured.
- Mobile-width Dashboard, Launch Flow, Readiness, and Data are usable.

## Known Gaps

Copy current gaps from `packaging/release-manifest.json` and add any release-specific risks:

- 

## Rollback Plan

- Previous known-good commit:
- Hosted rollback target:
- Backup artifact:
- Portable bundle:
- Owner who can approve rollback:
- Trigger conditions:

## Sign-Off

- Product:
- Engineering:
- Security/trust:
- Release owner:
