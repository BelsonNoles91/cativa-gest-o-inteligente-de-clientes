import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import {
  prepareAuthenticatedVisualState,
  prepareClientPortalVisualState,
  prepareForSnapshot,
} from "../_helpers/visual";

const PUBLIC_ROUTES = ["/", "/planos", "/privacidade", "/termos", "/status", "/auth/login", "/portal/acesso"];
const AUTHENTICATED_ROUTES = ["/app", "/app/agenda", "/app/clientes", "/app/confirmacoes", "/portal"];

async function scanContrast(page: Page, route: string, theme: "light" | "dark", testInfo: { attach: (name: string, body: Buffer, options: { contentType: string }) => Promise<void> }) {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((colorScheme) => {
    document.documentElement.classList.toggle("dark", colorScheme === "dark");
  }, theme);
  await prepareForSnapshot(page);
  await page.addStyleTag({
    content: `
      html[data-a11y-motion-settled] *,
      html[data-a11y-motion-settled] *::before,
      html[data-a11y-motion-settled] *::after {
        animation: none !important;
        transition: none !important;
      }
      html[data-a11y-motion-settled] [style*="opacity"] {
        opacity: 1 !important;
      }
      html[data-a11y-motion-settled] [style*="transform"] {
        transform: none !important;
      }
    `,
  });
  await page.evaluate(() => {
    // Framer Motion leaves off-screen content at its initial opacity. Contrast
    // must be measured on the final rendered color, not on text mid-fade or
    // hidden until scroll. Keep the semantic foreground/background colors.
    document.documentElement.dataset.a11yMotionSettled = "true";
  });
  // Framer Motion keeps below-the-fold sections at opacity:0 until they enter
  // the viewport. Sweep the document before auditing so all content is laid
  // out, while the override above keeps animated text in its final state.
  await page.evaluate(async () => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (const y of [0, Math.round(maxScroll * 0.35), Math.round(maxScroll * 0.7), maxScroll, 0]) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  });
  await page.waitForTimeout(450);

  const invalidDecorativeWatermarks = await page.locator(
    ".a11y-decorative-watermark:not([aria-hidden='true'])",
  ).count();
  expect(
    invalidDecorativeWatermarks,
    "a exceção decorativa só pode conter marcações explicitamente ocultas de tecnologias assistivas",
  ).toBe(0);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .include("body")
    // Grandes números de marca são decorativos, têm aria-hidden explícito e
    // se enquadram na exceção de conteúdo puramente decorativo da WCAG 1.4.3.
    .exclude(".a11y-decorative-watermark")
    .analyze();
  const report = Buffer.from(JSON.stringify(results, null, 2));
  await writeFile(testInfo.outputPath(`${theme}-${route.replaceAll("/", "_") || "home"}-axe.json`), report);
  await testInfo.attach(`${theme}-${route.replaceAll("/", "_") || "home"}-axe.json`, report, {
    contentType: "application/json",
  });

  const critical = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  const criticalSummary = critical.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.slice(0, 8).map((node) => ({
      target: node.target,
      html: node.html.slice(0, 240),
      failureSummary: node.failureSummary,
    })),
  }));
  expect(
    criticalSummary,
    `${route} (${theme}) possui violações WCAG críticas/sérias: ${critical.map((item) => item.id).join(", ")}`,
  ).toEqual([]);
}

test.describe("a11y — contraste e temas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of PUBLIC_ROUTES) {
    test(`${route}: contraste AA no tema claro`, async ({ page }, testInfo) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // Rotas públicas são deliberadamente light-only (ForceLightOnPublicRoutes)
      // porque usam superfícies de marca claras; o tema escuro é exercitado no
      // shell autenticado abaixo, onde a alternância é suportada.
      await scanContrast(page, route, "light", testInfo);
    });
  }
});

test.describe("a11y — contraste em rotas autenticadas", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test.beforeEach(async ({ page }) => {
    await prepareAuthenticatedVisualState(page);
  });

  for (const route of AUTHENTICATED_ROUTES) {
  test(`${route}: light/dark sem violação séria`, async ({ page }, testInfo) => {
      if (route === "/portal") {
        await prepareClientPortalVisualState(page);
      }
      await page.goto(route, { waitUntil: "domcontentloaded" });
      for (const theme of ["light", "dark"] as const) {
        await scanContrast(page, route, theme, testInfo);
      }
    });
  }
});
