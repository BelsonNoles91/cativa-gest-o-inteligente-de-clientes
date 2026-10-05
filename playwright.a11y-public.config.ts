import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";
import layoutConfig from "./playwright.layout.config";

const baseURL = "http://127.0.0.1:18082";
const outputDir = process.env.PW_OUTPUT_DIR ?? "e2e/.artifacts-a11y-public";
const reportDir = process.env.PW_REPORT_DIR ?? "e2e/.report-a11y-public";
const publicProjects = new Set([
  "desktop-chromium",
  "mobile-320-chromium",
  "tablet-portrait-webkit",
]);

export default defineConfig({
  ...layoutConfig,
  testDir: "./e2e/visual",
  testMatch: ["**/a11y-contrast.spec.ts"],
  grep: /contraste AA no tema claro/,
  globalSetup: undefined,
  outputDir,
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
  projects: layoutConfig.projects?.filter(({ name }) => publicProjects.has(name)) ?? [],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 18082 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: "http://cativa-public-a11y.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-a11y-test-key",
    },
  },
});
