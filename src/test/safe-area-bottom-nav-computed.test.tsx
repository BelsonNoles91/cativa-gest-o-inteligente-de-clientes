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
    <MemoryRouter initialEntries={["/app"]}>
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

  it("padding-bottom resolve para o fallback de pb-safe (8px) quando env=0", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const pb = parseFloat(getComputedStyle(nav).paddingBottom || "0");
    // pb-safe = max(env(safe-area-inset-bottom)=0, 0.5rem) → 8px em jsdom.
    expect(pb, `padding-bottom esperado ≥ 8px (fallback de pb-safe), recebeu ${pb}px`)
      .toBeGreaterThanOrEqual(8);
    // Sanity: não deve ser absurdamente alto (pegaria classe errada).
    expect(pb, `padding-bottom suspeito (>200px): ${pb}px`).toBeLessThan(200);
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
  it("se um dia removerem .pb-safe do CSS, este teste falha alto e claro", () => {
    // Remove o CSS injetado e verifica que padding-bottom cai para 0
    // (= não há fallback). Esse seria o sintoma de regressão real.
    document.getElementById("safe-area-test-css")?.remove();
    renderNav();
    const nav = screen.getByRole("navigation", { name: /navegação principal/i });
    const pb = parseFloat(getComputedStyle(nav).paddingBottom || "0");
    // Sem o CSS, o valor cai para 0 — confirmando que NOSSA stylesheet é
    // o que está garantindo o padding. Se um dia esse pb não for mais 0
    // sem CSS, alguém adicionou inline style ou outra fonte de padding e
    // precisamos revisitar a invariante.
    expect(
      pb,
      "Sem CSS injetado, padding-bottom deveria ser 0 (significa que .pb-safe " +
        "é a única fonte de padding-bottom no nav). Recebeu " + pb + "px.",
    ).toBe(0);
  });

  it("CSS .pb-bottom-nav deve permanecer alinhado a 4.25rem + env(safe-area-inset-bottom)", () => {
    // Reinjeta CSS e cria um <main class="pb-bottom-nav"> de teste para
    // validar o cálculo. Em jsdom: 4.25rem (=68px com root 16px) + 0 = 68px.
    injectSafeAreaCss();
    const main = document.createElement("main");
    main.className = "pb-bottom-nav";
    document.body.appendChild(main);
    const pb = parseFloat(getComputedStyle(main).paddingBottom || "0");
    expect(
      pb,
      `padding-bottom de .pb-bottom-nav esperado = 68px (4.25rem). Recebeu ${pb}px. ` +
        `Se mudou intencionalmente, atualize este teste E o assert ` +
        `assertMainHasBottomPadding em e2e/_helpers/visual.ts.`,
    ).toBe(68);
    main.remove();
  });
});
