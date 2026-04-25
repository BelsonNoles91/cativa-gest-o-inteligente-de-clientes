import { test, expect } from '@playwright/test';

/**
 * Suite de testes E2E para validação de Responsividade e Acessibilidade básica.
 */

test.describe('UX e Responsividade', () => {

  test('Layout Mobile - Menu Lateral vira Bottom Nav ou Burger', async ({ page }) => {
    // Definir viewport mobile (iPhone 13)
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'owner@cativa.test');
    await page.fill('input[name="password"]', 'Cativa@Test2026');
    await page.click('button[type="submit"]');

    // Em mobile, o menu lateral deve estar oculto ou ser acessível via trigger
    const sidebar = page.locator('aside');
    const menuTrigger = page.locator('[data-testid="mobile-menu-trigger"]');
    
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await expect(page.locator('nav')).toBeVisible();
    } else {
      // Se for bottom nav, verificar se itens estão visíveis
      await expect(page.locator('nav')).toBeVisible();
    }
  });

  test('Acessibilidade básica (Aria-Labels)', async ({ page }) => {
    await page.goto('/auth/login');
    // Inputs críticos devem ter labels ou aria-labels
    await expect(page.locator('input[name="email"]')).toHaveAttribute('aria-label', /email/i);
    await expect(page.locator('button[type="submit"]')).not.toBeDisabled();
  });
});
