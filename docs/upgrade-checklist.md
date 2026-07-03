# Upgrade Checklist

Use this checklist before upgrading a hosted Agora deployment, applying Supabase migrations, switching storage/auth drivers, or rolling a new API build to a real team.

## Pre-Upgrade Gate

Run the upgrade safety check from the release commit:

```sh
npm run verify:upgrade
```

For a one-off backup file, pass it directly:

```sh
npm run verify:upgrade -- --backup /var/lib/agora/backups/agora-workspace-backup-latest.json
```

The same gate is available through the power-user CLI:

```sh
npm run agora -- upgrade check --backup /var/lib/agora/backups/agora-workspace-backup-latest.json
```

The check validates:

- `package.json` has release version metadata.
- Required Supabase migration files `001`, `002`, and `003` are present in the release.
- Server backups are enabled and retention is at least 3 files.
- A latest or explicit backup file exists, is parseable, uses the Agora server-backup envelope, includes workspace identity, includes counts, and is fresh enough for the configured `--max-age-hours` window.

For local documentation or CI dry-runs only, use:

```sh
npm run verify:upgrade -- --allow-missing-backup
```

Do not use `--allow-missing-backup` for production upgrades.

## Operator Sequence

1. Announce the maintenance window and pause high-risk imports or bulk edits.
2. Run `POST /api/backups/run` or click Run Server Backup from Backend Health.
3. Confirm Backend Health reports the new backup and no failing production gates.
4. Run `npm run verify:upgrade`.
5. Run any pending Supabase migrations in numeric order.
6. Deploy the API and static app release.
7. Run `npm run verify:hosted`, `npm run rehearse:hosted`, and refresh Backend Health.
8. Test sign-in, workspace load, task save, file access, feature request intake, and one rollbackable automation preview.
9. Keep the previous deploy available until the first real team session is stable.

## Rollback Trigger

Rollback immediately if auth, workspace load, structured records, file access, or migrations behave unexpectedly after deploy. Restore from the latest verified server backup or Supabase backup, redeploy the previous API build, then rerun `npm run verify:upgrade` before trying again.
