# Agora Plugins

Agora plugins are declarative extension packs for self-hosters and open-source contributors. The first contract is intentionally conservative: a plugin declares what it contributes, what permissions it needs, and how it should run. Agora can validate that contract before any runtime loading exists.

Validate all plugin manifests:

```sh
npm run test:plugins
```

Validate one plugin:

```sh
node scripts/agora-plugin-check.js plugins/example-importer
```

## Manifest

Each plugin lives in its own folder with a `plugin.json` file.

Required fields:

- `type`: must be `agora.plugin`.
- `manifestVersion`: currently `1`.
- `id`: lowercase slug, 3-64 characters.
- `name`, `version`, `description`.
- `permissions`: least-privilege Agora permissions requested by the plugin.
- `runtime`: `none`, `api`, or `iframe`.
- `contributes`: arrays of commands, views, importers, templates, automation packs, MCP tools, or settings panels.

Remote runtime URLs are not allowed in the first contract. Keep plugin assets local and reviewable.

See [example-importer/plugin.json](./example-importer/plugin.json).
