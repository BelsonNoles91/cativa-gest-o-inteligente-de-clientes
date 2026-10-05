import "./e2e/_helpers/private-artifacts";
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://cativa.localhost:4173";
const OUTPUT_DIR = process.env.PW_OUTPUT_DIR ?? "e2e/.artifacts-pwa-offline";
const REPORT_DIR = process.env.PW_REPORT_DIR ?? "e2e/.report-pwa-offline";
const PREVIEW_DIR = process.env.PW_PREVIEW_OUT_DIR ?? "dist";

export default defineConfig({
  testDir: "./e2e/diagnostics",
  testMatch: "local-offline-agenda.spec.ts",
  outputDir: OUTPUT_DIR,
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  reporter: [
    ["line"],
    ["junit", { outputFile: `${OUTPUT_DIR}/junit.xml` }],
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
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --outDir "${PREVIEW_DIR}" --host ::1 --port 4173 --strictPort`,
    url: "http://[::1]:4173",
    // O preview deve sempre usar o build desta execução; reutilizar a porta
    // pode servir um dist antigo e invalidar a validação de cache offline.
    reuseExistingServer: process.env.E2E_PWA_EXTERNAL_PREVIEW === "true",
    timeout: 120_000,
  },
  projects: [
    {
      name: "mobile-chromium-pwa-offline",
      use: { ...devices["iPhone 14"], browserName: "chromium" },
    },
  ],
});
