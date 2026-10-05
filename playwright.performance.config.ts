import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const distDir = process.env.CATIVA_CWV_DIST_DIR;
if (!distDir) {
  throw new Error("CATIVA_CWV_DIST_DIR ausente. Execute npm run test:performance:cwv.");
}
const artifactsDir = resolve(projectRoot, process.env.CATIVA_CWV_ARTIFACTS_DIR ?? "e2e/.artifacts-performance");
const reportDir = resolve(projectRoot, process.env.CATIVA_CWV_REPORT_DIR ?? "e2e/.report-performance");

const baseURL = "http://127.0.0.1:18084";
const viteCli = resolve(projectRoot, "node_modules/vite/bin/vite.js");

export default defineConfig({
  testDir: "./e2e/performance",
  testMatch: "**/*.spec.ts",
  outputDir: artifactsDir,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["line"],
    ["junit", { outputFile: resolve(artifactsDir, "junit.xml") }],
    ["html", { open: "never", outputFolder: reportDir }],
  ],
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [] },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  webServer: {
    command: `${JSON.stringify(process.execPath)} ${JSON.stringify(viteCli)} preview --host 127.0.0.1 --port 18084 --strictPort --outDir ${JSON.stringify(distDir)}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: "http://cativa-performance.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "cativa-performance-local-only",
    },
  },
});
