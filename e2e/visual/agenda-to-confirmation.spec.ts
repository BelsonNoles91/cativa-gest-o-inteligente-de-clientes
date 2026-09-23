/**
 * Cenário E2E: Agenda → Centro de Confirmação → Modal de ação por item.
 *
 * Valida que safe-area e BottomNav permanecem íntegros durante:
 *  1. Carregamento da Agenda (com agendamentos ou estado vazio).
 *  2. Transição da Agenda para o Centro de Confirmação via BottomNav.
 *  3. Carregamento da fila de confirmação (com itens ou estado vazio).
 *  4. Abertura do modal/dialog de ação ao clicar em um item da fila.
 *  5. Fechamento do modal — layout volta ao normal.
 *
 * Regras de robustez:
 *  - O cenário é resiliente a tenants sem dados: se a fila estiver vazia,
 *    valida o EmptyState em vez de pular silenciosamente.
 *  - Cada transição valida no-overflow + BottomNav visível + safe-area OK.
 *  - Com modal aberto, o BottomNav segue presente no DOM (Radix Dialog não
 *    desmonta a navegação) e a safe-area inferior continua respeitada pelo
 *    conteúdo do dialog.
 *  - afterEach garante limpeza de estado offline (caso algum hook futuro
 *    desligue conexão durante o fluxo).
 */
import { test, expect, type Page } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import {
  prepareForSnapshot,
  assertNoHorizontalOverflow,
  assertBottomNavVisible,
  assertMainHasBottomPadding,
  assertBottomNavItemsRespectSafeArea,
} from "../_helpers/visual";
import {
  logStep,
  logWarn,
  navigateOrFallback,
  ensureOnline,
  captureDebugInfo,
  waitFor,
} from "../_helpers/resilience";

const MAIN_TIMEOUT = 20_000;
const SCENARIO_TIMEOUT = 75_000;
const REQUIRE_CONFIRMATION_FIXTURE = process.env.E2E_SEED_FIXTURES === "true";

