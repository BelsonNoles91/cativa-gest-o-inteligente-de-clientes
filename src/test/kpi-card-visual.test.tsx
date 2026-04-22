/**
 * Testes visuais automatizados para KpiCard.
 *
 * Garantem que em breakpoints móveis (320, 375, 414) e em 1366×768
 * os ícones, valores numéricos longos e badges de tendência:
 *   - permanecem visíveis (não são removidos por overflow:hidden)
 *   - mantêm hierarquia: ícone à esquerda, badge à direita, valor abaixo
 *   - não usam classes que cortam conteúdo (truncate / overflow-hidden no wrapper)
 *   - mantêm o ícone com tamanho fixo (não encolhe abaixo do mínimo)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { KpiCard } from "@/features/analytics/KpiCard";

const BREAKPOINTS = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-414", width: 414, height: 896 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1366", width: 1366, height: 768 },
] as const;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, writable: true, configurable: true });
  window.dispatchEvent(new Event("resize"));
}

describe("KpiCard — testes visuais por breakpoint", () => {
  beforeEach(() => {
    // garante valores realistas para getBoundingClientRect em jsdom
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return Math.min(window.innerWidth - 32, 400);
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get() {
        // simula que o conteúdo cabe (sem overflow real em jsdom)
        return this.offsetWidth ?? 0;
      },
    });
  });

  afterEach(() => cleanup());

  for (const bp of BREAKPOINTS) {
    describe(`@ ${bp.name} (${bp.width}×${bp.height})`, () => {
      beforeEach(() => setViewport(bp.width, bp.height));

      it("renderiza ícone, label, valor e badge sem ocultar nenhum", () => {
        const { container, getByText } = render(
          <div style={{ width: bp.width }}>
            <KpiCard
              label="Receita confirmada"
              value="R$ 128.450,00"
              hint="Comparado à semana anterior"
              icon={Sparkles}
              tone="success"
              trendPct={12}
            />
          </div>,
        );

        // Todos os elementos textuais devem existir no DOM
        expect(getByText("Receita confirmada")).toBeInTheDocument();
        expect(getByText("R$ 128.450,00")).toBeInTheDocument();
        expect(getByText("Comparado à semana anterior")).toBeInTheDocument();
        expect(getByText("+12%")).toBeInTheDocument();

        // Ícone presente (svg do lucide)
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
      });

      it("não aplica truncate no valor (deve permitir wrap se necessário)", () => {
        const { getByText } = render(
          <div style={{ width: bp.width }}>
            <KpiCard label="Ticket médio" value="R$ 1.234.567,89" icon={Sparkles} />
          </div>,
        );

        const valueEl = getByText("R$ 1.234.567,89");
        expect(valueEl.className).not.toMatch(/\btruncate\b/);
        expect(valueEl.className).not.toMatch(/\boverflow-hidden\b/);
      });

      it("badge de tendência negativa permanece visível e estilizada", () => {
        const { getByText } = render(
          <div style={{ width: bp.width }}>
            <KpiCard label="No-show" value="3,2%" icon={Sparkles} tone="danger" trendPct={-7} />
          </div>,
        );

        const badge = getByText("-7%");
        expect(badge).toBeInTheDocument();
        expect(badge.className).toMatch(/destructive/);
      });

      it("ícone mantém tamanho fixo (modo padrão h-4 w-4 / modo compacto h-3.5 w-3.5)", () => {
        const { container } = render(
          <div style={{ width: bp.width }}>
            <KpiCard label="Clientes ativos" value="1.284" icon={Sparkles} tone="brand" />
          </div>,
        );

        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
        const svgClass = svg!.getAttribute("class") ?? "";
        // Em alturas <800 o KpiCard ativa modo compacto (h-3.5). Caso contrário, h-4.
        const compact = bp.height < 800;
        if (compact) {
          expect(svgClass).toMatch(/h-3\.5/);
          expect(svgClass).toMatch(/w-3\.5/);
        } else {
          expect(svgClass).toMatch(/h-4/);
          expect(svgClass).toMatch(/w-4/);
        }

        // wrapper do ícone deve manter dimensões fixas (h-9 padrão / h-7 compacto)
        const iconWrapper = svg!.parentElement!;
        if (compact) {
          expect(iconWrapper.className).toMatch(/h-7/);
          expect(iconWrapper.className).toMatch(/w-7/);
        } else {
          expect(iconWrapper.className).toMatch(/h-9/);
          expect(iconWrapper.className).toMatch(/w-9/);
        }
        // Em qualquer modo o wrapper precisa ter shrink-0 para não encolher
        expect(iconWrapper.className).toMatch(/shrink-0/);
      });

      it("layout flex topo: ícone à esquerda, badge à direita (justify-between)", () => {
        const { container } = render(
          <div style={{ width: bp.width }}>
            <KpiCard label="Ocupação" value="87%" icon={Sparkles} trendPct={4} />
          </div>,
        );

        const card = container.querySelector(".surface-card");
        expect(card).not.toBeNull();
        const topRow = card!.firstElementChild as HTMLElement;
        expect(topRow.className).toMatch(/flex/);
        expect(topRow.className).toMatch(/items-center/);
        expect(topRow.className).toMatch(/justify-between/);
      });
    });
  }

  it("matriz: todos os breakpoints renderizam o conjunto completo de KPIs sem erro", () => {
    const kpis = [
      { label: "Receita", value: "R$ 128.450", trendPct: 12, tone: "success" as const },
      { label: "Confirmações", value: "94%", trendPct: 3, tone: "brand" as const },
      { label: "No-show", value: "3,2%", trendPct: -7, tone: "danger" as const },
      { label: "Ocupação", value: "87%", trendPct: 0, tone: "info" as const },
    ];

    for (const bp of BREAKPOINTS) {
      setViewport(bp.width, bp.height);
      const { unmount, getAllByText } = render(
        <div
          style={{ width: bp.width }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {kpis.map((k) => (
            <KpiCard key={k.label} icon={Sparkles} {...k} />
          ))}
        </div>,
      );

      for (const k of kpis) {
        expect(getAllByText(k.label).length).toBeGreaterThan(0);
        expect(getAllByText(k.value).length).toBeGreaterThan(0);
      }
      unmount();
    }
  });
});
