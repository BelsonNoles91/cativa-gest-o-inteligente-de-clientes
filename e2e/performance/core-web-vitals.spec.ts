import { expect, test } from "@playwright/test";

type CwvSnapshot = {
  lcpMs: number | null;
  lcpElement: string | null;
  cls: number;
  inpMs: number | null;
  interactionCount: number;
  fcpMs: number | null;
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  loadEventMs: number | null;
  longTaskCount: number;
  longTaskTotalMs: number;
  fontStatus: string;
  fontFaceCount: number;
  imageCount: number;
  brokenImageCount: number;
  layoutShifts: Array<{
    startTimeMs: number;
    value: number;
    sources: Array<{
      selector: string;
      previousRect: number[];
      currentRect: number[];
    }>;
  }>;
};

declare global {
  interface Window {
    __cativaCwv?: {
      lcpMs: number | null;
      lcpElement: string | null;
      cls: number;
      shiftSessionStart: number;
      shiftSessionLast: number;
      shiftSessionValue: number;
      layoutShifts: CwvSnapshot["layoutShifts"];
      interactions: Record<string, number>;
      longTaskCount: number;
      longTaskTotalMs: number;
    };
  }
}

const ROUTES = [
  { name: "landing", path: "/", interaction: "Salões" },
  { name: "planos", path: "/planos", interaction: "Tentar novamente" },
] as const;

const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "mobile-landscape-568", width: 568, height: 320 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-landscape-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 720 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
] as const;

const SIMULATED_BACKEND_ORIGIN = "http://cativa-performance.invalid";
const APP_ORIGIN = "http://127.0.0.1:18084";