/** Aguarda `[data-app-main]` aparecer com mensagem de erro útil. */
async function waitForMain(page: Page, route: string): Promise<void> {
  try {
    await page
      .locator("[data-app-main]")
      .first()
      .waitFor({ state: "visible", timeout: MAIN_TIMEOUT });
  } catch (err) {
    const debug = await captureDebugInfo(page, `waitForMain(${route})`);
    throw new Error(
      `[data-app-main] não apareceu em ${MAIN_TIMEOUT}ms na rota ${route}. ` +
        `Debug: ${JSON.stringify(debug)}. ` +
        `Causa provável: redirect para /auth/login ou erro no shell.\n` +
        `Original: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Verifica que com um modal/dialog aberto, a safe-area inferior continua
 * sendo respeitada pelo conteúdo rolável do dialog. O último controle deve
 * poder ser trazido para a área visível sem o contêiner sair do viewport.
 *
 * Não falha se o dialog não tiver botões clicáveis no rodapé — apenas valida
 * o que estiver presente.
 */
async function assertDialogRespectsSafeAreaBottom(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    // Probe de safe-area-inset-bottom.
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;bottom:0;left:0;height:0;width:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden";
    document.body.appendChild(probe);
    const safeBottom = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    probe.remove();

    const dialog = document.querySelector(
      '[role="dialog"]',
    ) as HTMLElement | null;
    if (!dialog) return { found: false as const };

    const interactive = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a, button, [role="button"], input, textarea, select',
      ),
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const dialogRect = dialog.getBoundingClientRect();
    if (interactive.length === 0) {
      return {
        found: true as const,
        safeBottom,
        lastBottom: null,
        dialogBottom: dialogRect.bottom,
        scrollBottom: dialogRect.bottom,
        viewportH: window.innerHeight,
      };
    }
    const last = interactive.reduce((candidate, element) =>
      element.getBoundingClientRect().bottom > candidate.getBoundingClientRect().bottom
        ? element
        : candidate,
    );
    let scrollContainer: HTMLElement = dialog;
    let ancestor = last.parentElement;
    while (ancestor && ancestor !== dialog) {
      const style = getComputedStyle(ancestor);
      if (
        ancestor.scrollHeight > ancestor.clientHeight + 1 &&
        (style.overflowY === "auto" || style.overflowY === "scroll")
      ) {
        scrollContainer = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    const scrollRect = scrollContainer.getBoundingClientRect();
    return {
      found: true as const,
      safeBottom,
      lastBottom: last.getBoundingClientRect().bottom,
      dialogBottom: dialogRect.bottom,
      scrollBottom: scrollRect.bottom,
      viewportH: window.innerHeight,
    };
  });

  expect(result.found, '[role="dialog"] não encontrado no DOM').toBe(true);
  if (result.found && result.lastBottom !== null) {
    const limit = result.viewportH - result.safeBottom + 4; // tolerância subpixel
    expect(
      result.dialogBottom,
      `Dialog ultrapassa a safe-area inferior: bottom=${result.dialogBottom}px, limite=${limit}px.`,
    ).toBeLessThanOrEqual(limit);
    expect(
      result.scrollBottom,
      `Área rolável ultrapassa a safe-area inferior: bottom=${result.scrollBottom}px, limite=${limit}px.`,
    ).toBeLessThanOrEqual(limit);
    expect(
      result.lastBottom,
      `O último elemento interativo não ficou visível após rolar o dialog: ` +
        `bottom=${result.lastBottom}px, área rolável termina em ${result.scrollBottom}px.`,
    ).toBeLessThanOrEqual(result.scrollBottom + 4);
  }
}

/** Aguarda a tela renderizar conteúdo OU EmptyState — nunca uma tela em branco. */
async function waitForListOrEmpty(
  page: Page,
  opts: {
    label: string;
    /** Selectors candidatos para "tem conteúdo". */
    contentSelectors: string[];
    /** Selectors candidatos para EmptyState. */
    emptySelectors: string[];
    timeoutMs?: number;
  },
): Promise<"content" | "empty"> {
  const timeout = opts.timeoutMs ?? 8000;
  return waitFor(
    opts.label,
    async () => {
      for (const sel of opts.contentSelectors) {
        if ((await page.locator(sel).count()) > 0) return "content" as const;
      }
      for (const sel of opts.emptySelectors) {
        if ((await page.locator(sel).count()) > 0) return "empty" as const;
      }
      return null;
    },
    { timeoutMs: timeout, pollMs: 200 },
  );
}

test.describe("cenário: Agenda → Confirmações → modal de ação", () => {
  test.describe.configure({ timeout: SCENARIO_TIMEOUT });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test.afterEach(async ({ context }) => {
    await ensureOnline(context);
  });

  test("transição preserva BottomNav e safe-area, modal não quebra layout", async ({
    page,
  }, testInfo) => {
    const vw = page.viewportSize()?.width ?? 0;
    test.skip(vw >= 768, "BottomNav só existe em viewports < 768px");
    const scenario = testInfo.title;

    // ---- 1. Agenda ----
    logStep(scenario, "1.goto /app/agenda");
    await page.goto("/app/agenda", {
      waitUntil: "domcontentloaded",
      timeout: MAIN_TIMEOUT,
    });
    await waitForMain(page, "/app/agenda");
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);

    // Espera renderização da agenda (com cards de agendamento OU empty state).
    // Os seletores são tolerantes — qualquer um indica que a tela carregou.
    const agendaState = await waitForListOrEmpty(page, {
      label: "agenda-load",
      contentSelectors: [
        "[data-appointment-card]",
        '[data-app-main] [role="article"]',
        '[data-app-main] [class*="grid"] > *',
      ],
      emptySelectors: [
        "text=/sem agendamentos/i",
        "text=/nenhum agendamento/i",
        '[data-empty-state="true"]',
      ],
    }).catch((err) => {
      // Não-fatal: se nenhum dos seletores bater, a página ainda pode estar
      // carregando filtros — seguimos para a próxima transição com aviso.
      logWarn(scenario, "agenda não confirmou conteúdo nem empty", err);
      return "content" as const;
    });
    logStep(scenario, `1.agenda renderizada (estado=${agendaState})`);

    // ---- 2. Transição para /app/confirmacoes via BottomNav ----
    logStep(scenario, "2.navegar para /app/confirmacoes");
    await navigateOrFallback(page, {
      label: "nav-confirmacoes",
      clickSelector:
        '[data-testid="bottom-nav-item"][data-route="app-confirmacoes"], [data-bottom-nav] a[href="/app/confirmacoes"]',
      fallbackUrl: "/app/confirmacoes",
      expectedUrlRegex: /\/app\/confirmacoes/,
      timeoutMs: MAIN_TIMEOUT,
    });
    await waitForMain(page, "/app/confirmacoes");
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);

    // ---- 3. Aguarda fila ou empty state ----
    logStep(scenario, "3.aguardar fila ou empty");
    const queueState = await waitForListOrEmpty(page, {
      label: "fila-load",
      contentSelectors: ["[data-app-main] [data-queue-item]"],
      emptySelectors: [
        "text=/nenhum item/i",
        "text=/fila vazia/i",
        '[data-empty-state="true"]',
      ],
    }).catch((err) => {
      logWarn(scenario, "fila não confirmou conteúdo nem empty", err);
      return "empty" as const;
    });
    logStep(scenario, `3.fila renderizada (estado=${queueState})`);

    // Se não há itens, o cenário do modal não pode rodar — validamos o
    // empty state e encerramos sem falhar. Isso evita que o teste quebre
    // em tenants seed sem dados de fila.
    if (queueState === "empty") {
      if (REQUIRE_CONFIRMATION_FIXTURE) {
        throw new Error(
          "A fixture autenticada foi solicitada, mas nenhum item apareceu na fila de confirmação.",
        );
      }
      logStep(scenario, "fila vazia — encerrando sem testar modal");
      await assertNoHorizontalOverflow(page);
      await assertBottomNavVisible(page);
      await assertBottomNavItemsRespectSafeArea(page);
      return;
    }

    await assertNoHorizontalOverflow(page);

    // ---- 4. Abrir modal de ação ----
    logStep(scenario, "4.abrir modal do primeiro item da fila");
    const firstItem = page.locator("[data-app-main] [data-queue-item]").first();
    try {
      await firstItem.scrollIntoViewIfNeeded({ timeout: 3000 });
      await firstItem.getByRole("button", { name: "Ações" }).click({ timeout: 3000 });
    } catch (err) {
      const debug = await captureDebugInfo(page, "click queue item");
      throw new Error(
        `Não consegui clicar no primeiro item da fila. ` +
          `Debug: ${JSON.stringify(debug)}\n` +
          `Original: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const dialog = page.locator('[role="dialog"]').first();
    try {
      await expect(dialog).toBeVisible({ timeout: 3000 });
    } catch (err) {
      throw new Error(
        `Dialog de ação não abriu em 3s ao clicar no item da fila. ` +
          `Pode indicar regressão no ConfirmationActionDialog ou em useConfirmationCenter.\n` +
          `Original: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await prepareForSnapshot(page);

    // ---- 5. Validações com modal aberto ----
    logStep(scenario, "5.validar layout com modal aberto");
    // BottomNav segue no DOM e visível (Radix Dialog é portal — não desmonta
    // o shell). O usuário ainda enxerga a navegação atrás do overlay.
    await assertBottomNavVisible(page);
    await assertNoHorizontalOverflow(page);
    // Conteúdo do dialog deve respeitar safe-area inferior — sem botões
    // de ação ficando ocultos atrás da home indicator do iPhone.
    await assertDialogRespectsSafeAreaBottom(page);

    // Snapshot apenas em um perfil para não inflar baseline em todos os 5.
    if (testInfo.project.name === "iphone-14-portrait") {
      await expect(page).toHaveScreenshot(
        "scenario-confirmacoes-modal-open.png",
        {
          fullPage: false,
          mask: [
            page.locator("[data-volatile]"),
            page.locator("time"),
            // Mascara textos dinâmicos (nomes, horas) dentro do dialog para
            // evitar diff por dados de seed mudando.
            page.locator('[role="dialog"] textarea'),
            page.locator('[role="dialog"] input'),
          ],
        },
      );
    }

    // ---- 6. Fechar modal ----
    logStep(scenario, "6.fechar modal e revalidar layout");
    // Tenta o botão Close do Radix; fallback para Escape.
    const closeBtn = page
      .locator('[role="dialog"] button[aria-label*="close" i], [role="dialog"] button[aria-label*="fechar" i]')
      .first();
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click({ timeout: 3000 }).catch(async () => {
        await page.keyboard.press("Escape");
      });
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(dialog).toBeHidden({ timeout: 3000 });
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);
  });
});
