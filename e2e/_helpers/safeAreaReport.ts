/**
 * Relatório automático de falhas de safe-area / BottomNav.
 *
 * Quando um assert relacionado a safe-area falha, gera dois artefatos em
 * `e2e/.artifacts/safe-area-failures/`:
 *
 *  1. **Screenshot anotado** — overlay translúcido vermelho sobre os
 *     elementos ofensores + linha indicadora do limite de safe-area.
 *  2. **Relatório JSON** — estrutura com viewport, valores resolvidos de
 *     `env(safe-area-inset-*)`, bounding boxes do BottomNav e do main,
 *     padding-bottom computado, lista de ofensores com `delta` em pixels.
 *
 * O objetivo é que o desenvolvedor abra um único arquivo em CI e veja
 * imediatamente: **o quê** está sobrepondo, **onde** e **por quanto**.
 *
 * Uso interno (chamado pelos asserts em `visual.ts`):
 * ```ts
 * try {
 *   expect(offenders).toEqual([]);
 * } catch (err) {
 *   await captureFailureReport(page, "bottom-nav-items", { offenders, safe });
 *   throw err;
 * }
 * ```
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { test } from "@playwright/test";

const REPORT_DIR = resolve(process.cwd(), "e2e/.artifacts/safe-area-failures");

/** Dados crus coletados do DOM para diagnóstico. */
export interface LayoutDiagnostics {
  viewport: { width: number; height: number };
  /** Valores resolvidos de env(safe-area-inset-*) em px. */
  safeArea: { top: number; right: number; bottom: number; left: number };
  bottomNav: {
    found: boolean;
    rect: { x: number; y: number; width: number; height: number } | null;
    /** Distância do topo do nav até o bottom do viewport. */
    topToViewportBottom: number | null;
    /** Distância do bottom do nav até o bottom do viewport (deve ser ~0). */
    bottomGap: number | null;
  };
  main: {
    found: boolean;
    rect: { x: number; y: number; width: number; height: number } | null;
    paddingBottomPx: number | null;
    scrollTop: number;
    scrollHeight: number;
  };
  scroll: { y: number; pageHeight: number };
  /** Total de elementos com `data-critical-action` na página. */
  criticalActionCount: number;
}

/** Descreve um ofensor para anotação visual. */
export interface Offender {
  /** Selector CSS ou descritor do elemento. */
  label: string;
  /** Bounding box em coordenadas do viewport. */
  rect: { x: number; y: number; width: number; height: number };
  /** Lado violado (para colorir/explicar). */
  side: "top" | "right" | "bottom" | "left" | "covered-by-nav";
  /** Pixels de violação (positivo = quanto ultrapassou o limite). */
  delta: number;
  /** Texto curto mostrado no overlay. */
  hint?: string;
}

