# Agora Mobile Strategy

Agora should ship mobile value in layers. The current recommendation is to make the web app installable and touch-friendly first, then move to a dedicated app only when the product needs native capabilities that the PWA cannot comfortably provide.

## 1. PWA first

The PWA path keeps Agora on one codebase while adding mobile-app behavior:

- Install from supported browsers.
- Launch in standalone mode.
- Cache the app shell for offline reloads, including iOS home-screen launches.
- Keep local workspace data available through browser storage without requiring sign-in.
- Queue failed API writes locally and retry them when the network returns.
- Avoid runtime CDN dependencies so the installed app can open with no internet connection.
- Prepare notification permission and service worker hooks.
- Preserve fast iteration while the product model is still changing.

Current iOS and Android coverage is the installable PWA. There is no native iOS or Android wrapper in this repo yet, so any future app-store build should preserve the same offline contract: bundled app assets, local workspace persistence, queued API sync, import/export while offline, and no required hosted service to launch.

Android installability should be validated against Chrome's PWA path: manifest PNG icons, maskable launcher support, mobile screenshots, standalone launch, cached app shell, local workspace edits, offline export/import, and queued API sync after reconnect.

## 2. Mobile task workflows

The highest-value mobile use cases are short actions:

- Open assigned work.
- Plan a task for Today.
- Mark a task done.
- Triage inbox alerts.
- Log quick time.
- Review project status on tablet.
- Switch between comfortable and compact density when the same workspace is used across phone, tablet, and desktop.

These should stay available in the PWA before a native app is considered.

## 3. Notification groundwork

Agora now has the browser-side pieces needed for notification readiness:

- Service worker registration.
- Notification permission UI.
- Test notification action.
- Notification click routing back into the app.

The next backend step is a durable push subscription model tied to users and workspace memberships.

## 4. Themes and density

Mobile usability should stay tied to the workspace theme system rather than a separate mobile skin. Theme presets control the accent and surface palette, while density lets teams pick a more compact task-heavy layout for tablets or a more comfortable layout for touch-heavy phone use.

## 5. Dedicated app decision

Move beyond the PWA when at least two of these are true:

- Teams need reliable push notifications across iOS and Android.
- Native background sync, file provider, or share-sheet capture becomes core.
- File upload/share-sheet capture becomes a primary use case.
- Mobile usage is high enough to justify app-store release work.
- Native integrations become important, such as calendar, contacts, widgets, or biometric unlock.

Recommended paths:

- **Capacitor**: best first dedicated-app wrapper if the web app remains the primary product.
- **Expo / React Native**: best if mobile becomes a peer product with deeper native interaction.
- **Swift/Kotlin**: only if Agora needs platform-specific performance or native-only capabilities.

## 6. Offline acceptance checks

Before calling the mobile experience shippable:

- Install Agora to the iOS home screen and Android home screen from Chrome.
- Load a workspace once, then disable Wi-Fi and cellular data or turn on airplane mode.
- Confirm Dashboard, Today, Board, List, Calendar, Inbox, Settings, Data import, and JSON export open without a network.
- Confirm `Settings > Sync`, `Data`, or `Mobile App` shows the Desktop and mobile readiness checklist passing.
- Create or edit a project/task while offline and confirm it persists after closing and reopening.
- Re-enable the network and confirm any queued API sync retries from Settings.

Android-specific pass:

- Confirm the launcher icon uses the PNG maskable icon and does not crop the mark.
- Confirm the install prompt shows Agora screenshots and app name correctly.
- Confirm shortcuts for Today, Inbox, and New Task open the installed app.
- Confirm Android Chrome can export a workspace JSON file while offline.
