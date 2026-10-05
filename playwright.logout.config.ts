import "./e2e/_helpers/private-artifacts";
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const OUTPUT_DIR = process.env.PW_OUTPUT_DIR ?? "./e2e/.artifacts-logout-protection";
const REPORT_DIR = process.env.PW_REPORT_DIR ?? "e2e/.report-logout-protection";
const JUNIT_FILE = process.env.PW_JUNIT_FILE ?? `${OUTPUT_DIR}/junit.xml`;

export default defineConfig({
  testDir: "./e2e/diagnostics",
  outputDir: OUTPUT_DIR,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
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
    storageState: { cookies: [], origins: [] },
    trace: "off",
    screenshot: "off",
    video: "off",
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
    { name: "iphone-14-portrait", use: { ...devices["iPhone 14"] } },
    { name: "iphone-14-landscape", use: { ...devices["iPhone 14 landscape"] } },
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
    {
      name: "android-360-portrait",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
      },
    },
    { name: "ipad-portrait", use: { ...devices["iPad (gen 7)"] } },
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "desktop-firefox",
      use: { browserName: "firefox", viewport: { width: 1280, height: 800 } },
    },
  ],
});
