// Starts the app for end-to-end tests: its own port (5180), its own empty
// local D1, and the Google/Elastic stub. Never touches the normal dev server
// (5173) or its data. Run by Playwright's webServer (playwright.config.ts).
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const PORT = 5180;
const STATE = ".wrangler/e2e-state";

// Fake credentials only (from the tracked example), pointed at this port.
writeFileSync(
  ".dev.vars.e2e",
  readFileSync(".dev.vars.example", "utf8").replaceAll("localhost:5173", `localhost:${PORT}`),
);
rmSync(STATE, { recursive: true, force: true });
execFileSync(
  "pnpm",
  ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", STATE],
  { stdio: ["ignore", "ignore", "inherit"] },
);

const vite = spawn("pnpm", ["exec", "vite", "--port", String(PORT), "--strictPort"], {
  stdio: "inherit",
  env: { ...process.env, DK_E2E: "1", CLOUDFLARE_ENV: "e2e" },
});
const stop = () => vite.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
vite.on("exit", (code) => process.exit(code ?? 0));
