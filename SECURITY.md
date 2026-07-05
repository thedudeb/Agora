# Security Policy

Agora is early open source software. Please treat it as a prototype unless you have reviewed the code, configured production auth/storage carefully, and verified your deployment.

## Reporting A Vulnerability

Please do not open a public issue for a vulnerability that could expose workspace data, credentials, file objects, auth sessions, payment metadata, or AI provider secrets.

Report privately by emailing the maintainer or opening a minimal private/security advisory if GitHub security advisories are enabled for the repository.

Include:

- Affected commit or version.
- A clear description of the issue.
- Steps to reproduce.
- Impact and affected surfaces.
- Any logs or screenshots that do not expose secrets or private data.
- Suggested fix, if known.

We will prioritize issues that affect:

- Authentication or session handling.
- Supabase RLS, storage, or service-role key exposure.
- File upload/download access control.
- Workspace import/export or backup leakage.
- Company-scoped access controls.
- API permission checks.
- AI provider key handling or Operator actions.
- Payment entitlement or marketplace payout metadata.
- Cross-site scripting, CORS, CSRF, or unsafe redirects.

## Supported Versions

Agora is currently pre-1.0. Security fixes are expected to land on `main` first.

## Deployment Security Checklist

Before inviting a real team:

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Keep AI provider keys server-only.
- Keep Stripe, x402, SMTP, and webhook secrets server-only.
- Do not paste service-role keys into browser settings, screenshots, issue reports, or exported bundles.
- Run `npm run verify:hosted` against the production `.env`; it must fail for demo auth, passwordless auth, manual reset tokens, implicit localhost CORS, missing HTTPS app URL, missing SMTP credentials, missing scheduled backups, or unsafe AI provider settings.
- Set `AGORA_DEMO_AUTH=false` in production.
- Set `AGORA_PASSWORDLESS_AUTH=false` unless intentionally enabled.
- Keep `AGORA_PUBLIC_FEATURE_REQUESTS=false` until you intentionally accept public submissions and have tuned the public rate/body limits.
- Run `npm run trust` to verify the current Trust Center evidence for privacy, headers, diagnostics, backups, upgrades, portability, migration, hosted readiness, and extension contracts.
- Run `npm run security` before release and investigate any moderate-or-higher advisory.
- Set `AGORA_STRICT_CSP=true` or `NODE_ENV=production` for hosted app/static servers, and keep `AGORA_CSP_CONNECT_SRC` limited to trusted API origins.
- Refresh Backend Health and export the Readiness page report before cutover so strict CSP, public origins, reset delivery, and dependency audit evidence are captured without secrets.
- Limit `AGORA_ALLOWED_ORIGINS` to trusted HTTPS app origins and keep `AGORA_ALLOW_LOCALHOST_ORIGINS=false` for hosted deployments.
- Use HTTPS in front of the app and API.
- Configure `AGORA_BACKUP_DIR`, `AGORA_BACKUP_RETENTION_FILES`, and `AGORA_BACKUP_SCHEDULER_ENABLED=true`; prove a fresh backup before launch.
- Run the Supabase migrations before enabling Supabase storage/auth.
- Confirm Supabase RLS policies with `npm run test:supabase`.
- Review Admin > Permissions for excess admins, workspace import access, and Operator client-data access.
- Review automation clients against `docs/api-agent-contract.md`; keep them read-only by default and require confirmation before destructive, external, payment, scheduler, import, or membership actions.
- For MCP clients, follow `docs/mcp-server.md`, keep `AGORA_MCP_ALLOW_WRITES=false` by default, and rotate any token that appears in prompts, logs, screenshots, or shared config files. Use `GET /api/auth/sessions` and `DELETE /api/auth/sessions/:id` to revoke active in-memory sessions when needed.
- Export a recovery bundle before major imports, migrations, or auth changes.

## Offline And Local Data

Agora is local-first. Browser, desktop, and future mobile installs can keep workspace data on the device so the app remains useful without internet.

- Portable bundles and workspace exports must not include raw API bearer tokens, active invitation tokens, client portal bearer links, Supabase service-role keys, AI provider keys, SMTP secrets, Stripe keys, x402 credentials, or webhook signing secrets.
- Browser/API sessions may still be stored locally for the current browser install. Desktop builds use Electron `safeStorage` for API session payloads when OS encryption is available, then remove the plain localStorage copy. Use `Settings > Security > Offline security posture` to clear the local API session on shared or lost devices, and revoke server sessions when the API is reachable.
- Local backups, queued writes, and workspace snapshots should be treated as workspace data. Do not share a device profile or exported bundle unless the recipient is allowed to see that workspace.
- Native desktop and mobile wrappers should store API session secrets in the OS keychain or keystore, while workspace snapshots can remain in the app sandbox.
- The portable bundle includes `offline-storage-contract.json`; release candidates should confirm the contract matches the platform storage implementation.

## AI And Data Handling

Agora's AI Operator should stay governed by explicit permissions, previews, rationale, audit logs, and undo paths where possible.

If you configure a bring-your-own-AI provider:

- Store provider keys only on the API server.
- Keep `AGORA_AI_ALLOW_CLIENT_BASE_URL=false` by default. If a trusted self-hosted workspace enables it, restrict values with `AGORA_AI_ALLOWED_BASE_URLS` and use hosted HTTPS URLs only.
- Review whether client data is allowed in Operator context.
- Prefer the safest permission preset until your team understands the workflow.
- Audit applied Operator actions regularly.

## File Uploads

Agora file downloads are proxied through authenticated API routes. Private Supabase Storage buckets should not be made public for Agora uploads unless you intentionally change the access model and understand the consequences.

## Marketplace And Payments

Marketplace payment adapters are currently foundation work. Stripe and x402 are intentionally stubbed until real server-side adapters and webhook validation are implemented.

Do not treat local or test entitlements as proof of payment in production.

## Public Issues

For non-sensitive bugs, use the bug report template. Redact secrets, customer data, private file names, and API tokens before posting logs or screenshots.
