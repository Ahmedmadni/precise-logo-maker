/**
 * Capacitor configuration for packaging Logo Grid Studio as an Android app.
 *
 * Android uses a locally bundled editor, including the font and vector assets.
 * Server-backed AI remains exclusive to the hosted website, not this APK.
 * See ANDROID.md for setup, signing, offline limits and device verification.
 */
const config = {
  appId: "app.lovable.logogridstudio",
  appName: "Logo Grid Studio",
  webDir: "mobile-dist",
  android: {
    backgroundColor: "#0d0f12",
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
