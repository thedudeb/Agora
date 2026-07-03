# Agora Plugin Architecture

Agora's plugin path starts with a safe manifest contract before dynamic runtime loading. This lets contributors publish extension ideas that can be reviewed, validated, imported, and eventually enabled by self-hosters.

## Goals

- Keep plugins local-first and inspectable.
- Require least-privilege permissions up front.
- Support commands, connectors, views, importers, templates, automation packs, MCP tools, and settings panels.
- Make plugin validation part of release QA.
- Avoid remote code execution in the first contract.

## Manifest Contract

Each plugin folder contains `plugin.json`:

```json
{
  "type": "agora.plugin",
  "manifestVersion": 1,
  "id": "example-importer",
  "name": "Example Importer",
  "version": "0.1.0",
  "description": "Reference plugin manifest.",
  "permissions": ["workspace:read", "projects:write", "tasks:write"],
  "runtime": { "mode": "none" },
  "contributes": {
    "commands": [],
    "connectors": [],
    "views": [],
    "importers": [],
    "templates": [],
    "automationPacks": [],
    "mcpTools": [],
    "settingsPanels": []
  }
}
```

`runtime.mode` can be:

- `none`: declarative plugin only.
- `api`: plugin uses documented Agora API/MCP surfaces from outside the app runtime.
- `iframe`: future local asset sandbox. The first validator only allows local entries, not remote URLs.

## Validation

Run:

```sh
npm run test:plugins
```

The validator checks required fields, version format, supported permissions, runtime mode, local iframe entries, contribution keys, and whether the plugin contributes at least one extension point.

The ecosystem registry in [`../ecosystem/extension-points.json`](../ecosystem/extension-points.json) keeps the plugin and MCP extension story machine-readable. Run `npm run ecosystem` to confirm documented extension points, example plugins, and MCP surfaces stay aligned.

Connector contributions are declarative provider bridges. They should name the provider, supported sync modes, subscribed events, required external scopes, and the API or MCP handoff that will perform the real sync. Agora can list disabled connector manifests in Settings > Integrations, then register them as active connectors once an admin enables the plugin.

Machine-readable output:

```sh
node scripts/agora-plugin-check.js plugins --json
```

## Security Model

- Plugins request permissions, but Agora still enforces server-side roles and scopes.
- Plugins should be read-only by default unless a user explicitly enables write behavior.
- Remote scripts and remote iframe entries are out of scope for the first plugin contract.
- Plugin import should remain previewable, auditable, and reversible.
- MCP tool contributions should follow `docs/api-agent-contract.md` and `docs/mcp-server.md`.

## Next Runtime Steps

1. Add a Plugin settings page that lists validated local plugin manifests.
2. Let users enable or disable each contribution.
3. Register declarative commands/importers/templates from enabled plugins.
4. Add a local iframe sandbox only after permission prompts, CSP, and storage boundaries are settled.
5. Add signed plugin packs for marketplace distribution.
