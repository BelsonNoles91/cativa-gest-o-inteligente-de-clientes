/**
 * Dialog overflow — garante que modais críticos não estouram o viewport mobile.
 *
 * Asserts:
 *  - document.documentElement.scrollWidth <= viewport.width + 1
 *  - dialog boundingBox.width <= viewport.width - 16
 */
import { test, expect, type Page } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import {
  prepareAuthenticatedVisualState,
  prepareForSnapshot,
  assertNoHorizontalOverflow,
} from "../_helpers/visual";

const TIMEOUT = 60_000;

async function assertDialogFitsViewport(page: Page): Promise<void> {
  await assertNoHorizontalOverflow(page);

  const vw = page.viewportSize()?.width ?? 0;
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  const box = await dialog.boundingBox();
  expect(box, "Dialog sem bounding box").not.toBeNull();
  expect(
    box!.width,
    `Dialog width (${box!.width}px) deve caber no viewport (${vw}px - 16px)`,
  ).toBeLessThanOrEqual(vw - 16 + 1);

  const smallTargets = await dialog.locator(
    'button, [role="combobox"], [role="switch"], [role="tab"], input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select, textarea, a[href]',
  ).evaluateAll((elements) => elements.flatMap((element) => {
    const node = element as HTMLElement;
    if (node.getClientRects().length === 0) return [];
    const rect = node.getBoundingClientRect();
    return rect.width < 43.5 || rect.height < 43.5
      ? [{
          tag: node.tagName.toLowerCase(),
          role: node.getAttribute("role"),
          label: node.getAttribute("aria-label") || node.textContent?.trim().slice(0, 48) || "",
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        }]
      : [];
  }));
  expect(smallTargets, `Alvos de toque abaixo de 44×44 px: ${JSON.stringify(smallTargets)}`).toEqual([]);
}

async function openAppRoute(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });
}

test.describe("dialog overflow — mobile", () => {
  test.describe.configure({ timeout: TIMEOUT });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test.beforeEach(async ({ page }) => {
    await prepareAuthenticatedVisualState(page);
  });

  test("Agenda — dialog Novo agendamento", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, "Dialogs mobile");

    await openAppRoute(page, "/app/agenda");
    await prepareForSnapshot(page);

    const createBtn = page
      .locator('[data-testid="agenda-create-cta"], button:has-text("Novo agendamento")')
      .first();
    await createBtn.click();
    await prepareForSnapshot(page);
    await assertDialogFitsViewport(page);

    const overbookingSwitch = page.getByRole("switch", { name: "Encaixe / overbooking" });
    await expect(overbookingSwitch).toHaveAttribute("aria-checked", "false");
    await overbookingSwitch.click();
    await expect(overbookingSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[role="dialog"] input[type="time"]')).toBeVisible();
    await overbookingSwitch.click();
    await expect(overbookingSwitch).toHaveAttribute("aria-checked", "false");
    await expect(page.locator('[role="dialog"] input[type="time"]')).toHaveCount(0);
    await assertDialogFitsViewport(page);
  });

  test("Clientes — dialog Novo cliente", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, "Dialogs mobile");

    await openAppRoute(page, "/app/clientes");
    await prepareForSnapshot(page);

    await page.locator('[data-testid="clients-create-cta"]').click();
    await prepareForSnapshot(page);
    await assertDialogFitsViewport(page);
  });

  test("Confirmações — dialog Ações na fila", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, "Dialogs mobile");

    await openAppRoute(page, "/app/confirmacoes");
    await prepareForSnapshot(page);

    const actionBtn = page.locator('button:has-text("Ações")').first();
    if (!(await actionBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Nenhum item na fila de confirmações — pulando dialog");
      return;
    }

    await actionBtn.click();
    await prepareForSnapshot(page);
    await assertDialogFitsViewport(page);
  });
});
