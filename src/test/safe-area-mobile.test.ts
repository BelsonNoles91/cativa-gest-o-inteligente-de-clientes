/**
 * Testes estáticos de safe-area, bottom nav e rolagem mobile.
 *
 * Cobre cenários de regressão que costumam quebrar em:
 *   • iPhones com notch em landscape (safe-area-inset-left/right)
 *   • iPhones em portrait (home indicator → safe-area-inset-bottom)
 *   • Android 360×800 (telas estreitas, sem notch mas com gesture bar)
 *   • Laptop 1366×768 (bottom nav some, sidebar aparece em md:)
 *
 * Como rodam em <100ms, são executados em CI a cada commit.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const FILES = {
  indexCss: read("src/index.css"),
  indexHtml: read("index.html"),
  bottomNav: read("src/components/shell/BottomNav.tsx"),
  appLayout: read("src/components/shell/AppLayout.tsx"),
  appHeader: read("src/components/shell/AppHeader.tsx"),
  portalLayout: read("src/components/shell/PortalLayout.tsx"),
  manifest: read("public/manifest.webmanifest"),
  offlineBanner: read("src/components/shell/OfflineBanner.tsx"),
  offlineHtml: read("public/offline.html"),
} as const;

describe("Safe-area & viewport — fundações no index.html / index.css", () => {
  it("viewport meta tem viewport-fit=cover (necessário para usar safe-area)", () => {
    expect(FILES.indexHtml).toMatch(/viewport-fit=cover/);
  });

  it("apple-mobile-web-app-status-bar-style é black-translucent (UI sob o notch)", () => {
    expect(FILES.indexHtml).toMatch(
      /name="apple-mobile-web-app-status-bar-style"\s+content="black-translucent"/,
    );
  });

  it("apple-mobile-web-app-capable e mobile-web-app-capable estão habilitados", () => {
    expect(FILES.indexHtml).toMatch(/name="apple-mobile-web-app-capable"\s+content="yes"/);
    expect(FILES.indexHtml).toMatch(/name="mobile-web-app-capable"\s+content="yes"/);
  });

  it("manifest.webmanifest declara display:standalone (PWA instalável)", () => {
    expect(FILES.manifest).toMatch(/"display":\s*"standalone"/);
  });

  it("CSS define utilitários pt/pb/pl/pr-safe usando env(safe-area-inset-*)", () => {
    expect(FILES.indexCss).toMatch(/\.pb-safe\s*\{[\s\S]*env\(safe-area-inset-bottom\)/);
    expect(FILES.indexCss).toMatch(/\.pt-safe\s*\{[\s\S]*env\(safe-area-inset-top\)/);
    expect(FILES.indexCss).toMatch(/\.pl-safe\s*\{[\s\S]*env\(safe-area-inset-left\)/);
    expect(FILES.indexCss).toMatch(/\.pr-safe\s*\{[\s\S]*env\(safe-area-inset-right\)/);
  });

  it("pb-bottom-nav reserva 4.25rem + safe-area-inset-bottom no main", () => {
    expect(FILES.indexCss).toMatch(
      /\.pb-bottom-nav\s*\{[\s\S]*calc\(4\.25rem\s*\+\s*env\(safe-area-inset-bottom\)\)/,
    );
  });

  it("min-h-touch e min-w-touch ≥ 44px (Apple HIG)", () => {
    const h = FILES.indexCss.match(/\.min-h-touch\s*\{\s*min-height:\s*(\d+)px/);
    const w = FILES.indexCss.match(/\.min-w-touch\s*\{\s*min-width:\s*(\d+)px/);
    expect(h, "min-h-touch ausente").toBeTruthy();
    expect(w, "min-w-touch ausente").toBeTruthy();
    expect(Number(h![1])).toBeGreaterThanOrEqual(44);
    expect(Number(w![1])).toBeGreaterThanOrEqual(44);
  });

  it("inputs em mobile têm 16px (evita zoom automático no iOS)", () => {
    expect(FILES.indexCss).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]*input[\s\S]*font-size:\s*16px/,
    );
  });

  it("body usa overscroll-behavior-y: contain (evita pull-to-refresh acidental)", () => {
    expect(FILES.indexCss).toMatch(/overscroll-behavior-y:\s*contain/);
  });

  it("standalone preenche cor de fundo do status bar", () => {
    expect(FILES.indexCss).toMatch(
      /@media all and \(display-mode:\s*standalone\)[\s\S]*background-color:\s*hsl\(var\(--background\)\)/,
    );
  });
});

describe("BottomNav — visível só em mobile, com safe-area completa", () => {
  const src = FILES.bottomNav;

  it("é fixa no rodapé (fixed inset-x-0 bottom-0)", () => {
    expect(src).toMatch(/fixed\s+inset-x-0\s+bottom-0/);
  });

  it("aplica pb-safe (home indicator) + pl-safe + pr-safe (notch landscape)", () => {
    expect(src).toMatch(/pb-safe/);
    expect(src).toMatch(/pl-safe/);
    expect(src).toMatch(/pr-safe/);
  });

  it("é escondida em md+ (md:hidden) — bottom nav só em mobile/tablet portrait", () => {
    expect(src).toMatch(/md:hidden/);
  });

  it("usa backdrop-blur + bg semi-transparente para legibilidade sobre conteúdo", () => {
    expect(src).toMatch(/backdrop-blur/);
    expect(src).toMatch(/bg-background\/9\d/);
  });

  it("z-index é alto o suficiente (z-40+) para ficar acima do conteúdo rolável", () => {
    const m = src.match(/\bz-(\d+)\b/);
    expect(m, "z-index ausente no nav").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(40);
  });

  it("cada item primário e o botão Mais têm min-h-touch (alvo de toque ≥44px)", () => {
    const links = src.match(/<NavLink[\s\S]*?\/NavLink>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link, "NavLink sem min-h-touch").toMatch(/min-h-touch/);
    }
    // Botão "Mais" — captura o <button ...> inteiro (do '<button' até o '>' de abertura,
    // tolerando atributos em múltiplas linhas)
    const moreBtn = src.match(/<button\b[\s\S]*?aria-label="Mais opções"[\s\S]*?>/);
    expect(moreBtn, "Botão Mais não encontrado").toBeTruthy();
    expect(moreBtn![0]).toMatch(/min-h-touch/);
  });

  it("rótulos usam truncate para não vazarem em Android 360 (5 itens)", () => {
    expect(src).toMatch(/truncate/);
  });

  it("ícones têm tamanho fixo (h-5 w-5) — não distorcem em telas estreitas", () => {
    expect(src).toMatch(/<item\.icon className="h-5 w-5"/);
  });

  it("botão Mais expõe aria-haspopup=dialog e aria-expanded (a11y)", () => {
    expect(src).toMatch(/aria-haspopup="dialog"/);
    expect(src).toMatch(/aria-expanded=\{moreOpen\}/);
  });

  it("Sheet de Mais módulos limita altura dinâmica e mantém conteúdo rolável dentro da safe-area", () => {
    expect(src).toMatch(/max-h-\[85dvh\]/);
    expect(src).toMatch(/overflow-hidden/);
    expect(src).toMatch(/min-h-0 flex-1/);
    expect(src).toMatch(/overflow-y-auto/);
    expect(src).toMatch(/pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
  });
});

describe("AppLayout — main reserva espaço para bottom nav + safe-area", () => {
  const src = FILES.appLayout;

  it("main usa pb-bottom-nav em mobile (libera espaço para nav fixa)", () => {
    expect(src).toMatch(/pb-bottom-nav/);
  });

  it("em desktop (md:) padding-bottom volta a md:pb-10 (sem bottom nav)", () => {
    expect(src).toMatch(/md:pb-10/);
  });

  it("sidebar é visível só em md+ (hidden md:block)", () => {
    expect(src).toMatch(/hidden md:block/);
  });

  it("OfflineBanner fica dentro do header autenticado para não cobrir controles", () => {
    expect(FILES.appHeader).toMatch(/<OfflineBanner\s*\/>/);
  });
});

describe("PortalLayout — main reserva espaço para bottom nav + safe-area", () => {
  const src = FILES.portalLayout;

  it("main usa pb-bottom-nav (compensa nav fixa do portal)", () => {
    expect(src).toMatch(/pb-bottom-nav/);
    expect(src).not.toMatch(/\bpb-28\b/);
  });

  it("nav inferior do portal é fixa (fixed inset-x-0 bottom-0)", () => {
    expect(src).toMatch(/fixed inset-x-0 bottom-0/);
  });

  it("nav inferior aplica pb-safe pl-safe pr-safe (equivalente ao tenant BottomNav)", () => {
    expect(src).toMatch(/pb-safe/);
    expect(src).toMatch(/pl-safe/);
    expect(src).toMatch(/pr-safe/);
  });

  it("OfflineBanner também aparece no portal", () => {
    expect(src).toMatch(/<OfflineBanner/);
  });
});

describe("OfflineBanner — fluxo do header e safe-area", () => {
  const src = FILES.offlineBanner;

  it("AppHeader e portal reservam a safe-area superior", () => {
    expect(FILES.appHeader).toMatch(/pt-safe-top/);
    expect(FILES.portalLayout).toMatch(/pt-safe-top/);
  });

  it("fica no fluxo do header em vez de sobrepor conteúdo e controles", () => {
    expect(src).toMatch(/relative z-50/);
    expect(src).not.toMatch(/fixed/);
  });

  it("mantém z-index de status para ficar acima do conteúdo no header", () => {
    expect(src).toMatch(/z-50/);
  });

  it("usa role=status + aria-live=polite (screen readers anunciam mudanças)", () => {
    expect(src).toMatch(/role="status"/);
    expect(src).toMatch(/aria-live="polite"/);
  });

  it("usa tokens semânticos success/warning (sem cores hardcoded)", () => {
    expect(src).toMatch(/border-success/);
    expect(src).toMatch(/border-warning/);
    // Não deve haver classes Tailwind diretas como bg-emerald-/bg-amber-
    expect(src).not.toMatch(/bg-(emerald|amber|red|green|blue|yellow)-\d/);
  });
});

describe("Página /offline.html — rolagem e safe-area", () => {
  const src = FILES.offlineHtml;

  it("body tem padding-top/bottom respeitando env(safe-area-inset-*)", () => {
    expect(src).toMatch(/padding-top:\s*max\(\s*\d+px,\s*env\(safe-area-inset-top\)\)/);
    expect(src).toMatch(/padding-bottom:\s*max\(\s*\d+px,\s*env\(safe-area-inset-bottom\)\)/);
  });

  it("viewport meta inclui viewport-fit=cover", () => {
    expect(src).toMatch(/viewport-fit=cover/);
  });

  it("botão de retry tem min-height ≥44px (alvo de toque)", () => {
    const m = src.match(/button\s*\{[\s\S]*?min-height:\s*(\d+)px/);
    expect(m, "min-height ausente no botão").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });
});

describe("Breakpoint matrix — invariantes por dispositivo", () => {
  // Testes "lógicos" que validam que classes Tailwind cobrem cada breakpoint.
  // Não renderizamos: apenas confirmamos que os helpers existem no CSS gerado
  // e que os componentes usam o seletor correto.

  it("iPhone 14 Pro landscape (852×393) — pl/pr-safe presentes na BottomNav", () => {
    // Em landscape iOS o notch fica à esquerda → precisa de pl-safe
    expect(FILES.bottomNav).toMatch(/pl-safe/);
    expect(FILES.bottomNav).toMatch(/pr-safe/);
  });

  it("iPhone SE (375×667) — bottom nav usa grid-cols-5 (4 atalhos + Mais)", () => {
    expect(FILES.bottomNav).toMatch(/grid-cols-5/);
  });

  it("Android 360×800 — text-[10.5px] mantém rótulos visíveis sem corte", () => {
    expect(FILES.bottomNav).toMatch(/text-\[10\.5px\]/);
  });

  it("Laptop 1366×768 — sidebar volta a aparecer (hidden md:block)", () => {
    expect(FILES.appLayout).toMatch(/hidden md:block/);
  });

  it("Laptop 1366×768 — main não usa pb-bottom-nav em md+ (md:pb-10)", () => {
    expect(FILES.appLayout).toMatch(/md:pb-10/);
  });
});
