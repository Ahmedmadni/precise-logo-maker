# Android build and mobile interface

The desktop/web deployment remains **TanStack Start** (run `npm run build`).
Android must use a **static Vite SPA** (`npm run build:mobile`). Do not point
Capacitor at `dist/client`: it is only the browser half of the SSR application.

## Local Android development

Prerequisites: Node.js 22+, Android Studio, Android SDK, JDK supplied by Android Studio.
Capacitor v8 requires Android 7/API 24 or later.

```bash
npm install
npm run test
npm run typecheck
npm run build:mobile
npx cap add android           # once, only if android/ has not been generated
npm run android:sync          # rebuild static files, then copy + sync plugins
npm run android:open          # opens Android Studio
```

In Android Studio select a device/emulator and Run. To create a debug APK:
`cd android && ./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`).
For Play Store releases create a signing key and produce a **signed AAB**;
never commit passwords, keystores or release credentials.

A GitHub Actions workflow generates a **debug APK artifact** on PR/push.
Install debug APKs only on trusted test devices, and never market them as
signed production releases. Before Play Store release verify privacy policy,
app icon, package ID ownership and device screenshots.

## Shared behavior

- The regular site keeps its existing server-powered AI assistance.
- The Android SPA provides offline geometric drawing, grids, selection,
  touch pinch/pan, project loading/saving, and SVG/PNG exports.
- AI server functions are deliberately **not** included in the offline app:
  a secure authenticated API would be required, not a secret in the APK.
- On Android, exported projects/SVG/PNG open a native share/save chooser
  from a temporary cache file. On the web, they download normally.
- Artboards persist in local storage on that device. Sync/cloud backup and
  cross-device accounts are not implemented.
- The UI handles safe areas, landscape/portrait and tablet layouts, but needs
  real-device verification for vendor WebViews, memory pressure and 4096px exports.

## Quality gate

```bash
npm run typecheck
npm run test
npm run lint
npm run build:mobile
npm run build
```

The Android debug workflow creates a clean platform directory on CI, so
`android/` is generated and is intentionally not committed.
