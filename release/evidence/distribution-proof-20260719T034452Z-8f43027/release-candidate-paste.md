# Release Candidate Platform Evidence Paste-In

Generated for v0.1-beta at 2026-07-19T03:44:52.993Z.

| Channel | Required Proof Before External Beta | Status |
| --- | --- | --- |
| Source install | npm run setup -- --dry-run; npm run check; Start from a clean checkout or source archive.; Open the app locally and export a portable workspace bundle.; Record OS, Node version, and browser used. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
| Docker Compose | npm run setup -- --profile docker --dry-run; docker compose config; Boot app and API services from Docker Compose.; Confirm the API data volume persists after restart.; Record backup path or backup artifact. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
| Hosted web/API deployment | npm run verify:hosted; npm run rehearse:hosted; Confirm hosted app URL and API health endpoint.; Open Backend Health and record persistence, email, backup, and public-surface status.; Submit a feature request or invite email if enabled. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
| Offline PWA | npm run test:golden; Install from Android Chrome or a desktop browser.; Launch in airplane mode or with networking disabled.; Create a local edit and export a portable bundle while offline. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
| macOS desktop shell | npm run check; npm --prefix desktop run pack:mac; Pack on macOS and record signing/notarization status.; Launch with networking disabled.; Create a local edit and export a portable bundle. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
| Windows desktop shell | npm run check; npm --prefix desktop run pack:win; Pack on Windows and record signing status.; Install/uninstall or launch portable executable.; Launch with networking disabled, create a local edit, and export a portable bundle. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
| Agora CLI | npm run agora -- verify --quick; npm run agora -- package-check --json; Run quick verification from a fresh shell.; Inspect at least one portable bundle.; Generate demo links for the release demo URL. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
| Local MCP server | npm run test:mcp; Run the MCP integration test.; Confirm read-only default behavior.; Record whether write tools are enabled and why. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
| Portable workspace bundle | npm run test:fixtures; npm run agora -- bundle inspect tests/fixtures/portable-workspace-bundle.json; Validate portable workspace fixtures.; Preview an import before applying it.; Run a restore drill from the selected backup or bundle. | Pending evidence from release/evidence/distribution-proof-20260719T034452Z-8f43027 |
