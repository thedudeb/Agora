# Agora Migration Tool

Agora's migration tool turns exports from other project-management tools into a reviewable Agora migration plan before anything is applied. The goal is to make switching feel safe: preview first, preserve source metadata, apply deliberately, and keep rollback data close.

## What It Supports Now

- Generic CSV task exports.
- Trello JSON board exports.
- Asana, Jira, Linear, and ClickUp CSV exports.
- Merge into an existing Agora workspace JSON.
- Create a new imported workspace snapshot.
- Preserve source metadata on imported projects, tasks, and comments.
- Record import history in the resulting workspace snapshot.
- CLI preview and apply commands for power users.

## Safety Model

The migration path is intentionally staged:

1. Parse the vendor export.
2. Normalize records into an `agora.migration-plan`.
3. Validate required project/task relationships.
4. Show counts, mapped fields, warnings, confidence, and sample tasks.
5. Apply only when the user chooses an output workspace.
6. Return rollback data from the original snapshot.

Imported records include `customFields.sourceSystem`, `sourceId`, `sourceUrl`, `importBatchId`, `importedAt`, and selected `rawFields` so support and future re-import logic can trace where each item came from.

## CLI Preview

Run the migration concierge first when moving real customer work:

```sh
npm run migrate:concierge -- trello-export.json \
  --source trello-json \
  --workspace tests/fixtures/workspace.json \
  --backup tests/fixtures/server-backups/agora-workspace-backup-demo.json
```

It prints confidence, counts, missing fields, warning/blocker status, rollback evidence, sample tasks, and the next safe apply command.

Preview a Trello board export:

```sh
npm run agora -- migrate preview tests/fixtures/trello-board.json --source trello-json
```

Preview a generic CSV export:

```sh
npm run agora -- migrate preview tasks.csv --source generic-csv
```

Preview source-specific CSV exports:

```sh
npm run agora -- migrate preview asana-export.csv --source asana-csv
npm run agora -- migrate preview jira-export.csv --source jira-csv
npm run agora -- migrate preview linear-export.csv --source linear-csv
npm run agora -- migrate preview clickup-export.csv --source clickup-csv
```

Get machine-readable output:

```sh
npm run agora -- migrate preview tasks.csv --source generic-csv --json
```

## CLI Apply

Only apply after the concierge or preview output has been reviewed and a backup is available.

Apply an export into an existing workspace JSON and write a new workspace file:

```sh
npm run agora -- migrate apply tasks.csv \
  --source generic-csv \
  --workspace tests/fixtures/workspace.json \
  --out imported-workspace.json
```

Create a new imported workspace instead of merging:

```sh
npm run agora -- migrate apply trello-export.json \
  --source trello-json \
  --workspace tests/fixtures/workspace.json \
  --mode new-workspace \
  --workspace-name "Trello Import" \
  --out trello-import-workspace.json
```

## CSV Fields

The generic, Asana, Jira, Linear, and ClickUp CSV adapters map common export headers:

| Agora field | Accepted headers |
| --- | --- |
| Task title | `title`, `task`, `name`, `task_name`, `card_name`, `item_name`, `summary` |
| Source id | `id`, `task_id`, `card_id`, `item_id`, `issue_key`, `key`, `identifier` |
| Project | `project`, `project_name`, `list`, `board`, `space`, `folder`, `group`, `section`, `workspace`, `team`, `team_name` |
| Assignee | `assignee`, `owner`, `person`, `assigned_to` |
| Status | `status`, `state`, `column`, `completed`, `complete`, `resolution` |
| Priority | `priority`, `importance` |
| Due date | `due`, `due_date`, `due_on`, `deadline`, `date`, `target_date` |
| Start date | `start`, `start_date`, `created`, `created_at` |
| Description | `description`, `notes`, `details`, `body` |
| Tags | `tags`, `labels` |

Rows without a task title are skipped and reported in the migration plan.

## Trello JSON Mapping

The Trello adapter maps:

- Board to one Agora project.
- Open cards to Agora tasks.
- Lists to normalized task status.
- Labels to tags.
- Members to assignee text.
- Due dates to task due dates.
- Card URL to `customFields.sourceUrl`.
- Card comments to Agora comments.

Closed Trello cards are skipped for now. Attachment metadata and file downloads are intentionally future work.

## Adapter Contract

New adapters should return normalized imported records:

```js
{
  rawRows: 10,
  mappedFields: ["title", "project", "status"],
  warnings: [],
  errors: [],
  projects: [{ id, sourceId, name, description }],
  tasks: [{ id, sourceId, projectSourceId, title, description, status, priority, dueDate, tags, rawFields }],
  comments: [{ id, taskSourceId, body, author, createdAt }]
}
```

`createMigrationPlan()` handles Agora ids, required field validation, source metadata, confidence, warnings, samples, and final plan shape.

## Next Adapters

Recommended order:

1. monday.com CSV.
2. Notion database CSV.
3. Linear JSON.
4. Asana/Jira/ClickUp richer vendor-specific edge cases.
5. OAuth/API connectors after file-based imports are stable.

Attachments should stay metadata-only until the import preview and rollback path is proven with real users.