/** Coleta diagnóstico completo do layout atual da página. */
export async function collectLayoutDiagnostics(
  page: Page,
): Promise<LayoutDiagnostics> {
  const vp = page.viewportSize() ?? { width: 0, height: 0 };
  const dom = await page.evaluate(() => {
    // Probe de safe-area-inset-*.
    const probe = document.createElement("div");
    probe.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:0",
      "height:0",
      "padding-top:env(safe-area-inset-top, 0px)",
      "padding-right:env(safe-area-inset-right, 0px)",
      "padding-bottom:env(safe-area-inset-bottom, 0px)",
      "padding-left:env(safe-area-inset-left, 0px)",
      "pointer-events:none",
      "visibility:hidden",
    ].join(";");
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const safeArea = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
    probe.remove();

    const navEl = document.querySelector(
      "[data-bottom-nav]",
    ) as HTMLElement | null;
    let bottomNav: LayoutDiagnostics["bottomNav"];
    if (!navEl) {
      bottomNav = {
        found: false,
        rect: null,
        topToViewportBottom: null,
        bottomGap: null,
      };
    } else {
      const r = navEl.getBoundingClientRect();
      bottomNav = {
        found: true,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        topToViewportBottom: window.innerHeight - r.y,
        bottomGap: window.innerHeight - (r.y + r.height),
      };
    }

    const mainEl = document.querySelector(
      "[data-app-main]",
    ) as HTMLElement | null;
    let main: LayoutDiagnostics["main"];
    if (!mainEl) {
      main = {
        found: false,
        rect: null,
        paddingBottomPx: null,
        scrollTop: 0,
        scrollHeight: 0,
      };
    } else {
      const r = mainEl.getBoundingClientRect();
      const cs2 = getComputedStyle(mainEl);
      main = {
        found: true,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        paddingBottomPx: parseFloat(cs2.paddingBottom) || 0,
        scrollTop: mainEl.scrollTop,
        scrollHeight: mainEl.scrollHeight,
      };
    }

    return {
      safeArea,
      bottomNav,
      main,
      scroll: { y: window.scrollY, pageHeight: document.body.scrollHeight },
      criticalActionCount: document.querySelectorAll("[data-critical-action]")
        .length,
    };
  });

  return {
    viewport: { width: vp.width, height: vp.height },
    ...dom,
  };
}

/**
 * Aplica overlays visuais (boxes vermelhas + linhas de safe-area) na página
 * para que o screenshot capture o estado anotado. Os overlays são removidos
 * após o screenshot via `removeOverlays`.
 */
async function injectOverlays(
  page: Page,
  offenders: Offender[],
  diagnostics: LayoutDiagnostics,
): Promise<void> {
  await page.evaluate(
    ({ offenders, safeArea, viewport }) => {
      const wrap = document.createElement("div");
      wrap.id = "__safe_area_failure_overlay__";
      wrap.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "pointer-events:none",
        "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
      ].join(";");

      // Linhas tracejadas indicando o limite de safe-area.
      const safeColor = "rgba(34,197,94,0.9)"; // verde — limite seguro
      const offColor = "rgba(239,68,68,0.85)"; // vermelho — ofensor
      const ringStyle = `2px dashed ${safeColor}`;

      // Top
      if (safeArea.top > 0) {
        const t = document.createElement("div");
        t.style.cssText = `position:fixed;left:0;right:0;top:${safeArea.top}px;border-top:${ringStyle}`;
        wrap.appendChild(t);
      }
      // Bottom
      if (safeArea.bottom > 0) {
        const b = document.createElement("div");
        b.style.cssText = `position:fixed;left:0;right:0;bottom:${safeArea.bottom}px;border-bottom:${ringStyle}`;
        wrap.appendChild(b);
      }
      // Left
      if (safeArea.left > 0) {
        const l = document.createElement("div");
        l.style.cssText = `position:fixed;top:0;bottom:0;left:${safeArea.left}px;border-left:${ringStyle}`;
        wrap.appendChild(l);
      }
      // Right
      if (safeArea.right > 0) {
        const rg = document.createElement("div");
        rg.style.cssText = `position:fixed;top:0;bottom:0;right:${safeArea.right}px;border-right:${ringStyle}`;
        wrap.appendChild(rg);
      }

      // Box vermelha em cima de cada ofensor + label.
      offenders.forEach((o, i) => {
        const box = document.createElement("div");
        box.style.cssText = [
          "position:fixed",
          `left:${o.rect.x}px`,
          `top:${o.rect.y}px`,
          `width:${o.rect.width}px`,
          `height:${o.rect.height}px`,
          `outline:3px solid ${offColor}`,
          `background:rgba(239,68,68,0.18)`,
          "box-shadow:0 0 0 1px rgba(0,0,0,0.4)",
        ].join(";");
        wrap.appendChild(box);

        const tag = document.createElement("div");
        const labelText = `#${i + 1} ${o.label} · ${o.side} +${Math.round(
          o.delta,
        )}px${o.hint ? ` · ${o.hint}` : ""}`;
        // Posição do label: tenta acima; se não couber, abaixo.
        const labelTop =
          o.rect.y > 24 ? o.rect.y - 22 : o.rect.y + o.rect.height + 4;
        const labelLeft = Math.max(4, Math.min(o.rect.x, viewport.width - 240));
        tag.style.cssText = [
          "position:fixed",
          `left:${labelLeft}px`,
          `top:${labelTop}px`,
          "background:rgba(17,24,39,0.92)",
          "color:#fff",
          "padding:2px 6px",
          "font-size:11px",
          "line-height:1.3",
          "border-radius:3px",
          "max-width:240px",
          "white-space:nowrap",
          "overflow:hidden",
          "text-overflow:ellipsis",
        ].join(";");
        tag.textContent = labelText;
        wrap.appendChild(tag);
      });

      // Legenda no canto superior-direito.
      const legend = document.createElement("div");
      legend.style.cssText = [
        "position:fixed",
        "top:8px",
        "right:8px",
        "background:rgba(17,24,39,0.92)",
        "color:#fff",
        "padding:6px 8px",
        "font-size:11px",
        "line-height:1.4",
        "border-radius:4px",
        "max-width:60vw",
      ].join(";");
      legend.innerHTML = [
        `<b>safe-area report</b>`,
        `vp ${viewport.width}×${viewport.height}`,
        `safe T${Math.round(safeArea.top)} R${Math.round(safeArea.right)} ` +
          `B${Math.round(safeArea.bottom)} L${Math.round(safeArea.left)}`,
        `ofensores: ${offenders.length}`,
      ].join("<br>");
      wrap.appendChild(legend);

      document.body.appendChild(wrap);
    },
    {
      offenders,
      safeArea: diagnostics.safeArea,
      viewport: diagnostics.viewport,
    },
  );
}

