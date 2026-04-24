import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e/diagnostics",
  outputDir: "./e2e/.artifacts-smoke",
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: [["line"]],
  use: {
    baseURL: BASE_URL,
    storageState: "e2e/.auth/storageState.json",
    trace: "off",
    screenshot: "off",
    timezoneId: "America/Sao_Paulo",
    locale: "pt-BR",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4173",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "iphone-14-portrait",
      use: {
        ...devices["iPhone 14"],
      },
    },
  ],
});
