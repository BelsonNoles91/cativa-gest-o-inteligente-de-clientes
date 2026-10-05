import { expect, type Page, type TestInfo } from "@playwright/test";

export interface LayoutDiagnostics {
  viewport: { width: number; height: number };
  document: { clientWidth: number; scrollWidth: number; clientHeight: number; scrollHeight: number };
  overflow: Array<{
    selector: string;
    tag: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    text: string;
  }>;
  viewportEscapes: Array<{
    selector: string;
    tag: string;
    side: string;
    delta: number;
  }>;
  smallInteractiveTargets: Array<{
    selector: string;
    tag: string;
    text: string;
    width: number;
    height: number;
  }>;
  fixedElements: Array<{
    selector: string;
    tag: string;
    zIndex: string;
    width: number;
    height: number;
    top: number;
    left: number;
  }>;
  overlaps: Array<{
    fixedSelector: string;
    targetSelector: string;
    fixedZIndex: string;
    intersectionArea: number;
    targetArea: number;
  }>;
}

const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

/**
 * Coleta invariantes de layout no browser. O resultado é anexado ao relatório
 * quando um teste falha, tornando regressões de CSS reproduzíveis no CI.
 */
export async function collectLayoutDiagnostics(page: Page): Promise<LayoutDiagnostics> {
  return page.evaluate((interactiveSelector) => {
    const root = document.documentElement;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const selectorFor = (element: Element) => {
      const html = element as HTMLElement;
      const testId = html.dataset.testid;
      if (testId) return `[data-testid="${testId}"]`;
      const id = html.id;
      if (id) return `#${id}`;
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role");
      return role ? `${tag}[role="${role}"]` : tag;
    };
    const isVisible = (element: Element) => {
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    };
    const isInsideIntentionalScroller = (element: Element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const parentStyle = getComputedStyle(parent);
        if (["auto", "clip", "hidden", "scroll"].includes(parentStyle.overflowX)) {
          return true;
        }
        if (
          parent.matches(
            '[data-horizontal-scroll], [data-layout-overflow="allowed"], [role="grid"]',
          )
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const overflow: LayoutDiagnostics["overflow"] = [];
    const viewportEscapes: LayoutDiagnostics["viewportEscapes"] = [];
    const fixedElements: LayoutDiagnostics["fixedElements"] = [];
    const fixedCandidates: Array<{ element: HTMLElement; selector: string; zIndex: string; rect: DOMRect }> = [];
    const criticalCandidates: Array<{ element: HTMLElement; selector: string; rect: DOMRect }> = [];

    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (!isVisible(element) || element.dataset.layoutIgnore === "true") return;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const selector = selectorFor(element);

      if (style.position === "fixed" || style.position === "sticky") {
        fixedElements.push({
          selector,
          tag: element.tagName.toLowerCase(),
          zIndex: style.zIndex,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        });
        if (style.position === "fixed") {
          fixedCandidates.push({ element, selector, zIndex: style.zIndex, rect });
        }
      }

      if (!isInsideIntentionalScroller(element)) {
        if (rect.left < -1 || rect.right > viewport.width + 1) {
          overflow.push({
            selector,
            tag: element.tagName.toLowerCase(),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            text: (element.getAttribute("aria-label") || element.textContent || "")
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 120),
          });
        }
      }

      const isCritical =
        element.matches(
          '[data-critical-action], [data-bottom-nav-item], [data-bottom-nav-more], [data-layout-critical]',
        ) || element.closest('[data-layout-critical]');
      if (isCritical) {
        criticalCandidates.push({ element, selector, rect });
        let fixedToViewport = false;
        let ancestor: HTMLElement | null = element;
        while (ancestor && ancestor !== document.body) {
          if (getComputedStyle(ancestor).position === "fixed") {
            fixedToViewport = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        if (fixedToViewport && rect.left < -1) {
          viewportEscapes.push({ selector, tag: element.tagName.toLowerCase(), side: "left", delta: Math.round(-rect.left) });
        }
        if (fixedToViewport && rect.right > viewport.width + 1) {
          viewportEscapes.push({ selector, tag: element.tagName.toLowerCase(), side: "right", delta: Math.round(rect.right - viewport.width) });
        }
        if (fixedToViewport && rect.top < -1) {
          viewportEscapes.push({ selector, tag: element.tagName.toLowerCase(), side: "top", delta: Math.round(-rect.top) });
        }
        if (fixedToViewport && rect.bottom > viewport.height + 1) {
          viewportEscapes.push({ selector, tag: element.tagName.toLowerCase(), side: "bottom", delta: Math.round(rect.bottom - viewport.height) });
        }
      }
    });

    const overlaps: LayoutDiagnostics["overlaps"] = [];
    const activeDialogs = Array.from(
      document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'),
    ).filter(isVisible);
    const activeDialog = activeDialogs.at(-1) ?? null;
    for (const fixed of fixedCandidates) {
      const fixedHasContent =
        Boolean(fixed.element.textContent?.trim()) ||
        Boolean(fixed.element.querySelector('button, [role="button"], a[href]'));
      if (fixed.element.tagName === "OL" && !fixedHasContent) continue;

      for (const target of criticalCandidates) {
        if (
          fixed.element === target.element ||
          fixed.element.contains(target.element) ||
          target.element.contains(fixed.element) ||
          fixed.element.dataset.layoutIgnore === "true" ||
          target.element.dataset.layoutIgnore === "true"
        ) continue;
        // Um dialog aberto bloqueia intencionalmente a página de fundo. Mede-se
        // o que está dentro do dialog contra controles fixos, não o CTA que ele
        // próprio encobriu ao abrir.
        if (activeDialog && !activeDialog.contains(target.element)) continue;
        const isDialogBackdrop =
          activeDialog !== null &&
          fixed.rect.width >= viewport.width - 2 &&
          fixed.rect.height >= viewport.height - 2;
        if (isDialogBackdrop) continue;
        const left = Math.max(fixed.rect.left, target.rect.left);
        const right = Math.min(fixed.rect.right, target.rect.right);
        const top = Math.max(fixed.rect.top, target.rect.top);
        const bottom = Math.min(fixed.rect.bottom, target.rect.bottom);
        const intersectionArea = Math.max(0, right - left) * Math.max(0, bottom - top);
        const targetArea = Math.max(1, target.rect.width * target.rect.height);
        if (intersectionArea > 8 && intersectionArea / targetArea >= 0.2) {
          overlaps.push({
            fixedSelector: fixed.selector,
            targetSelector: target.selector,
            fixedZIndex: fixed.zIndex,
            intersectionArea: Math.round(intersectionArea),
            targetArea: Math.round(targetArea),
          });
        }
      }
    }

    const smallInteractiveTargets: LayoutDiagnostics["smallInteractiveTargets"] = [];
    document.querySelectorAll<HTMLElement>(interactiveSelector).forEach((element) => {
      if (!isVisible(element) || element.dataset.layoutIgnore === "true") return;
      if (!element.matches('[data-layout-critical], [data-critical-action], [data-bottom-nav-item], [data-bottom-nav-more]')) return;
      const rect = element.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        smallInteractiveTargets.push({
          selector: selectorFor(element),
          tag: element.tagName.toLowerCase(),
          text: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    });

    return {
      viewport,
      document: {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        clientHeight: root.clientHeight,
        scrollHeight: root.scrollHeight,
      },
      overflow: overflow.slice(0, 25),
      viewportEscapes: viewportEscapes.slice(0, 25),
      smallInteractiveTargets: smallInteractiveTargets.slice(0, 25),
      fixedElements: fixedElements.slice(0, 40),
      overlaps: overlaps.slice(0, 25),
    };
  }, INTERACTIVE_SELECTOR);
}

export async function assertLayoutContract(
  page: Page,
  label: string,
  testInfo?: TestInfo,
): Promise<LayoutDiagnostics> {
  const diagnostics = await collectLayoutDiagnostics(page);
  if (testInfo) {
    await testInfo.attach(`${label}-layout.json`, {
      body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
      contentType: "application/json",
    });
  }

  expect(
    diagnostics.document.scrollWidth,
    `${label}: overflow horizontal no documento (${diagnostics.document.scrollWidth}px > ${diagnostics.document.clientWidth}px): ${JSON.stringify(diagnostics.overflow)}`,
  ).toBeLessThanOrEqual(diagnostics.document.clientWidth + 1);
  expect(
    diagnostics.overflow,
    `${label}: elementos ultrapassam a viewport: ${JSON.stringify(diagnostics.overflow)}`,
  ).toEqual([]);
  expect(
    diagnostics.viewportEscapes,
    `${label}: ações críticas escapam da viewport: ${JSON.stringify(diagnostics.viewportEscapes)}`,
  ).toEqual([]);

  const dialogs = page.locator('[role="dialog"]:visible');
  for (let index = 0; index < await dialogs.count(); index += 1) {
    const box = await dialogs.nth(index).boundingBox();
    if (!box) continue;
    expect(box.width, `${label}: dialog ${index} excede a largura da viewport`).toBeLessThanOrEqual(
      diagnostics.viewport.width + 1,
    );
    expect(box.x, `${label}: dialog ${index} sai pela esquerda`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${label}: dialog ${index} sai pela direita`).toBeLessThanOrEqual(
      diagnostics.viewport.width + 1,
    );
    expect(box.y, `${label}: dialog ${index} sai pelo topo`).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height, `${label}: dialog ${index} sai pela base`).toBeLessThanOrEqual(
      diagnostics.viewport.height + 1,
    );
  }

  expect(
    diagnostics.smallInteractiveTargets,
    `${label}: alvos críticos menores que 44px: ${JSON.stringify(diagnostics.smallInteractiveTargets)}`,
  ).toEqual([]);
  expect(
    diagnostics.overlaps,
    `${label}: elemento fixo cobre uma ação crítica: ${JSON.stringify(diagnostics.overlaps)}`,
  ).toEqual([]);

  return diagnostics;
}

export async function assertFocusIsVisible(page: Page, label: string): Promise<void> {
  const focused = page.locator(":focus").first();
  if ((await focused.count()) === 0) return;
  const result = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      boxShadow: style.boxShadow,
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  expect(
    result.outlineWidth > 0 || result.boxShadow !== "none",
    `${label}: elemento focado não possui indicador visual de foco`,
  ).toBe(true);
  expect(result.rect.left).toBeGreaterThanOrEqual(-1);
  expect(result.rect.right).toBeLessThanOrEqual(result.viewport.width + 1);
  expect(result.rect.top).toBeLessThanOrEqual(result.viewport.height + 1);
  expect(result.rect.bottom).toBeGreaterThanOrEqual(-1);
}