async function removeOverlays(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      document.getElementById("__safe_area_failure_overlay__")?.remove();
    })
    .catch(() => {
      /* página pode estar fechando */
    });
}

/** Sanitiza string para uso em nome de arquivo. */
function safeName(s: string): string {
  return s
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Dispara o relatório completo de falha. Gera 2 arquivos:
 *  - `<timestamp>-<label>-<project>.png`     — screenshot anotado
 *  - `<timestamp>-<label>-<project>.json`    — diagnóstico estruturado
 *
 * Também anexa ambos ao `TestInfo` do Playwright (quando disponível) para
 * aparecerem no relatório HTML em `e2e/.report`.
 *
 * NUNCA lança — falha de captura jamais deve mascarar a falha original.
 */
export async function captureFailureReport(
  page: Page,
  label: string,
  payload: {
    /** Mensagem curta da falha. */
    message: string;
    /** Diagnóstico de layout (será coletado se omitido). */
    diagnostics?: LayoutDiagnostics;
    /** Lista de ofensores para anotar visualmente. */
    offenders?: Offender[];
    /** Dados extras específicos do assert. */
    extra?: Record<string, unknown>;
  },
): Promise<{ screenshotPath: string; jsonPath: string } | null> {
  try {
    mkdirSync(REPORT_DIR, { recursive: true });
  } catch (err) {
     
    console.warn(`[safe-area-report] não consegui criar ${REPORT_DIR}`, err);
    return null;
  }

  let info: TestInfo | undefined;
  try {
    info = test.info();
  } catch {
    /* fora de um teste — segue sem anexar ao reporter */
  }
  const projectName = info?.project.name ?? "no-project";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `${ts}-${safeName(label)}-${safeName(projectName)}`;
  const screenshotPath = resolve(REPORT_DIR, `${base}.png`);
  const jsonPath = resolve(REPORT_DIR, `${base}.json`);

  let diagnostics = payload.diagnostics;
  if (!diagnostics) {
    try {
      diagnostics = await collectLayoutDiagnostics(page);
    } catch (err) {
       
      console.warn(`[safe-area-report] coleta de diagnóstico falhou`, err);
      diagnostics = {
        viewport: { width: 0, height: 0 },
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
        bottomNav: {
          found: false,
          rect: null,
          topToViewportBottom: null,
          bottomGap: null,
        },
        main: {
          found: false,
          rect: null,
          paddingBottomPx: null,
          scrollTop: 0,
          scrollHeight: 0,
        },
        scroll: { y: 0, pageHeight: 0 },
        criticalActionCount: 0,
      };
    }
  }

  const offenders = payload.offenders ?? [];

  // 1. Screenshot anotado.
  let screenshotOk = false;
  try {
    await injectOverlays(page, offenders, diagnostics);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    screenshotOk = true;
  } catch (err) {
     
    console.warn(`[safe-area-report] screenshot falhou`, err);
  } finally {
    await removeOverlays(page);
  }

  // 2. JSON estruturado.
  const report = {
    generatedAt: new Date().toISOString(),
    label,
    message: payload.message,
    project: projectName,
    test: {
      title: info?.title ?? null,
      file: info?.file ?? null,
      line: info?.line ?? null,
    },
    url: page.url(),
    diagnostics,
    offenders,
    extra: payload.extra ?? null,
    artifacts: {
      screenshot: screenshotOk ? screenshotPath : null,
      annotatedScreenshotInfo:
        "Boxes vermelhas = elementos ofensores. " +
        "Linhas tracejadas verdes = limites de env(safe-area-inset-*).",
    },
  };

  let jsonOk = false;
  try {
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
    jsonOk = true;
  } catch (err) {
     
    console.warn(`[safe-area-report] gravação do JSON falhou`, err);
  }

  // 3. Anexa ao Playwright reporter (HTML report) quando possível.
  if (info) {
    try {
      if (screenshotOk) {
        await info.attach(`safe-area-failure-${label}.png`, {
          path: screenshotPath,
          contentType: "image/png",
        });
      }
      if (jsonOk) {
        await info.attach(`safe-area-failure-${label}.json`, {
          path: jsonPath,
          contentType: "application/json",
        });
      }
    } catch (err) {
       
      console.warn(`[safe-area-report] attach ao TestInfo falhou`, err);
    }
  }

   
  console.warn(
    `\n[safe-area-report] ⚠️  Falha capturada: ${label}\n` +
      `  Projeto:    ${projectName}\n` +
      `  Mensagem:   ${payload.message}\n` +
      `  Ofensores:  ${offenders.length}\n` +
      `  Screenshot: ${screenshotOk ? screenshotPath : "(falhou)"}\n` +
      `  JSON:       ${jsonOk ? jsonPath : "(falhou)"}\n`,
  );

  return screenshotOk && jsonOk
    ? { screenshotPath, jsonPath }
    : null;
}

/**
 * Wrapper conveniente: roda `assertFn`; em caso de falha, captura o
 * relatório e re-lança o erro original (mensagem preservada).
 */
export async function withFailureReport<T>(
  page: Page,
  label: string,
  assertFn: () => Promise<T>,
  buildPayload?: () =>
    | Promise<{ offenders?: Offender[]; extra?: Record<string, unknown> }>
    | { offenders?: Offender[]; extra?: Record<string, unknown> },
): Promise<T> {
  try {
    return await assertFn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    let extras: { offenders?: Offender[]; extra?: Record<string, unknown> } = {};
    if (buildPayload) {
      try {
        extras = await buildPayload();
      } catch (buildErr) {
         
        console.warn(
          `[safe-area-report] buildPayload falhou para "${label}"`,
          buildErr,
        );
      }
    }
    await captureFailureReport(page, label, {
      message,
      offenders: extras.offenders,
      extra: extras.extra,
    });
    throw err;
  }
}
