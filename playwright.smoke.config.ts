import "./e2e/_helpers/private-artifacts";
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const OUTPUT_DIR = process.env.PW_OUTPUT_DIR ?? "./e2e/.artifacts-smoke";
const REPORT_DIR = process.env.PW_REPORT_DIR ?? "e2e/.report-smoke";
const JUNIT_FILE = process.env.PW_JUNIT_FILE ?? `${OUTPUT_DIR}/junit.xml`;

export default defineConfig({
  testDir: "./e2e/diagnostics",
  outputDir: OUTPUT_DIR,
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: [
    ["line"],
    ["junit", { outputFile: JUNIT_FILE }],
    ["html", { open: "never", outputFolder: REPORT_DIR }],
  ],
  use: {
    baseURL: BASE_URL,
    storageState:
      process.env.E2E_STORAGE_STATE_PATH ?? "e2e/.auth/storageState.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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
