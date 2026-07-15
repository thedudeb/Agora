# Agora Frontend Architecture

Agora is still a single-page browser app, but the route code is split into focused classic-script modules. The scripts intentionally share the same global state and helper functions; load order is part of the contract and is guarded by `npm run test:modules`.

## App Shell

`index.html` owns the shell markup, dialogs, primary navigation, stylesheet links, and script loading order. If a new route module is added, load it after `src/app.js` and before `src/app-runtime.js`, then cache it in `sw.js`.

`src/boot.js` handles early boot concerns before the full app is loaded.

`src/styles.css` is the main design system and route styling surface. `src/project-launch.css` is scoped to the launch-flow experience.

## Core App Bundle

`src/app.js` owns shared state, data normalization, permissions, command execution, filters, routing wrappers, shared rendering helpers, dialog population, persistence, API sync helpers, and most routes that have not yet been split.

Keep route wrappers in `src/app.js` when route implementations move to another file. For example:

- `renderDataManagement()` delegates to `renderDataManagementRoute()`.
- `renderProjectPage()` delegates to `renderProjectPageRoute()`.
- `renderBoard()` delegates to `renderBoardRoute()`.

This keeps the central route registry stable while allowing large route implementations to move into smaller modules.

## Route Modules

`src/app-inbox.js` owns Inbox route rendering, clear-day handling, inbox work queues, and inbox-focused panels.

`src/app-recovery.js` owns Data Management and Recovery route rendering, portable import previews, recovery receipts, backup surfaces, and API sync/readiness copy for the data route.

`src/app-project-board.js` owns Project and Board route rendering, including project overview panels, project timeline/Gantt rendering, task detail subpanels used by the project/board flow, Kanban controls, board analytics, board empty states, and board render derivations.

## Runtime Wiring

`src/app-runtime.js` owns delegated event listeners, form handlers, route bootstrap, and post-render interaction wiring. It must load after all route modules so every delegated action can call the route and command functions it needs.

## Service Worker And Offline Contract

`sw.js` caches the app shell and versioned frontend modules. Any script URL change in `index.html` should be mirrored in `sw.js`, and the cache version should be bumped so offline users receive the new module.

## Guardrails

- `npm run test:modules` checks script order, service worker cache coverage, syntax-check coverage, and route wrapper contracts.
- `npm run test:product-surfaces` checks that split modules still expose important product surfaces.
- `npm run test:budgets` checks frontend module line and size budgets so the split files do not quietly balloon.
- `npm run code:quality` checks core quality invariants and file-size ceilings.
- Targeted golden paths exist for split routes, including `npm run test:golden:board`, `npm run test:golden:project`, `npm run test:golden:inbox`, and `npm run test:golden:recovery`.

## Change Rules

- Put shared data/state helpers in `src/app.js` unless a module fully owns the behavior.
- Put route-specific rendering in the route module that owns that surface.
- Put click/change/input wiring in `src/app-runtime.js`.
- When adding a new route module, update `index.html`, `sw.js`, `package.json`, `scripts/module-registry-regression.js`, and `scripts/product-surface-regression.js`.
- When changing a cached module URL, update the service worker cache entry and bump `CACHE_VERSION`.
