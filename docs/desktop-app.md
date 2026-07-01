# Windows And macOS Desktop App

Agora now has an optional Electron desktop shell for Windows and macOS. The root web app stays dependency-free; desktop dependencies live under `desktop/`.

## What The Desktop Shell Does

- Opens Agora in a native desktop window.
- Serves the existing web app through a local ephemeral `127.0.0.1` server so browser APIs and relative assets behave like the normal app.
- Keeps Node.js disabled in the renderer.
- Uses context isolation and a minimal preload bridge.
- Opens external links in the system browser.
- Supports local-only work by default, with the same optional API/Supabase connection flow as the web app.

## Local Desktop Development

From the repo root:

```sh
cd desktop
npm install
npm run dev
```

The desktop app loads the same Agora UI and local browser storage model. Start the API separately when you want API sync, Supabase auth/storage, marketplace publishing, or server-side AI:

```sh
npm run dev:api
```

Then connect from Settings inside the desktop app.

## Build macOS

Run on macOS:

```sh
cd desktop
npm install
npm run pack:mac
```

Outputs are written to `desktop/release/`.

Production distribution still needs signing and notarization. Do not distribute unsigned builds as a final release.

## Build Windows

Run on Windows for the cleanest result:

```sh
cd desktop
npm install
npm run pack:win
```

Outputs are written to `desktop/release/`.

Production distribution should use code signing. The first public Windows build should also test installation, portable mode, uninstall behavior, local storage persistence, API connection, and file download/upload.

## API And Storage

The desktop shell does not bundle the Agora API. Users can:

- Run `npm run dev:api` locally from the repo.
- Point Settings to a hosted Agora API.
- Use local-only browser storage inside the desktop shell.

Keep `SUPABASE_SERVICE_ROLE_KEY`, AI provider keys, SMTP secrets, Stripe keys, and x402 credentials on the API server. Never package them into the desktop app.

## Release Checklist

Before shipping a desktop build:

- Run `npm run check` from the repo root.
- Run `npm run test:api` if API behavior changed.
- Run `npm run test:fixtures` if import/export behavior changed.
- Verify app launch on a clean OS user profile.
- Verify local storage persists after restart.
- Verify Settings can connect to a local or hosted API.
- Verify external links open in the system browser.
- Verify no secrets are visible in packaged resources.
- Verify macOS signing/notarization or Windows code signing before public distribution.

## Future Work

- App icons in `.icns` and `.ico` formats.
- Auto-update strategy.
- Signed release pipeline.
- Optional bundled local API mode.
- Native file-open/save affordances for portable workspace exports.
- Deep links for invite acceptance and task/project routes.
