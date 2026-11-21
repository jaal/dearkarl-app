import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // End-to-end runs (pnpm test:e2e) get their own local D1, so they never
    // touch the data you click through by hand on the normal dev server.
    cloudflare(
      process.env.DK_E2E
        ? { persistState: { path: ".wrangler/e2e-state" } }
        : {},
    ),
  ],
  base: "./",
  build: { outDir: "dist", sourcemap: true },
});
