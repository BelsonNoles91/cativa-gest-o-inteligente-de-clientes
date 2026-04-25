import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e/visual",
  outputDir: "./e2e/.artifacts-preview-critical",
  snapshotDir: "./e2e/__screenshots__/visual",
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}/{arg}-{projectName}{ext}",
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: [["line"]],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
      timeout: 15_000,
    },
  },
  use: {
    baseURL: BASE_URL,
    storageState: "e2e/.auth/storageState.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
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
    {
      name: "iphone-14-landscape",
      use: {
        ...devices["iPhone 14 landscape"],
      },
    },
    {
      name: "iphone-se",
      use: {
        ...devices["iPhone SE"],
      },
    },
    {
      name: "android-360-portrait",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: false,
      },
    },
    {
      name: "ipad-portrait",
      use: {
        ...devices["iPad (gen 7)"],
      },
    },
  ],
});
