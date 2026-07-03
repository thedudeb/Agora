# Packaging

Agora should be easy to evaluate, self-host, install offline, and move away from. Packaging is tracked in [`packaging/release-manifest.json`](../packaging/release-manifest.json), then verified with:

```sh
npm run package:check
npm run agora -- package-check
npm run agora -- package-check --json
```

## Release Channels

| Channel | Artifact | Best For | Primary Check |
| --- | --- | --- | --- |
| Source install | Git checkout or source archive | Developers and self-hosters | `npm run setup -- --dry-run` |
| Docker Compose | App/API containers plus persistent volume | Small teams and quick servers | `npm run setup -- --profile docker --dry-run` |
| Hosted web/API | Static app plus long-running API | Production teams | `npm run verify:hosted` |
| Offline PWA | Browser-installable app shell | iOS, Android, Chromebook, desktop browser | `npm run test:golden` |
| macOS desktop | DMG and ZIP | Offline-capable native desktop users | `npm --prefix desktop run pack:mac` |
| Windows desktop | NSIS installer and portable executable | Offline-capable native desktop users | `npm --prefix desktop run pack:win` |
| Portable data | Workspace JSON/CSV/Markdown bundle | Migration, backup, exit, and restore | `npm run test:fixtures` |

## Release Gate

Before publishing a release candidate:

```sh
npm run package:check
npm run trust
npm run verify:hosted
npm run verify:upgrade -- --allow-missing-backup
npm run qa
```

Use a real backup path instead of `--allow-missing-backup` for production upgrades. For desktop releases, run the platform pack command on the target OS, then test launch with Wi-Fi disabled.

## Packaging Rules

- Every channel must declare required files and verification commands in `packaging/release-manifest.json`.
- Docker keeps web and API processes separate, with API data and backups in a named volume.
- PWA packaging must keep the manifest, service worker, offline page, icons, and screenshots together.
- Desktop packaging must bundle the local app shell and avoid packaged secrets.
- Hosted packaging must keep secrets on the API service, never in the static app.
- Portable data packaging must remain fixture-backed so exports can be inspected outside Agora.

If a release channel becomes aspirational instead of shippable, mark it clearly in the manifest or remove it from release notes until the check is meaningful again.
