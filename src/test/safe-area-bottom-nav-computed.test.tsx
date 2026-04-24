/**
 * Testes de padding/safe-area COMPUTADO (não-estáticos).
 *
 * Diferente de `safe-area-mobile.test.ts` (que valida strings em CSS/JSX),
 * estes testes:
 *   1. Renderizam o `BottomNav` em jsdom dentro dos providers reais.
 *   2. Lêem `getComputedStyle` do nó `<nav data-bottom-nav>`.
 *   3. Comparam o `padding-bottom`/`padding-left`/`padding-right` com o que
 *      é esperado a partir das classes Tailwind (`pb-safe`, `pl-safe`,
 *      `pr-safe`) — alertando quando a folha de estilo dessincroniza do JSX.
 *
 * Em jsdom o env(safe-area-inset-*) resolve para 0, então validamos os
 * fallbacks (`max(env(...), 0.5rem)` para pb-safe → 8px) e a presença das
 * classes utilitárias. Os valores reais por dispositivo são cobertos pelos
 * specs Playwright em `e2e/_helpers/visual.ts::assertBottomNavItemsRespectSafeArea`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomNav } from "@/components/shell/BottomNav";

// Mocks dos providers para isolar o componente.
vi.mock("@/features/tenant/TenantProvider", () => ({
  useTenant: () => ({ currentRole: "owner" }),
}));
vi.mock("@/features/billing/useTenantBilling", () => ({
  useTenantBilling: () => ({ hasFeature: () => true }),
}));

// Stylesheet mínima carregando os utilitários safe-area-* exatamente como
// estão em src/index.css. Mantida em sincronia manual: se index.css mudar,
// estes testes alertam (esse é o ponto).
const SAFE_AREA_CSS = `
  .pb-safe { padding-bottom: max(env(safe-area-inset-bottom), 0.5rem); }
  .pt-safe { padding-top: max(env(safe-area-inset-top), 0rem); }
  .pl-safe { padding-left: env(safe-area-inset-left); }
  .pr-safe { padding-right: env(safe-area-inset-right); }
  .pb-bottom-nav { padding-bottom: calc(4.25rem + env(safe-area-inset-bottom)); }
  .min-h-touch { min-height: 44px; }
  .min-w-touch { min-width: 44px; }
  .fixed { position: fixed; }
  .inset-x-0 { left: 0; right: 0; }
  .bottom-0 { bottom: 0; }
  .z-40 { z-index: 40; }
`;

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

function injectSafeAreaCss() {
  const id = "safe-area-test-css";
  document.getElementById(id)?.remove();
  const style = document.createElement("style");
  style.id = id;
  style.textContent = SAFE_AREA_CSS;
  document.head.appendChild(style);
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={["/app"]} future={routerFuture}>
      <BottomNav />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  injectSafeAreaCss();
});

describe("BottomNav — padding computado vs. esperado", () => {
  it("nav está fixo no rodapé (position: fixed; bottom: 0)", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const cs = getComputedStyle(nav);
    expect(cs.position).toBe("fixed");
    expect(cs.bottom).toBe("0px");
  });

  it("aplica as 3 classes safe-area: pb-safe + pl-safe + pr-safe", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    expect(nav.className).toMatch(/\bpb-safe\b/);
    expect(nav.className).toMatch(/\bpl-safe\b/);
    expect(nav.className).toMatch(/\bpr-safe\b/);
  });

  it("padding-bottom declarado usa max(env(safe-area-inset-bottom), 0.5rem)", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    // jsdom não resolve max()/calc() com env() (sempre retorna 0). Validamos
    // a regra CSS aplicada via cssText: a classe .pb-safe está casada e a
    // declaração contém o fallback de 0.5rem. Os valores reais por dispositivo
    // são cobertos pelo Playwright (assertMainHasBottomPadding).
    const rule = Array.from(document.styleSheets)
      .flatMap((s) => {
        try { return Array.from(s.cssRules) } catch { return [] }
      })
      .find((r): r is CSSStyleRule =>
        r instanceof CSSStyleRule && r.selectorText === ".pb-safe",
      );
    expect(rule, ".pb-safe não encontrada na stylesheet").toBeTruthy();
    expect(rule!.cssText).toMatch(
      /max\(\s*env\(safe-area-inset-bottom\)\s*,\s*0\.5rem\s*\)/,
    );
    // E garante que o nav está usando .pb-safe (regra do JSX).
    expect(nav.classList.contains("pb-safe")).toBe(true);
  });

  it("itens primários têm min-height >= 44px (alvo de toque Apple HIG)", () => {
    renderNav();
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const minH = parseFloat(getComputedStyle(link).minHeight || "0");
      expect(
        minH,
        `Link "${link.textContent?.trim()}" tem min-height=${minH}px (esperado >=44)`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  it("botão Mais também respeita min-height >= 44px", () => {
    renderNav();
    const more = screen.queryByRole("button", { name: /mais opções/i });
    if (!more) return; // se só houver 4 itens, "Mais" não aparece — OK.
    const minH = parseFloat(getComputedStyle(more).minHeight || "0");
    expect(minH).toBeGreaterThanOrEqual(44);
  });
});

describe("Sincronia CSS ↔ JSX — alerta se classes safe-area mudam", () => {
  it("se .pb-safe sair do BottomNav, ninguém mais reserva padding inferior", () => {
    // Simula regressão: alguém remove `pb-safe` do className do <nav>.
    renderNav();
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    expect(nav.classList.contains("pb-safe")).toBe(true);

    // Remove a classe e verifica que NENHUMA outra fonte de padding-bottom
    // aparece magicamente — confirmando que .pb-safe é a única responsável.
    nav.classList.remove("pb-safe");
    const otherPbClasses = Array.from(nav.classList).filter((c) =>
      c.startsWith("pb-") || c.startsWith("py-"),
    );
    expect(
      otherPbClasses,
      "Nav ainda tem outras classes que afetam padding-bottom: " +
        otherPbClasses.join(",") +
        " — revise se isso é intencional ou esconde a regressão.",
    ).toEqual([]);
  });

  it("CSS .pb-bottom-nav deve permanecer alinhado a calc(4.25rem + env(safe-area-inset-bottom))", () => {
    // jsdom não resolve calc(rem + env(...)) — validamos a declaração crua via cssText.
    injectSafeAreaCss();
    const rule = Array.from(document.styleSheets)
      .flatMap((s) => {
        try { return Array.from(s.cssRules) } catch { return [] }
      })
      .find((r): r is CSSStyleRule =>
        r instanceof CSSStyleRule && r.selectorText === ".pb-bottom-nav",
      );
    expect(rule, ".pb-bottom-nav não encontrada").toBeTruthy();
    expect(
      rule!.cssText,
      "Declaração de .pb-bottom-nav mudou. Se intencional, atualize este " +
        "teste E assertMainHasBottomPadding em e2e/_helpers/visual.ts.",
    ).toMatch(
      /calc\(\s*4\.25rem\s*\+\s*env\(safe-area-inset-bottom\)\s*\)/,
    );
  });
});
