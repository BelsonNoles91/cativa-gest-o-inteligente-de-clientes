/**
 * BottomNav — detecção automática de overlap com elementos flutuantes.
 *
 * Captura screenshot do BottomNav em cada perfil mobile/tablet e mede,
 * pixel a pixel, se algum item interativo (`[data-testid="bottom-nav-item"]`
 * ou `[data-testid="bottom-nav-more"]`) está sendo coberto por:
 *
 *   - Toasters/Sonner (`[data-sonner-toaster]`, `[role="status"]`)
 *   - OfflineBanner (`[data-testid="offline-banner"]`)
 *   - FABs / botões fixos genéricos (`position: fixed` com z-index >= nav)
 *   - Badge do Lovable (`#lovable-badge`, iframe injetado)
 *   - Modais/Sheets que não fecham corretamente
 *
 * Critério automático de overlap:
 *   - Calcula intersecção retangular entre o rect de cada item do nav e o
 *     rect de cada candidato flutuante.
 *   - **Falha** se a área de intersecção > `MAX_OVERLAP_RATIO * areaItem`,
 *     com `MAX_OVERLAP_RATIO = 0.10` (10% do item coberto já é regressão
 *     visual perceptível para tap-target de 44px).
 *   - O badge do Lovable é tratado como exceção tolerada apenas no canto
 *     inferior direito (≤ 72px), porque o nav já reserva 4 colunas.
 *
 * Em caso de falha, gera screenshot anotado via `captureFailureReport`.
 *
 * Cobertura: rotas autenticadas mais usadas (Dashboard, Agenda, Clientes,
 * Confirmações). O storageState do global-setup garante usuário logado.
 */
import { test, expect, type Page } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import {
  prepareAuthenticatedVisualState,
  prepareForSnapshot,
  assertBottomNavVisible,
} from "../_helpers/visual";
import { captureFailureReport, type Offender } from "../_helpers/safeAreaReport";

/** Máximo de área de um item do nav que pode ser coberta antes de falhar. */
const MAX_OVERLAP_RATIO = 0.1;
const ROUTE_TIMEOUT = 45_000;
const SCENARIO_TIMEOUT = 90_000;

/** Largura/altura máxima reservada ao badge do Lovable no canto inf. direito. */
const LOVABLE_BADGE_MAX_PX = 72;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlapResult {
  itemLabel: string;
  itemRoute: string;
  itemRect: Rect;
  offenderLabel: string;
  offenderRect: Rect;
  overlapArea: number;
  overlapRatio: number;
}

/**
 * Coleta, dentro do browser, os rects do BottomNav, de cada item e de
 * todos os candidatos flutuantes que possam cobri-lo.
 */
