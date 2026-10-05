import "./e2e/_helpers/private-artifacts";
import { defineConfig } from "@playwright/test";

const outputDir = process.env.PW_OUTPUT_DIR ?? "e2e/.artifacts-backend";
const reportDir = process.env.PW_REPORT_DIR ?? "e2e/.report-backend";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "concurrency-integrity.spec.ts",
  outputDir,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  reporter: [
    ["line"],
    ["junit", { outputFile: `${outputDir}/junit.xml` }],
    ["html", { open: "never", outputFolder: reportDir }],
  ],
});
