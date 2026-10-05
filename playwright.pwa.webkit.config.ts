import { defineConfig, devices } from "@playwright/test";
import pwaConfig from "./playwright.pwa.config";

export default defineConfig({
  ...pwaConfig,
  projects: [
    {
      name: "mobile-webkit-pwa-offline",
      use: { ...devices["iPhone 14"], browserName: "webkit" },
    },
  ],
});
