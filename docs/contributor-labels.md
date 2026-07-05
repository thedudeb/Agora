# Contributor Labels

Use these labels to make the issue tracker readable for new contributors and maintainers.

## Starter Labels

| Label | Use For | Review Expectation |
| --- | --- | --- |
| `good first issue` | Small, well-scoped fixes with clear acceptance criteria. | Maintainer can review without deep product context. |
| `help wanted` | Useful work that is scoped but not necessarily tiny. | Issue includes owner, route/doc/script, and verification command. |
| `needs reproduction` | Bugs without a reliable repro. | Contributor adds steps, data shape, browser, logs, or fixture. |
| `starter:docs` | Install, release, trust, demo, migration, or contributor docs. | Check links and commands. |
| `starter:ui-polish` | Layout, empty state, copy, mobile, screenshot, or accessibility polish. | Include screenshot or viewport note. |
| `starter:fixture` | Safe sample exports, template packs, automation packs, or importer edge cases. | No real customer data; include expected mapping. |

## Product Area Labels

| Label | Area |
| --- | --- |
| `demo` | Acme demo, hosted demo, screenshots, video, launch assets. |
| `release` | Release candidate, packaging, QA, distribution, upgrade, rollback. |
| `trust` | Security, privacy, auditability, AI data policy, evidence. |
| `migration` | Importers, concierge, fixtures, rollback, mapping reports. |
| `template` | Project templates and marketplace template metadata. |
| `automation` | Automation builder, packs, previews, rollbackable runs. |
| `plugin` | Plugin manifest contracts and examples. |
| `mcp` | MCP server, tools, resources, client docs, security. |
| `offline` | PWA, desktop, mobile, local persistence, recovery offline. |
| `collaboration` | Presence, comments, chat, notifications, permissions, conflicts. |

## Priority Labels

| Label | Definition |
| --- | --- |
| `P0` | Security issue, data loss, auth bypass, broken release gate, or app cannot boot. |
| `P1` | Blocks beta users from completing a core workflow. |
| `P2` | Important polish or workflow gap that should be fixed before broad launch. |
| `P3` | Nice-to-have improvement, research, or future expansion. |

## Maintainer Triage

Every issue should have:

- one product area label;
- one priority label when it affects user behavior;
- one contribution label when it is suitable for outside help;
- a verification command or manual acceptance note.
