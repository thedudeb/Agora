# AI And Data Policy

Agora's AI posture is intentionally conservative: AI can help plan, summarize, and propose recovery work, but project data should remain governed by permissions, previews, rationale, audit logs, and undo paths where possible.

## Current Default

- Agora works without an external AI provider.
- Local deterministic Operator flows can generate plans and previews from the current workspace state.
- External AI provider keys must stay on the API server.
- Client-provided AI base URLs are disabled by default with `AGORA_AI_ALLOW_CLIENT_BASE_URL=false`.
- If a trusted self-hosted deployment enables custom AI base URLs, `AGORA_AI_ALLOWED_BASE_URLS` must restrict them to approved HTTPS provider origins.

## Data Use Rules

- Treat project names, task titles, comments, files, client names, company data, approvals, and reports as customer workspace data.
- Only include customer workspace data in an AI request when the workspace owner has configured a provider and the user has permission for that context.
- Prefer the smallest useful context for each Operator action.
- Do not send service-role keys, API session tokens, invite tokens, client portal bearer links, SMTP secrets, payment credentials, webhook signing secrets, or raw backup files to an AI provider.
- Keep provider retention, training, residency, and subprocessors under the workspace operator's vendor review process.

## User Controls

AI and agentic actions should show:

- The records or project context used.
- The proposed change before it is applied.
- A plain-language rationale.
- The permission or role that allowed the action.
- The audit event or Operator ledger entry created after apply.
- The undo or recovery path when one exists.

High-impact actions require extra care. Imports, destructive changes, membership changes, external emails, webhooks, payment events, scheduler runs, and broad project rewrites should stay preview-first and confirmation-gated.

## Audit Evidence

The buyer-facing evidence for AI governance lives in:

- `SECURITY.md`: server-only AI key handling and deployment hardening.
- `docs/api-agent-contract.md`: agent permission scopes, confirmation expectations, and rationale requirements.
- `docs/project-autopilot.md`: preview, approval, audit, and undo model for recovery actions.
- `docs/trust-evidence-matrix.md`: the command and artifact matrix reviewers can follow.
- `src/app.js`: user-facing Operator, audit, permission, and undo surfaces.

Run `npm run trust` before enabling or changing an AI provider. Run `npm run security` before release.

## Provider Review Checklist

Before connecting an external provider:

- Confirm the provider contract allows the workspace's customer data category.
- Confirm whether prompts or outputs are retained, used for training, or reviewed by humans.
- Confirm data residency and subprocessors if the customer requires them.
- Confirm admins understand which project fields may be included in Operator context.
- Confirm `AGORA_AI_ALLOW_CLIENT_BASE_URL=false` unless there is a documented reason to enable a restricted allowlist.
- Confirm rollback, audit, and export evidence still work after provider configuration.