async function measureBottomNavOverlap(page: Page): Promise<{
  navRect: Rect | null;
  items: { label: string; route: string; rect: Rect }[];
  floaters: { label: string; rect: Rect; isLovableBadge: boolean }[];
}> {
  return await page.evaluate(() => {
    function rectOf(el: Element): Rect {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }

    const nav = document.querySelector("[data-bottom-nav]") as HTMLElement | null;
    const navRect = nav ? rectOf(nav) : null;

    // Itens interativos do nav: links primary + botão "Mais".
    const itemEls = nav
      ? Array.from(
          nav.querySelectorAll<HTMLElement>(
            '[data-testid="bottom-nav-item"], [data-testid="bottom-nav-more"]',
          ),
        )
      : [];
    const items = itemEls.map((el) => ({
      label:
        el.getAttribute("aria-label") ||
        el.textContent?.trim().slice(0, 30) ||
        el.tagName.toLowerCase(),
      route: el.getAttribute("data-route") || el.getAttribute("data-testid") || "?",
      rect: rectOf(el),
    }));

    // Candidatos a flutuar sobre o nav. Usamos seletores estáveis + heurística
    // (position:fixed, z-index >= 30, dentro da metade inferior do viewport).
    const seen = new Set<Element>();
    const floaters: { label: string; rect: Rect; isLovableBadge: boolean }[] = [];

    function add(el: Element, label: string, isLovableBadge = false) {
      if (seen.has(el)) return;
      seen.add(el);
      const r = rectOf(el);
      if (r.width <= 0 || r.height <= 0) return;
      // Ignora o próprio nav.
      if (nav && (el === nav || nav.contains(el))) return;
      floaters.push({ label, rect: r, isLovableBadge });
    }

    // Selectors conhecidos.
    const knownSelectors: { sel: string; label: string; lovable?: boolean }[] = [
      { sel: "[data-sonner-toaster]", label: "sonner-toaster" },
      { sel: "[data-sonner-toaster] li", label: "sonner-toast" },
      { sel: '[role="status"][aria-live]', label: "aria-status" },
      { sel: '[data-testid="offline-banner"]', label: "offline-banner" },
      { sel: "#lovable-badge", label: "lovable-badge", lovable: true },
      { sel: 'iframe[src*="lovable"]', label: "lovable-iframe", lovable: true },
      { sel: '[data-radix-popper-content-wrapper]', label: "radix-popper" },
      { sel: '[role="dialog"]', label: "open-dialog" },
    ];
    for (const { sel, label, lovable } of knownSelectors) {
      document.querySelectorAll(sel).forEach((el) => add(el, label, !!lovable));
    }

    // Heurística: qualquer fixed/sticky com z-index >= 30 que toca a faixa
    // ocupada pelo nav. Isso pega FABs, banners promo etc. ainda não
    // catalogados.
    if (navRect) {
      const navBand = { top: navRect.y, bottom: navRect.y + navRect.height };
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        if (seen.has(el)) return;
        if (nav && (el === nav || nav.contains(el))) return;
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") return;
        if (cs.visibility === "hidden" || cs.display === "none") return;
        const z = parseInt(cs.zIndex, 10);
        if (Number.isNaN(z) || z < 30) return;
        const r = rectOf(el);
        if (r.width <= 0 || r.height <= 0) return;
        // Só considera se a caixa intersecta a faixa do nav (banda inferior).
        if (r.y + r.height < navBand.top || r.y > navBand.bottom) return;
        floaters.push({
          label: `fixed-z${z}-${el.tagName.toLowerCase()}.${(
            el.className?.toString().split(" ")[0] || ""
          ).slice(0, 24)}`,
          rect: r,
          isLovableBadge: false,
        });
        seen.add(el);
      });
    }

    return { navRect, items, floaters };
  });
}

/** Retorna a área de intersecção entre dois retângulos (0 se não cruzam). */
function intersectArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

/**
 * Verifica overlap entre cada item do nav e cada flutuante.
 * Retorna lista de violações que ultrapassam `MAX_OVERLAP_RATIO`.
 */
function detectOverlaps(
  items: { label: string; route: string; rect: Rect }[],
  floaters: { label: string; rect: Rect; isLovableBadge: boolean }[],
  viewport: { width: number; height: number },
): OverlapResult[] {
  const violations: OverlapResult[] = [];
  for (const item of items) {
    const itemArea = item.rect.width * item.rect.height;
    if (itemArea <= 0) continue;

    for (const floater of floaters) {
      const overlap = intersectArea(item.rect, floater.rect);
      if (overlap <= 0) continue;

      // Exceção: badge do Lovable no canto inferior direito é esperado.
      // Tolera-se desde que o badge fique dentro da faixa direita reservada.
      if (floater.isLovableBadge) {
        const isInBottomRightCorner =
          floater.rect.x + floater.rect.width >= viewport.width - 1 &&
          floater.rect.width <= LOVABLE_BADGE_MAX_PX &&
          floater.rect.height <= LOVABLE_BADGE_MAX_PX;
        if (isInBottomRightCorner) continue;
      }

      const ratio = overlap / itemArea;
      if (ratio > MAX_OVERLAP_RATIO) {
        violations.push({
          itemLabel: item.label,
          itemRoute: item.route,
          itemRect: item.rect,
          offenderLabel: floater.label,
          offenderRect: floater.rect,
          overlapArea: Math.round(overlap),
          overlapRatio: Number(ratio.toFixed(3)),
        });
      }
    }
  }
  return violations;
}

