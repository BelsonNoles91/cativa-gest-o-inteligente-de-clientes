import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_SECURITY_BASE_URL ?? "http://127.0.0.1:18081";
const outputDir = process.env.PW_OUTPUT_DIR ?? "./e2e/.artifacts-security";
const junitPath = process.env.PW_JUNIT_FILE ?? `${outputDir}/junit.xml`;

export default defineConfig({
  testDir: "./e2e/security",
  testMatch: "**/*.spec.ts",
  outputDir,
  workers: 1,
  reporter: [["list"], ["junit", { outputFile: junitPath }]],
  use: {
    baseURL,
    browserName: "chromium",
    storageState: { cookies: [], origins: [] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 18081 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: "http://cativa-security.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-security-test-key",
    },
  },
});
