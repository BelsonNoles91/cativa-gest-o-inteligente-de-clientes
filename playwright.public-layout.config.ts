import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";
import layoutConfig from "./playwright.layout.config";

const baseURL = process.env.E2E_PUBLIC_LAYOUT_BASE_URL ?? "http://127.0.0.1:18082";
const outputDir = process.env.PW_OUTPUT_DIR ?? "./e2e/.artifacts-layout-public";
const reportDir = process.env.PW_REPORT_DIR ?? "e2e/.report-layout-public";
// Use a deliberately unserved loopback port by default. Public UI tests mock
// the small set of required endpoints and must never target another local stack.
const supabaseURL = "http://cativa-public-layout.invalid";
const supabasePublishableKey = "public-layout-test-key";

export default defineConfig({
  ...layoutConfig,
  grep: /rotas públicas|fronteiras|reflow 200%/,
  outputDir,
  globalSetup: undefined,
  reporter: [
    ["line"],
    ["junit", { outputFile: `${outputDir}/junit.xml` }],
    ["html", { open: "never", outputFolder: reportDir }],
  ],
  use: {
    ...layoutConfig.use,
    baseURL,
    storageState: { cookies: [], origins: [] },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 18082 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: supabaseURL,
      VITE_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
    },
  },
});
