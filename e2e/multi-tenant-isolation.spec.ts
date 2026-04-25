
import { test, expect } from '@playwright/test';

/**
 * Matriz de Cenários Multi-Tenant:
 * Valida se um usuário de um tenant não consegue ver dados de outro.
 */

test.describe('Isolamento Multi-Tenant e Hierarquia', () => {

  const TENANT_A = {
    email: 'owner.a@cativa.test',
    password: 'Cativa@Test2026',
    clientName: 'Cliente do Tenant A'
  };

  const TENANT_B = {
    email: 'owner.b@cativa.test',
    password: 'Cativa@Test2026',
    clientName: 'Cliente do Tenant B'
  };

  test('Garantir isolamento de dados entre Tenant A e Tenant B', async ({ browser }) => {
    // Contexto para Tenant A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('/auth/login');
    await pageA.fill('input[name="email"]', TENANT_A.email);
    await pageA.fill('input[name="password"]', TENANT_A.password);
    await pageA.click('button[type="submit"]');
    await pageA.click('nav >> text=Clientes');
    
    // Contexto para Tenant B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('/auth/login');
    await pageB.fill('input[name="email"]', TENANT_B.email);
    await pageB.fill('input[name="password"]', TENANT_B.password);
    await pageB.click('button[type="submit"]');
    await pageB.click('nav >> text=Clientes');

    // Tenant A não deve ver clientes do Tenant B
    await expect(pageA.locator('table')).not.toContainText(TENANT_B.clientName);
    
    // Tenant B não deve ver clientes do Tenant A
    await expect(pageB.locator('table')).not.toContainText(TENANT_A.clientName);

    await contextA.close();
    await contextB.close();
  });

  test('Validação de Hierarquia: Manager não deve acessar Super Admin', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'manager@cativa.test');
    await page.fill('input[name="password"]', 'Cativa@Test2026');
    await page.click('button[type="submit"]');

    // Tentar acessar rota protegida de Super Admin
    await page.goto('/app/super-admin');
    
    // Deve ser redirecionado ou ver mensagem de erro
    await expect(page).not.toHaveURL(/\/app\/super-admin/);
    await expect(page.locator('body')).toContainText(/não tem permissão/i);
  });
});
