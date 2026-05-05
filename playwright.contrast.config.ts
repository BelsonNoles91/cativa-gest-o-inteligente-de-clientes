import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    channel: "chrome",
    baseURL: "http://127.0.0.1:8080",
  },
  projects: [
    {
      name: "desktop-chrome",
    }
  ]
});
