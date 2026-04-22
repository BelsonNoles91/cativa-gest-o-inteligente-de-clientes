/**
 * Testes visuais estáticos para 5 páginas críticas:
 *   - Lista de espera   (src/pages/app/Waitlist.tsx)
 *   - Serviços          (src/pages/app/Services.tsx)
 *   - Meu plano         (src/pages/app/Billing.tsx)
 *   - Importar/Exportar (src/pages/app/DataImportExport.tsx)
 *   - Configurações     (src/pages/app/Settings.tsx)
 *
 * Estratégia: análise estática do JSX (string-based) garantindo invariantes
 * Tailwind/a11y que previnem regressão de:
 *   1. Overflow horizontal em mobile (≤375)   → DialogContent com w-[calc(100vw-2rem)]
 *   2. Overflow vertical em modais            → DialogContent já tem max-h via shadcn (verificado)
 *   3. Truncamento de tabs                    → whitespace-nowrap em TabsTrigger
 *   4. Tabela larga sem scroll horizontal     → overflow-auto + min-w no <table>
 *   5. Padding duplo                          → sem `container mx-auto px-4 py-6` quando dentro de AppLayout
 *   6. Foco acessível em botões/modais        → DialogContent (focus trap nativo do Radix)
 *                                              + ausência de tabIndex={-1} em botões
 *
 * Esses checks rodam em <100ms e cobrem os breakpoints mobile (320/375/414)
 * e laptop 1366×768 indiretamente — as classes responsivas atuam neles.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");

function readPage(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const PAGES = {
  waitlist: readPage("src/pages/app/Waitlist.tsx"),
  services: readPage("src/pages/app/Services.tsx"),
  billing: readPage("src/pages/app/Billing.tsx"),
  dataImportExport: readPage("src/pages/app/DataImportExport.tsx"),
  settings: readPage("src/pages/app/Settings.tsx"),
  dialogPrimitive: readPage("src/components/ui/dialog.tsx"),
} as const;

/** Conta ocorrências de um padrão regex. */
function count(src: string, pattern: RegExp): number {
  return (src.match(pattern) ?? []).length;
}

/** Encontra todas as DialogContent com classes (captura className). */
function findDialogContents(src: string): string[] {
  // Captura `<DialogContent ...className="..."...>` ou `<DialogContent>` sem className
  const re = /<DialogContent\b([^>]*)>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push(m[1]);
  }
  return out;
}

/** Extrai o valor de className="..." de um trecho de atributos. */
function getClassName(attrs: string): string {
  const m = attrs.match(/className=("([^"]*)"|\{`([^`]*)`\})/);
  return m ? (m[2] ?? m[3] ?? "") : "";
}

