# Contributor Path

Agora should be easy to help without becoming a maintainer first. This path gives contributors a clear first move and gives maintainers a consistent review bar.

## Who We Want To Help

- Project managers and operators who can describe real workflows.
- Designers and frontend contributors who can make dense product surfaces easier to scan.
- Self-hosters who can test install, backup, upgrade, and offline paths.
- Template and automation authors who can turn repeatable work into portable packs.
- Security-minded contributors who can improve trust evidence, permissions, diagnostics, and release gates.

## First Contribution Lanes

| Lane | Good First Contribution | Verification |
| --- | --- | --- |
| Docs | Clarify install, hosted demo, migration, trust, or release steps. | Read the linked command path end to end. |
| UI polish | Fix text overlap, mobile layout, empty states, or route copy. | `npm run check`; screenshot before/after when visual. |
| Template pack | Add a reusable client-work, operations, or team workflow. | Export/import the pack and document expected generated work. |
| Automation pack | Add a previewable rule pack with clear safety language. | Validate with existing automation pack checks or manual preview. |
| Migration fixture | Add anonymized Asana, Trello, Jira, Linear, ClickUp, CSV, or JSON edge cases. | `npm run test:importers`. |
| Trust/release | Improve release checks, evidence docs, security guidance, or recovery proof. | Relevant gate plus `npm run release:check`. |
| Plugin/MCP | Propose manifest contracts, examples, or read-only tools first. | `npm run test:plugins` or `npm run test:mcp`. |

## Labels

Use [`docs/contributor-labels.md`](./contributor-labels.md) for the maintained label map. The important starter labels are:

- `good first issue`
- `help wanted`
- `docs`
- `template`
- `automation`
- `migration`
- `security`
- `release`
- `plugin`
- `mcp`

## Review Criteria

Before maintainers merge:

- The change has a clear user or operator benefit.
- The change preserves no ads, no trackers, exportability, and self-hosting.
- Sensitive surfaces respect roles, permissions, audit logs, and server-only secrets.
- Generated data remains portable and inspectable.
- Docs and commands match the changed behavior.
- The PR lists the checks that actually ran.

## Fixture Rules

Migration and template fixtures must be safe to commit:

- no real customer names, emails, tokens, private URLs, or proprietary attachments;
- small enough to review in a PR;
- documented source shape and expected mapping;
- portable rollback or restore guidance when the fixture touches workspace state.

Use [`docs/starter-issues.md`](./starter-issues.md) for concrete first issue ideas.
