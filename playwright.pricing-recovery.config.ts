import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_PRICING_BASE_URL ?? "http://127.0.0.1:18086";
const outputDir = process.env.PW_OUTPUT_DIR ?? "/tmp/cativa-pricing-recovery";
const useExternalPreview = process.env.E2E_PRICING_PREVIEW === "1";

export default defineConfig({
  testDir: "./e2e/security",
  testMatch: "pricing-connection-recovery.spec.ts",
  outputDir,
  globalSetup: undefined,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: `${outputDir}/junit.xml` }],
  ],
  use: {
    baseURL,
    storageState: { cookies: [], origins: [] },
    locale: "pt-BR",
    timezoneId: "America/Belem",
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet-webkit",
      use: {
        browserName: "webkit",
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: useExternalPreview
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 18086 --strictPort",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          VITE_SUPABASE_URL: "http://cativa-pricing-recovery.invalid",
          VITE_SUPABASE_PUBLISHABLE_KEY: "public-pricing-recovery-test-key",
        },
      },
});
