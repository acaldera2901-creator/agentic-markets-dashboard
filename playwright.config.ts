// playwright.config.ts (#REDESIGN-V3C F0) — configurazione minima.
// Due viewport (1440 desktop, 390 mobile), solo Chromium. Il dev server parte
// da solo su una porta dedicata; artefatti e scatti finiscono in scratchpad/
// (ignorata da git). Gli e2e stanno in e2e/, fuori dall'include di vitest.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3077;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./scratchpad/playwright/test-results",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-390", use: { ...devices["iPhone 14"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/dev/ds`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
