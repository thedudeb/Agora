# Agora Ecosystem

Agora's ecosystem has three layers:

- **Plugins**: local, declarative manifests that describe commands, connectors, views, importers, templates, automation packs, MCP tools, and settings panels.
- **MCP**: a guarded local server for power users and agent clients that need authenticated workspace context.
- **Marketplace artifacts**: portable template and automation JSON that can be shared without runtime code.

The machine-readable registry lives at [`../ecosystem/extension-points.json`](../ecosystem/extension-points.json). Validate it with:

```sh
npm run ecosystem
```

## Extension Points

| Key | Surface | Status |
| --- | --- | --- |
| `commands` | Command palette and UI actions | Manifest-ready |
| `connectors` | Settings > Integrations and API sync jobs | Manifest-ready |
| `views` | Future local iframe or native app panels | Planned |
| `importers` | Migration concierge and Data imports | Manifest-ready |
| `templates` | Templates and marketplace | Manifest-ready |
| `automationPacks` | Automations and marketplace | Manifest-ready |
| `mcpTools` | Local MCP server and agent clients | Guarded |
| `settingsPanels` | Settings extension registry | Planned |

## Contributor Path

1. Start with `plugins/example-importer/plugin.json` or `plugins/github-connector/plugin.json`.
2. Keep permissions least-privilege.
3. Prefer manifest-only contributions until runtime loading is intentionally enabled.
4. Validate with `npm run test:plugins` and `npm run ecosystem`.
5. Document any MCP-facing behavior in `docs/mcp-server.md` and `docs/api-agent-contract.md`.

## Product Story

The ecosystem goal is not to run arbitrary code early. It is to make Agora a trustworthy operating layer: importers, templates, automations, connectors, and agent tools can be proposed, reviewed, validated, and enabled deliberately by self-hosters.
