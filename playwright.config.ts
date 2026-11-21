import { defineConfig, devices } from "@playwright/test";

// User journeys in a real browser against the local app with the Google and
// Elastic stub (worker/dev/stub.ts). `pnpm test:e2e`; report: `pnpm exec
// playwright show-report`. Uses the installed Google Chrome, no download.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 3,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:5180",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Traces already carry a screencast; video would need an extra ffmpeg download.
    video: "off",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } }, grepInvert: /@mobile/ },
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel: "chrome" }, grep: /@mobile/ },
  ],
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://localhost:5180/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
