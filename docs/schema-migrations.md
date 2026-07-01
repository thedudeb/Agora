# Workspace Schema Migrations

Agora workspaces are local-first and portable, so old browser snapshots and exported bundles must keep loading as the app evolves.

## Current Versions

- Workspace schema: `2`
- Portable export format: `1`

`exportVersion` describes the portable bundle envelope. `schemaVersion` describes the workspace data inside `workspace.json`, browser local storage, API snapshots, and local backups.

## Migration Contract

- Run every loaded, restored, imported, or API-provided workspace through `migrateWorkspaceSnapshot()` before `normalizeState()`.
- Keep migrations additive and deterministic.
- Record applied upgrades in `migrationHistory`.
- Never require a network connection to migrate local data.
- Preserve unknown fields unless they are unsafe or clearly obsolete.
- Keep portable bundles restoreable through `workspace.json`.

## Version 2

Version 2 adds explicit schema metadata, import history defaults, migration history, and offline storage contract metadata. It also upgrades older task-embedded comments, legacy boolean task status fields, archived project/task flags, and missing filter/theme defaults.

## Release Checklist

- Add a migration function before changing persisted workspace shape.
- Test an old portable bundle and an old `workspace.json` import.
- Open `Data > Workspace schema` and confirm the migration history is understandable.
- Export a fresh portable bundle after the migration.
