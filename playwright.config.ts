import { defineConfig } from "@playwright/test";

// Smoke: loader → home → demo play → how scroll (PRD §15). Uses a system Chromium if PW_CHROMIUM is set.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
