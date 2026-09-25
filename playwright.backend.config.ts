import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "concurrency-integrity.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  reporter: [["line"]],
});
