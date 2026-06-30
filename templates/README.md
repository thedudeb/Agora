# Agora Template Marketplace

This folder holds shareable Agora project-template packs. Each template can be imported from the Templates page by pasting the JSON into the marketplace import box.

## Format

Use either a single template object or an export wrapper:

```json
{
  "type": "agora.project-template",
  "exportVersion": 1,
  "template": {
    "id": "community-example",
    "name": "Community Example",
    "category": "Community",
    "description": "A reusable project workflow.",
    "owner": "mara",
    "durationDays": 14,
    "tasks": [],
    "milestones": [],
    "docs": [],
    "intakeForm": {
      "title": "Community Example Intake",
      "assignee": "mara",
      "description": "Collect requests for this workflow."
    }
  }
}
```

Task `key` values are used by `blockedBy` and milestone `taskKeys`, so keep them short, stable, and unique.
