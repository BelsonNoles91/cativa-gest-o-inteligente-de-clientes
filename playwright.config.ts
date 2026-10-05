/**
 * Playwright config — Visual Regression Tests (mobile/tablet)
 *
 * Cobre perfis de dispositivo conforme decisão da matriz completa:
 *  - iPhone 14 portrait (notch top)
 *  - iPhone 14 landscape (notch lateral — caso crítico de safe-area)
 *  - iPhone SE (tela pequena, sem notch — regressão para alturas curtas)
 *  - Android 360 portrait (largura mínima viável)
 *  - Mobile 320×568 para dialogs estreitos e jornada agenda→confirmação
 *  - iPad (10.2") portrait — tablet
 *
 * Auth: roteado via global-setup (e2e/global-setup.ts) que faz login real via
 * UI usando E2E_USER / E2E_PASS (.env.local). O storageState resultante é
 * carregado em todos os specs autenticados.
 *
 * Comparação: usamos screenshots full-page com mascaramento de áreas voláteis
 * (timestamps, banners de offline transitórios). Tolerância de 0.2% de pixels
 * diferentes para absorver antialiasing entre máquinas.
 */
import "./e2e/_helpers/private-artifacts";
import { defineConfig, devices } from "@playwright/test";

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ??= "1";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8080";
const IS_CI = Boolean(process.env.CI);
const OUTPUT_DIR = process.env.PW_OUTPUT_DIR ?? "./e2e/.artifacts";
const REPORT_DIR = process.env.PW_REPORT_DIR ?? "e2e/.report";
const JUNIT_FILE = process.env.PW_JUNIT_FILE ?? `${OUTPUT_DIR}/junit.xml`;

export default defineConfig({
  testDir: "./e2e",
  // Os cenários que dependem de reload sob Service Worker rodam na
  // configuração PWA dedicada (Chromium + origem localhost confiável).
  // A matriz principal inclui projetos WebKit mobile, cujo reload offline
  // com Service Worker falha internamente no WebKit headless do Linux.
  testIgnore: [
    /local-offline-agenda\.spec\.ts$/,
    /e2e[\\/]performance[\\/].*\.spec\.ts$/,
    // Auth contract tests have their own mock server and empty storageState.
    /security[\\/].*\.spec\.ts$/,
  ],
  outputDir: OUTPUT_DIR,
  snapshotDir: "./e2e/__screenshots__",
  // Snapshot path estável entre máquinas (sem nome do OS).
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}/{arg}-{projectName}{ext}",
  fullyParallel: IS_CI,
  forbidOnly: IS_CI,
  retries: 0,
  workers: IS_CI ? 2 : 1,
  reporter: [
    ["list"],
    ["junit", { outputFile: JUNIT_FILE }],
    ["html", { open: "never", outputFolder: REPORT_DIR }],
  ],
  expect: {
    toHaveScreenshot: {
      // Tolerância em proporção de pixels diferentes (0..1).
      maxDiffPixelRatio: 0.002,
      // Pequena tolerância de threshold por pixel (antialiasing).
      threshold: 0.2,
      // Animations são desligadas pelo helper; reforço aqui.
      animations: "disabled",
      caret: "hide",
      timeout: 15_000,
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // A validação de offline/Service Worker pertence à configuração PWA
    // dedicada; aqui bloqueamos cache de chunks entre navegações e testes.
    serviceWorkers: "block",
    // storageState gerado pelo global-setup, reutilizado em todos os projetos.
    storageState:
      process.env.E2E_STORAGE_STATE_PATH ?? "e2e/.auth/storageState.json",
    // Timezone e locale fixos para evitar diff por hora local.
    timezoneId: "America/Sao_Paulo",
    locale: "pt-BR",
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    // ---- iPhone 14 portrait (notch superior)
    {
      name: "iphone-14-portrait",
      use: {
        ...devices["iPhone 14"],
        // Força safe-area via DPR + viewport-fit no preview (já configurado no app).
      },
    },
    // ---- iPhone 14 landscape (notch lateral — pior caso de safe-area)
    {
      name: "iphone-14-landscape",
      use: {
        ...devices["iPhone 14 landscape"],
      },
    },
    // ---- iPhone SE (tela pequena, sem notch — regressão para shortViewport)
    {
      name: "iphone-se",
      use: {
        ...devices["iPhone SE"],
      },
    },
    // ---- Android 360 portrait (Pixel 5 ~ 393, mas usamos viewport custom para 360)
    {
      name: "android-360-portrait",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
      },
    },
    // ---- largura mínima (somente specs sem baseline visual de página)
    {
      name: "mobile-320-portrait",
      testMatch: /(?:agenda-to-confirmation|dialog-overflow|a11y-contrast|onboarding-flow)\.spec\.ts$/,
      use: {
        browserName: "chromium",
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    // ---- iPad portrait (tablet — verifica breakpoint md/lg)
    {
      name: "ipad-portrait",
      use: {
        ...devices["iPad (gen 7)"],
      },
    },
  ],
});
