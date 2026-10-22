import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ahmedmadni.logogridstudio",
  appName: "Logo Grid Studio",
  webDir: "dist/mobile",
  android: {
    backgroundColor: "#0d0f12",
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
