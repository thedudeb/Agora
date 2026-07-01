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
- Set `AGORA_DEMO_AUTH=false` in production.
- Set `AGORA_PASSWORDLESS_AUTH=false` unless intentionally enabled.
- Limit `AGORA_ALLOWED_ORIGINS` to trusted app origins.
- Use HTTPS in front of the app and API.
- Run the Supabase migrations before enabling Supabase storage/auth.
- Confirm Supabase RLS policies with `npm run test:supabase`.
- Review Admin > Permissions for excess admins, workspace import access, and Operator client-data access.
- Review automation clients against `docs/api-agent-contract.md`; keep them read-only by default and require confirmation before destructive, external, payment, scheduler, import, or membership actions.
- Export a recovery bundle before major imports, migrations, or auth changes.

## AI And Data Handling

Agora's AI Operator should stay governed by explicit permissions, previews, rationale, audit logs, and undo paths where possible.

If you configure a bring-your-own-AI provider:

- Store provider keys only on the API server.
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