test.describe("Core Web Vitals — build de produção isolado", () => {
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      test(`${route.name} @ ${viewport.name}: carrega estável e responde à interação`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const mockedExternalHosts = new Set<string>();
      let simulatedBackendFailures = 0;

      await page.route("**/*", async (requestRoute) => {
        const url = new URL(requestRoute.request().url());
        if (url.origin === SIMULATED_BACKEND_ORIGIN) {
          simulatedBackendFailures += 1;
          await requestRoute.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ code: "CWV_BACKEND_OFFLINE", message: "Backend unavailable in test." }),
          });
          return;
        }
        if (url.protocol === "data:" || url.protocol === "blob:") {
          await requestRoute.continue();
          return;
        }
        if (url.origin === APP_ORIGIN) {
          await requestRoute.continue();
          return;
        }
        mockedExternalHosts.add(url.hostname || url.protocol);
        if (requestRoute.request().resourceType() === "stylesheet") {
          await requestRoute.fulfill({
            status: 200,
            contentType: "text/css",
            body: "/* external styles disabled in deterministic performance run */",
          });
          return;
        }
        if (requestRoute.request().resourceType() === "image") {
          await requestRoute.fulfill({
            status: 200,
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#e8e1e5"/></svg>',
          });
          return;
        }
        await requestRoute.abort("blockedbyclient");
      });

      await page.addInitScript(() => {
        const state = {
          lcpMs: null as number | null,
          lcpElement: null as string | null,
          cls: 0,
          shiftSessionStart: 0,
          shiftSessionLast: 0,
          shiftSessionValue: 0,
          layoutShifts: [] as CwvSnapshot["layoutShifts"],
          interactions: {} as Record<string, number>,
          longTaskCount: 0,
          longTaskTotalMs: 0,
        };
        window.__cativaCwv = state;

        const observe = (
          type: string,
          callback: (entries: PerformanceEntry[]) => void,
          options?: PerformanceObserverInit,
        ) => {
          try {
            const observer = new PerformanceObserver((list) => callback(list.getEntries()));
            observer.observe(options ?? { entryTypes: [type] });
          } catch {
            // Navegadores sem suporte ao tipo não impedem as demais medições.
          }
        };

        observe("largest-contentful-paint", (entries) => {
          for (const rawEntry of entries) {
            const entry = rawEntry as PerformanceEntry & { element?: Element };
            state.lcpMs = entry.startTime;
            const element = entry.element;
            state.lcpElement = element
              ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${typeof element.className === "string" && element.className ? `.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}`
              : null;
          }
        });
        observe("layout-shift", (entries) => {
          for (const rawEntry of entries) {
            const entry = rawEntry as PerformanceEntry & {
              value?: number;
              hadRecentInput?: boolean;
              sources?: Array<{
                node?: Node;
                previousRect?: DOMRectReadOnly;
                currentRect?: DOMRectReadOnly;
              }>;
            };
            if (entry.hadRecentInput || typeof entry.value !== "number") continue;
            state.layoutShifts.push({
              startTimeMs: Math.round(entry.startTime),
              value: entry.value,
              sources: (entry.sources ?? []).slice(0, 5).map((source) => {
                const node = source.node instanceof Element ? source.node : null;
                const selector = node
                  ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${typeof node.className === "string" && node.className ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}`
                  : "unknown";
                const rect = (value?: DOMRectReadOnly) =>
                  value
                    ? [value.x, value.y, value.width, value.height].map((part) => Math.round(part))
                    : [];
                return {
                  selector,
                  previousRect: rect(source.previousRect),
                  currentRect: rect(source.currentRect),
                };
              }),
            });
            const startsNewSession =
              entry.startTime - state.shiftSessionLast > 1000 ||
              entry.startTime - state.shiftSessionStart > 5000;
            if (startsNewSession) {
              state.shiftSessionStart = entry.startTime;
              state.shiftSessionValue = entry.value;
            } else {
              state.shiftSessionValue += entry.value;
            }
            state.shiftSessionLast = entry.startTime;
            state.cls = Math.max(state.cls, state.shiftSessionValue);
          }
        });
        observe("event", (entries) => {
          for (const rawEntry of entries) {
            const entry = rawEntry as PerformanceEntry & {
              interactionId?: number;
              duration?: number;
            };
            if (!entry.interactionId || typeof entry.duration !== "number") continue;
            const key = String(entry.interactionId);
            state.interactions[key] = Math.max(state.interactions[key] ?? 0, entry.duration);
          }
        }, { type: "event", durationThreshold: 16 } as unknown as PerformanceObserverInit);
        observe("longtask", (entries) => {
          for (const entry of entries) {
            state.longTaskCount += 1;
            state.longTaskTotalMs += entry.duration;
          }
        });
      });

      const response = await page.goto(route.path, { waitUntil: "load", timeout: 45_000 });
      expect(response?.status() ?? 500, `${route.path}: falha HTTP na rota`).toBeLessThan(500);
      await page.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        return true;
      });
      const interaction = page.getByRole("button", { name: route.interaction, exact: true });
      await interaction.waitFor({ state: "visible", timeout: 15_000 });
      await page.waitForTimeout(1500);

      const readLargestContentfulPaint = () => page.evaluate(() => {
        const entries = performance.getEntriesByType("largest-contentful-paint");
        return window.__cativaCwv?.lcpMs ?? entries[entries.length - 1]?.startTime ?? null;
      });
      await expect.poll(readLargestContentfulPaint, {
        message: `${route.path} deveria produzir LCP antes da interação do usuário`,
        timeout: 15_000,
      }).not.toBeNull();
      const lcpBeforeInteraction = await readLargestContentfulPaint();

      // A primeira ação fica abaixo da dobra na landing. Posiciona o alvo
      // antes do clique medido e deixa as animações disparadas pelo scroll
      // terminarem; assim o INP representa a resposta ao clique, não a soma de
      // scroll automático + animações de entrada concorrendo no mesmo frame.
      await interaction.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);

      let comparisonHeadingDocumentTop: number | undefined;
      let failuresBeforeRetry = 0;
      if (route.name === "planos") {
        const comparisonHeading = page.getByRole("heading", { name: "O que vem incluso" });
        await comparisonHeading.waitFor({ state: "visible" });
        comparisonHeadingDocumentTop = await comparisonHeading.evaluate((element) =>
          element.getBoundingClientRect().top + window.scrollY,
        );
        failuresBeforeRetry = simulatedBackendFailures;
      }
      await interaction.click();
      if (route.name === "planos") {
        await expect.poll(() => simulatedBackendFailures).toBeGreaterThan(failuresBeforeRetry);
        await expect(interaction).toBeEnabled();
        const comparisonHeading = page.getByRole("heading", { name: "O que vem incluso" });
        const comparisonHeadingAfterRetryDocumentTop = await comparisonHeading.evaluate((element) =>
          element.getBoundingClientRect().top + window.scrollY,
        );
        expect(comparisonHeadingAfterRetryDocumentTop).toBeCloseTo(comparisonHeadingDocumentTop!, 0);
      }
      await page.waitForTimeout(250);

      const snapshot = await page.evaluate((measuredLcpMs): CwvSnapshot => {
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const paintEntries = performance.getEntriesByType("paint");
        const fcp = paintEntries.find((entry) => entry.name === "first-contentful-paint");
        const state = window.__cativaCwv;
        const interactions = Object.values(state?.interactions ?? {}).sort((a, b) => a - b);
        const inpIndex = interactions.length ? Math.max(0, Math.ceil(interactions.length * 0.98) - 1) : -1;
        const images = Array.from(document.images);

        return {
          lcpMs: measuredLcpMs,
          lcpElement: state?.lcpElement ?? null,
          cls: state?.cls ?? 0,
          inpMs: inpIndex >= 0 ? Math.round(interactions[inpIndex]) : null,
          interactionCount: interactions.length,
          fcpMs: fcp?.startTime ?? null,
          ttfbMs: navigation ? navigation.responseStart - navigation.requestStart : null,
          domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
          loadEventMs: navigation?.loadEventEnd ?? null,
          longTaskCount: state?.longTaskCount ?? 0,
          longTaskTotalMs: Math.round(state?.longTaskTotalMs ?? 0),
          fontStatus: document.fonts.status,
          fontFaceCount: document.fonts.size,
          imageCount: images.length,
          brokenImageCount: images.filter((image) => image.complete && image.naturalWidth === 0).length,
          layoutShifts: state?.layoutShifts ?? [],
        };
      }, lcpBeforeInteraction);

      const report = {
        route: route.path,
        viewportProfile: viewport.name,
        viewport: page.viewportSize(),
        runMode: "produção local; backend respondendo 503 simulado; rede externa substituída por fixtures locais",
        budgets: {
          lcpMs: 2500,
          cls: 0.1,
          inpMs: 200,
          fcpGoodTargetMs: 1800,
          fcpOperationalCeilingMs: 3000,
          ttfbMs: 800,
        },
        softGoals: {
          fcpGoodTargetMet: snapshot.fcpMs !== null && snapshot.fcpMs <= 1800,
        },
        metrics: snapshot,
        simulatedBackendFailures,
        mockedExternalHosts: [...mockedExternalHosts].sort(),
      };
      await testInfo.attach(`${route.name}-web-vitals.json`, {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
      console.log(`Web Vitals ${route.name}@${viewport.name}: ${JSON.stringify(report)}`);
      if (!report.softGoals.fcpGoodTargetMet) {
        console.warn(`${route.name}: FCP superou o alvo de boa experiência de 1,8 s, sem exceder o teto operacional de 3 s.`);
      }
      if (snapshot.cls >= 0.08) {
        console.warn(`${route.name}: CLS está próximo do limite de 0,1; revisar fontes no anexo layoutShifts.`);
      }

      expect(snapshot.lcpMs, "LCP não foi observado").not.toBeNull();
      expect(snapshot.lcpMs!, "LCP acima do orçamento de 2,5 s").toBeLessThanOrEqual(2500);
      expect(snapshot.cls, "CLS acima do orçamento de 0,1").toBeLessThanOrEqual(0.1);
      expect(snapshot.fcpMs, "FCP não foi observado").not.toBeNull();
      expect(snapshot.fcpMs!, "FCP acima do teto operacional de 3 s").toBeLessThanOrEqual(3000);
      expect(snapshot.ttfbMs, "TTFB não foi observado").not.toBeNull();
      expect(snapshot.ttfbMs!, "TTFB acima do orçamento de 800 ms").toBeLessThanOrEqual(800);
      expect(snapshot.brokenImageCount, "imagem quebrada na rota").toBe(0);
      if (snapshot.inpMs !== null) {
        expect(snapshot.inpMs, "INP acima do orçamento de 200 ms").toBeLessThanOrEqual(200);
      }
      expect(simulatedBackendFailures, "a página exercitou a falha controlada do backend local").toBeGreaterThan(0);
      });
    }
  }
});
