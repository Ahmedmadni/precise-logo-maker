/**
 * Capacitor configuration for packaging Logo Grid Studio as an Android app.
 *
 * Export steps (run locally, outside Lovable):
 *   1. bun add -d @capacitor/cli && bun add @capacitor/core @capacitor/android
 *   2. bun run build   (produces the static client bundle)
 *   3. bunx cap add android
 *   4. bunx cap sync android && bunx cap open android
 *
 * `webDir` must point at the built client output of the current Vite build.
 */
const config = {
  appId: "app.lovable.logogridstudio",
  appName: "Logo Grid Studio",
  webDir: "dist/client",
  android: {
    backgroundColor: "#0d0f12",
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
