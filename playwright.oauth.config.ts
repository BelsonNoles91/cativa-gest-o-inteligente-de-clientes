import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const outputDir = resolve(projectRoot, process.env.CATIVA_OAUTH_ARTIFACTS_DIR ?? "e2e/.artifacts-oauth");
const reportDir = resolve(projectRoot, process.env.CATIVA_OAUTH_REPORT_DIR ?? "e2e/.report-oauth");
const baseURL = "http://127.0.0.1:18085";

export default defineConfig({
  testDir: "./e2e/integrations",
  testMatch: "**/*.spec.ts",
  outputDir,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["line"],
    ["junit", { outputFile: resolve(outputDir, "junit.xml") }],
    ["html", { open: "never", outputFolder: reportDir }],
  ],
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    storageState: { cookies: [], origins: [] },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 18085 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: "http://cativa-oauth.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "cativa-oauth-local-only",
    },
  },
});
