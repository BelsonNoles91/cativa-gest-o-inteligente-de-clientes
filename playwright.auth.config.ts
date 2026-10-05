import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_SECURITY_BASE_URL ?? "http://127.0.0.1:18081";

export default defineConfig({
  testDir: "./e2e/security",
  testMatch: "**/auth-error-recovery.spec.ts",
  outputDir: process.env.PW_OUTPUT_DIR ?? "./e2e/.artifacts-auth-contract",
  workers: 1,
  reporter: [["list"], ["junit", {
    outputFile: process.env.PW_JUNIT_FILE ?? "e2e/.artifacts-auth-contract/junit.xml",
  }]],
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  use: {
    baseURL,
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