const ROUTES_TO_CHECK = [
  { path: "/app", name: "dashboard" },
  { path: "/app/agenda", name: "agenda" },
  { path: "/app/clientes", name: "clientes" },
  { path: "/app/confirmacoes", name: "confirmacoes" },
  { path: "/app/lista-de-espera", name: "waitlist" },
  { path: "/app/analytics", name: "analytics" },
  { path: "/app/configuracoes", name: "configuracoes" },
];

async function waitForAppShell(page: Page, path: string): Promise<void> {
  try {
    await page
      .locator("[data-app-main]")
      .first()
      .waitFor({ state: "visible", timeout: ROUTE_TIMEOUT });
  } catch (err) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    throw new Error(
      `[data-app-main] não apareceu em ${ROUTE_TIMEOUT}ms na rota ${path}. ` +
        `URL atual: ${page.url()}. ` +
        `Body snippet: ${bodyText.slice(0, 500)}\n` +
        `Original: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

test.describe("BottomNav overlap detection", () => {
  test.describe.configure({ timeout: SCENARIO_TIMEOUT });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test.beforeEach(async ({ page }) => {
    await prepareAuthenticatedVisualState(page);
  });

  for (const { path, name } of ROUTES_TO_CHECK) {
    test(`${name}: nenhum item do BottomNav é coberto por flutuantes`, async ({
      page,
    }, testInfo) => {
      const vw = page.viewportSize()?.width ?? 0;
      // BottomNav só existe < 768px (md:hidden). iPad pula.
      test.skip(vw >= 768, "BottomNav não renderiza em viewports >= 768px");

      await page.goto(path, { waitUntil: "domcontentloaded", timeout: ROUTE_TIMEOUT });
      await waitForAppShell(page, path);
      await prepareForSnapshot(page);
      await assertBottomNavVisible(page);

      const { navRect, items, floaters } = await measureBottomNavOverlap(page);
      expect(navRect, "BottomNav sem rect — não renderizou").not.toBeNull();
      expect(items.length, "BottomNav sem itens interativos").toBeGreaterThan(0);

      const viewport = page.viewportSize() ?? { width: 0, height: 0 };
      const violations = detectOverlaps(items, floaters, viewport);

      // Anexa screenshot do nav em todos os runs (passa ou falha) — vira
      // evidência visual no relatório HTML para inspeção manual rápida.
      const navOnly = await page.locator("[data-bottom-nav]").screenshot();
      await testInfo.attach(`bottom-nav-${name}`, {
        body: navOnly,
        contentType: "image/png",
      });

      // Anexa diagnóstico estruturado para depuração.
      await testInfo.attach(`overlap-report-${name}.json`, {
        body: Buffer.from(
          JSON.stringify(
            {
              viewport,
              navRect,
              items,
              floaters,
              violations,
              maxOverlapRatio: MAX_OVERLAP_RATIO,
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      });

      if (violations.length > 0) {
        // Converte para formato Offender e gera screenshot anotado.
        const offenders: Offender[] = violations.map((v) => ({
          label: `${v.offenderLabel} cobre ${v.itemRoute} (${Math.round(
            v.overlapRatio * 100,
          )}%)`,
          rect: v.offenderRect,
          side: "covered-by-nav",
          delta: v.overlapArea,
          hint: `${Math.round(v.overlapRatio * 100)}% do item coberto`,
        }));
        await captureFailureReport(page, `bottom-nav-overlap-${name}`, {
          message:
            `${violations.length} item(ns) do BottomNav cobertos acima do ` +
            `limite de ${MAX_OVERLAP_RATIO * 100}%. Detalhes: ` +
            JSON.stringify(violations, null, 2),
          offenders,
          extra: { route: path, viewport },
        });
      }

      expect(
        violations,
        `Itens do BottomNav cobertos por elementos flutuantes:\n` +
          violations
            .map(
              (v) =>
                `  - "${v.itemRoute}" coberto ${Math.round(
                  v.overlapRatio * 100,
                )}% por "${v.offenderLabel}"`,
            )
            .join("\n"),
      ).toEqual([]);
    });
  }
});
