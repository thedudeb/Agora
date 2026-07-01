# Portable Workspace Bundles

Agora portable bundles are plain JSON exports designed for inspection, backup, migration, and self-hosted restore flows. They avoid proprietary archives on purpose: every file in the bundle is represented as readable JSON, CSV, or Markdown text.

## Export Flow

Open `Data` and use `Portable workspace OS > Download Bundle`.

The downloaded file is named like:

```text
acme-studio-portable-bundle-2026-07-01.json
```

You can also download only the Markdown manifest with `Download Manifest`.

Power users can inspect a saved bundle from the CLI:

```sh
npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json
```

## Import Flow

Open `Data > Portable restore > Import bundle`.

Paste either:

- A full `agora.portable-workspace` bundle.
- The `workspace.json` content from a bundle.

Choose `Preview Bundle` before restoring. The preview shows file count, project count, task count, automations, templates, and Operator ledger entries. Then choose:

- `Import as New Workspace` to keep the current workspace untouched.
- `Replace Current Workspace` to restore over the active workspace after Agora creates a local backup.

## Bundle Shape

```json
{
  "type": "agora.portable-workspace",
  "exportVersion": 1,
  "exportedAt": "2026-07-01T00:00:00.000Z",
  "workspace": {
    "id": "workspace-acme",
    "name": "Acme Studio",
    "slug": "acme-studio"
  },
  "counts": {
    "companies": 3,
    "projects": 7,
    "tasks": 42,
    "automations": 6,
    "templates": 10,
    "operatorActions": 4
  },
  "manifest": {},
  "files": [
    {
      "path": "workspace.json",
      "kind": "json",
      "content": "{...}",
      "size": 12345
    }
  ]
}
```

## Included Files

- `README.md`: Human-readable export summary and restore instructions.
- `workspace.json`: Full Agora workspace snapshot used for restore.
- `tasks.csv`: Flat task export for spreadsheets or external tools.
- `time.csv`: Employee time-tracking export.
- `automations.json`: Local automation rules.
- `templates.json`: Project template library export.
- `operator-ledger.json`: AI Operator context, trust state, visible context, generated docs, and action ledger.
- `audit-log.md`: Recent local audit events.
- `projects/*.md`: Per-project Markdown summaries for active projects.

## Safety Notes

- Restore uses `workspace.json`; other files are included for portability, inspection, and migration.
- Replacing the current workspace creates a local backup first.
- API secrets, Supabase service-role keys, and AI provider keys are not exported by the browser app.
- Operator context respects the current Operator permission settings when exported.
- File records are metadata-only unless the API storage layer is used to download the actual file content separately.

## Automation Pack Shape

Automation packs are separate JSON files that can be imported from `Automations > Open automation marketplace`.

```json
{
  "type": "agora.automation-pack",
  "exportVersion": 1,
  "exportedAt": "2026-07-01T00:00:00.000Z",
  "pack": {
    "id": "automation-pack-client-delivery",
    "name": "Client Delivery",
    "category": "Agency",
    "creatorName": "Agora Community",
    "license": "MIT-style workflow pack",
    "description": "Workflow rules for client-facing delivery.",
    "rules": [
      {
        "name": "Chase pending client approval",
        "triggerKind": "approval_pending",
        "conditionKind": "company",
        "conditionValue": "Client",
        "actionKind": "create_task",
        "actionTarget": "approval follow-up",
        "enabled": true
      }
    ]
  }
}
```

Imported packs are normalized before installation, duplicate rules from the same pack are skipped, and imported rules keep creator/license metadata.

Before sharing an automation pack, validate it with:

```sh
npm run agora -- marketplace validate tests/fixtures/automation-pack.json
```
