import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8080";
const OUTPUT_DIR = process.env.PW_OUTPUT_DIR ?? "./e2e/.artifacts-layout";
const REPORT_DIR = process.env.PW_REPORT_DIR ?? "e2e/.report-layout";

export default defineConfig({
  testDir: "./e2e/visual",
  testMatch: ["**/layout-matrix.spec.ts", "**/reflow-text-spacing.spec.ts"],
  outputDir: OUTPUT_DIR,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : 2,
  timeout: 60_000,
  reporter: [
    ["line"],
    ["junit", { outputFile: `${OUTPUT_DIR}/junit.xml` }],
    ["html", { open: "never", outputFolder: REPORT_DIR }],
  ],
  use: {
    baseURL: BASE_URL,
    storageState: process.env.E2E_STORAGE_STATE_PATH ?? "e2e/.auth/storageState.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    timezoneId: "America/Sao_Paulo",
    locale: "pt-BR",
    colorScheme: "light",
    reducedMotion: "reduce",
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 8080",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "desktop-chromium", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "desktop-firefox", use: { browserName: "firefox", viewport: { width: 1440, height: 900 } } },
    { name: "notebook-chromium", use: { browserName: "chromium", viewport: { width: 1024, height: 768 } } },
    { name: "breakpoint-767-chromium", use: { browserName: "chromium", viewport: { width: 767, height: 800 } } },
    { name: "breakpoint-768-chromium", use: { browserName: "chromium", viewport: { width: 768, height: 800 } } },
    { name: "breakpoint-1023-chromium", use: { browserName: "chromium", viewport: { width: 1023, height: 768 } } },
    { name: "breakpoint-1024-chromium", use: { browserName: "chromium", viewport: { width: 1024, height: 768 } } },
    { name: "breakpoint-1279-chromium", use: { browserName: "chromium", viewport: { width: 1279, height: 800 } } },
    { name: "breakpoint-1280-chromium", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "tablet-portrait-webkit", use: { browserName: "webkit", viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: "tablet-landscape-chromium", use: { browserName: "chromium", viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true } },
    { name: "mobile-320-chromium", use: { browserName: "chromium", viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "mobile-360-webkit", use: { browserName: "webkit", viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: "mobile-390-chromium", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: "mobile-landscape-webkit", use: { browserName: "webkit", viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
  ],
});
