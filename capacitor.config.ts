/**
 * Capacitor configuration for packaging Logo Grid Studio as an Android app.
 *
 * Hosted HTTPS mode preserves TanStack server functions, including AI.
 * See ANDROID.md for setup, signing and device verification.
 */
const config = {
  appId: "app.lovable.logogridstudio",
  appName: "Logo Grid Studio",
  webDir: "mobile-shell",
  android: {
    backgroundColor: "#0d0f12",
    allowMixedContent: false,
  },
  server: {
    url: "https://precise-logo-maker.lovable.app",
    androidScheme: "https",
  },
};

export default config;
