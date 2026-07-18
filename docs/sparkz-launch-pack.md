# Sparkz Creator Launch Pack

The Sparkz Creator Launch Pack is a portable Agora workflow for creator projects that begin with collectables, backing, boost participation, and community momentum before any optional token decision.

## Product Boundary

Agora coordinates the work, evidence, approvals, risks, and decisions around a Sparkz launch. It does not deploy tokens, custody wallets or keys, execute fee-split transactions, calculate returns, or act as the canonical ledger for balances and votes.

External systems remain responsible for financial and on-chain execution. Agora may store a reviewed external reference, transaction identifier, or contract address as evidence after the external action occurs.

## Included Workflow

- Creator spark intake and project review.
- Tokenless experience design for collectables, backing, boost participation, and perks.
- Creator assets and feature-led public messaging.
- Collaborator fee-split intent with rationale and approvals.
- Tokenless launch and momentum review.
- A human-reviewed go, wait, or never-token graduation decision.
- An external execution handoff when graduation is approved.

The matching Sparkz Launch Control automation pack raises blocked Sparkz-tagged work and drafts readiness updates for Sparkz-tagged work due soon. Both rules are tag-scoped so installing the pack cannot act on unrelated workspace approvals or milestones.

The public-language task is a workflow checklist, not legal advice. Teams remain responsible for obtaining qualified legal review appropriate to their jurisdiction and launch model.

## ICM Context Bridge

Project Memory can preview a public ICM `llm.txt` through the authenticated Agora API. The bridge:

- Accepts only an ICM hash or the public HTTPS `useicm.com/api/objects/<hash>/llm.txt` path.
- Constructs the provider URL server-side and rejects other hosts, credentials, ports, queries, fragments, and redirects.
- Applies a timeout and a 12 KB response limit.
- Returns a SHA-256 content hash, retrieval timestamp, canonical source URL, and read-only/untrusted labels.
- Keeps the preview temporary until a user chooses Capture into Project Memory.
- Deduplicates an exact ICM object/content-hash combination after capture.
- Never accepts an ICM owner key and never writes back to ICM.

Imported text is reference data, not executable instruction. Project Memory extraction remains preview-first, and every proposed task, risk, decision, approval, or date change still requires human review before application.

## Pilot Scorecard

Use one real creator launch before adding a deeper provider adapter. Record:

- Time from spark intake to tokenless launch.
- Unowned, overdue, or blocked launch work.
- Approval turnaround time.
- Missing dependencies or review evidence.
- Time required to prepare creator and community updates.
- Whether the graduation decision is supported by inspectable evidence.
- Whether any operator tried to move financial or on-chain execution into Agora.

Build a dedicated Sparkz adapter only when the pilot identifies repeated manual data transfer that a read-only or signed-webhook integration can safely remove.
