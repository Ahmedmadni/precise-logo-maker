import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// An offline-capable static SPA is required by Capacitor; the Lovable
// TanStack Start SSR deployment keeps using the existing vite.config.ts.
export default defineConfig({
  root: "mobile",
  publicDir: "../public",
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "../dist/mobile",
    emptyOutDir: true,
    sourcemap: false,
  },
});