describe("Páginas — invariantes visuais (mobile + 1366×768)", () => {
  describe("DialogContent base (shadcn) garante max-h + scroll", () => {
    it("tem max-h-[calc(100dvh-2rem)] e overflow-y-auto no primitive", () => {
      // Garante que TODOS os dialogs herdam scroll vertical em mobile
      expect(PAGES.dialogPrimitive).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
      expect(PAGES.dialogPrimitive).toMatch(/overflow-y-auto/);
    });
  });

  describe("Lista de espera (Waitlist.tsx)", () => {
    const src = PAGES.waitlist;
    const dialogs = findDialogContents(src);

    it("possui pelo menos 2 DialogContent (Novo item + Agendar)", () => {
      expect(dialogs.length).toBeGreaterThanOrEqual(2);
    });

    it("todos os DialogContent largos têm w-[calc(100vw-2rem)] (sem overflow horizontal em mobile)", () => {
      for (const attrs of dialogs) {
        const cls = getClassName(attrs);
        // Apenas dialogs com max-w-* (≥sm) precisam do clamp horizontal
        if (/max-w-(sm|md|lg|xl|\d+xl)/.test(cls)) {
          expect(cls, `DialogContent largo sem clamp horizontal: ${cls}`).toMatch(
            /w-\[calc\(100vw-2rem\)\]/,
          );
        }
      }
    });

    it("não tem overflow horizontal forçado no container raiz", () => {
      // Não deve haver overflow-x-hidden mascarando bugs reais
      expect(src).not.toMatch(/<div[^>]*className="[^"]*overflow-x-hidden[^"]*"[^>]*>\s*<PageHeader/);
    });

    it("usa flex-wrap em barras de ações para evitar corte", () => {
      // Botões da PageHeader e ações dos cards devem suportar quebra
      expect(count(src, /flex-wrap/g)).toBeGreaterThan(0);
    });
  });

  describe("Serviços (Services.tsx)", () => {
    const src = PAGES.services;
    const dialogs = findDialogContents(src);

    it("possui pelo menos 4 DialogContent (serviço, categoria, política, etc.)", () => {
      expect(dialogs.length).toBeGreaterThanOrEqual(4);
    });

    it("DialogContent grandes (max-w-3xl/2xl) têm clamp horizontal mobile", () => {
      for (const attrs of dialogs) {
        const cls = getClassName(attrs);
        if (/max-w-(2xl|3xl|4xl|5xl)/.test(cls)) {
          expect(cls, `Dialog grande sem clamp: ${cls}`).toMatch(/w-\[calc\(100vw-2rem\)\]/);
        }
      }
    });

    it("dialogs sem max-w explícito também têm clamp para evitar overflow em telas estreitas", () => {
      for (const attrs of dialogs) {
        const cls = getClassName(attrs);
        // Sem max-w → herda default (lg). Em telas <375 ainda pode estourar.
        // Aceitamos w-[calc(100vw-2rem)] OU sm:max-w-* explícito.
        if (!/max-w-/.test(cls)) {
          expect(cls, `Dialog sem max-w nem clamp: "${cls}"`).toMatch(
            /w-\[calc\(100vw-2rem\)\]/,
          );
        }
      }
    });

    it("usa grid responsivo com minmax(0,1fr) em layouts de duas colunas", () => {
      // Previne overflow horizontal causado por filhos com min-content > 0
      expect(src).toMatch(/minmax\(0,\s*1fr\)/);
    });
  });

  describe("Meu plano (Billing.tsx)", () => {
    const src = PAGES.billing;

    it("envolve conteúdo em wrapper com space-y para hierarquia consistente", () => {
      expect(src).toMatch(/<div className="space-y-4">[\s\S]*<PageHeader/);
    });

    it("usa grid responsivo lg:grid-cols-3 (vira coluna única em mobile)", () => {
      expect(src).toMatch(/lg:grid-cols-3/);
    });

    it("banner de aviso usa shrink-0 no ícone para não distorcer em telas estreitas", () => {
      expect(src).toMatch(/shrink-0/);
    });

    it("banner usa leading-relaxed para evitar texto comprimido", () => {
      expect(src).toMatch(/leading-relaxed/);
    });
  });

  describe("Importar & Exportar (DataImportExport.tsx)", () => {
    const src = PAGES.dataImportExport;

    it("não tem padding duplo (sem container mx-auto px-4 py-6 dentro de AppLayout)", () => {
      expect(src).not.toMatch(/container mx-auto px-4 py-6/);
    });

    it("usa max-w-5xl mx-auto como wrapper de largura máxima", () => {
      expect(src).toMatch(/max-w-5xl/);
      expect(src).toMatch(/mx-auto/);
    });

    it("tabela de prévia tem overflow-auto + min-w para scroll horizontal em mobile", () => {
      expect(src).toMatch(/overflow-auto/);
      expect(src).toMatch(/min-w-\[\d+px\]/);
    });

    it("células de tabela usam whitespace-nowrap para preservar legibilidade", () => {
      // Headers e células devem ter whitespace-nowrap dentro do bloco da tabela
      const tableBlock = src.match(/<table[\s\S]*?<\/table>/);
      expect(tableBlock).toBeTruthy();
      expect(tableBlock![0]).toMatch(/whitespace-nowrap/);
    });

    it("usa max-h-72 para limitar altura da prévia (scroll vertical)", () => {
      expect(src).toMatch(/max-h-72/);
    });
  });

  describe("Configurações (Settings.tsx)", () => {
    const src = PAGES.settings;

    it("TabsTrigger usa whitespace-nowrap (rótulos não quebram durante scroll horizontal)", () => {
      const triggerBlocks = src.match(/<TabsTrigger[\s\S]*?>/g) ?? [];
      expect(triggerBlocks.length).toBeGreaterThan(0);
      // Pelo menos um TabsTrigger compartilha className com whitespace-nowrap
      expect(src).toMatch(/whitespace-nowrap/);
    });

    it("ícones dos tabs usam shrink-0 (não encolhem em telas estreitas)", () => {
      // Procura `<X.icon className="h-4 w-4 shrink-0" />` ou similar
      expect(src).toMatch(/h-4 w-4 shrink-0/);
    });

    it("TabsList permite scroll horizontal em mobile", () => {
      // Aceita overflow-x-auto OU flex-wrap como estratégias válidas
      expect(src).toMatch(/(overflow-x-auto|flex-wrap)/);
    });
  });

  describe("Acessibilidade — foco em botões e modais", () => {
    it("nenhuma página remove o foco com tabIndex={-1} em botões interativos", () => {
      for (const [name, src] of Object.entries(PAGES)) {
        if (name === "dialogPrimitive") continue;
        // tabIndex={-1} só é aceitável em wrappers de focus-trap, NUNCA em <Button>
        const badPattern = /<Button[^>]*tabIndex=\{-1\}/;
        expect(src, `${name}: <Button> com tabIndex=-1 quebra navegação por teclado`).not.toMatch(
          badPattern,
        );
      }
    });

    it("todos os DialogTitle estão presentes (Radix exige para a11y)", () => {
      const pagesWithDialogs = ["waitlist", "services"] as const;
      for (const key of pagesWithDialogs) {
        const src = PAGES[key];
        const dialogContentCount = (src.match(/<DialogContent\b/g) ?? []).length;
        const dialogTitleCount = (src.match(/<DialogTitle\b/g) ?? []).length;
        expect(
          dialogTitleCount,
          `${key}: cada DialogContent precisa de DialogTitle (a11y)`,
        ).toBeGreaterThanOrEqual(dialogContentCount);
      }
    });

    it("Dialogs grandes mantêm botões de ação visíveis (footer no fluxo, não absolute)", () => {
      // DialogFooter com `position: absolute` quebraria scroll. Não deve aparecer.
      for (const [name, src] of Object.entries(PAGES)) {
        if (name === "dialogPrimitive") continue;
        const badFooter = /<DialogFooter[^>]*className="[^"]*\babsolute\b[^"]*"/;
        expect(src, `${name}: DialogFooter absolute quebra scroll mobile`).not.toMatch(badFooter);
      }
    });
  });

  describe("Breakpoint 1366×768 — invariantes específicos de laptop", () => {
    it("Serviços usa breakpoint xl: para coluna lateral fixa de 340px", () => {
      // Em <1280 (xl) vira single-column → cabe em 1366 com sidebar
      expect(PAGES.services).toMatch(/xl:grid-cols-\[340px_minmax\(0,\s*1fr\)\]/);
    });

    it("Meu plano usa lg:grid-cols-3 (ativo em 1366 — 3 colunas de planos)", () => {
      expect(PAGES.billing).toMatch(/lg:grid-cols-3/);
    });

    it("Lista de espera tem grid responsivo para listagem", () => {
      // Pelo menos uma classe md:grid-cols-* ou lg:grid-cols-*
      expect(PAGES.waitlist).toMatch(/(md|lg|xl):grid-cols-/);
    });
  });
});
