# Disaster Recovery Drill

Agora server backups are only useful if an operator can prove they restore cleanly. Run this drill before major upgrades, after changing backup storage, and during quarterly production-readiness checks.

## Run The Drill

Create a fresh server backup first:

```sh
curl -X POST https://your-api.example.com/api/backups/run \
  -H "Authorization: Bearer <admin-or-manager-session>"
```

Then run the local drill against the downloaded or mounted backup file:

```sh
npm run drill:recovery -- --backup /var/lib/agora/backups/agora-workspace-backup-latest.json
```

Power users can use the CLI wrapper:

```sh
npm run agora -- recovery-drill --backup /var/lib/agora/backups/agora-workspace-backup-latest.json
```

For repository validation, use the fixture:

```sh
npm run drill:recovery -- --fixture
```

## What It Proves

The drill:

- Reads and parses the server backup JSON.
- Verifies the backup envelope, version, workspace identity, and snapshot.
- Verifies count evidence for companies, projects, tasks, users, memberships, and audit events.
- Writes an isolated restored `workspace.json` into a temporary directory.
- Reads the restored workspace back and confirms identity and counts match the backup.

The script does not write to production storage, Supabase, or the app data directory unless you explicitly pass `--out-dir`.

## When To Block A Release

Block the upgrade or rollback attempt when the drill cannot parse the backup, the restored workspace identity does not match, or restored counts differ from the backup evidence. Create a fresh backup, rerun `npm run verify:upgrade`, and rerun the drill before continuing.
