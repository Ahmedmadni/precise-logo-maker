import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Independent Android WebView bundle. We deliberately do NOT build TanStack
 * Start SSR/server functions into this local-first entry. The hosted web app
 * continues to use vite.config.ts unchanged.
 */
export default defineConfig({
  root: resolve(process.cwd(), "mobile"),
  publicDir: resolve(process.cwd(), "public"),
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: resolve(process.cwd(), "mobile-dist"),
    emptyOutDir: true,
    target: "es2022",
  },
});