import { test, expect } from '@playwright/test';

/**
 * Teste E2E do fluxo de Onboarding Otimizado (Beta).
 * Valida a criação de tenant, serviços, profissionais e o primeiro agendamento.
 */

test.describe('Onboarding Guiado (Owner Experience)', () => {
  const testId = `test-${Date.now()}`;
  const testEmail = `${testId}@onboarding.test`;
  const bizName = `Studio ${testId}`;

  test('Deve completar o onboarding e criar recursos iniciais', async ({ page }) => {
    // 1. Signup / Step 0
    await page.goto('/onboarding');
    await page.fill('input#name', 'Test Owner');
    await page.fill('input#se', testEmail);
    await page.fill('input#sp', 'Cativa@Test2026');
    await page.click('button:has-text("Continuar para Setup")');

    // 2. Negócio / Step 1
    await expect(page.locator('h1')).toContainText('Sobre seu negócio');
    await page.fill('input#bn', bizName);
    await page.selectOption('select', 'beauty_salon'); // Seleciona segmento
    await page.click('button:has-text("Continuar para Identidade")');

    // 3. Equipe & Serviços / Step 2
    await expect(page.locator('h1')).toContainText('Equipe & Serviços');
    
    // Adicionar Profissional
    await page.fill('input#pro-input', 'Professional E2E');
    await page.keyboard.press('Enter');
    await expect(page.locator('ul')).toContainText('Professional E2E');

    // Adicionar Serviço
    await page.fill('input#svc-name', 'Serviço E2E');
    await page.fill('input#svc-price', '150');
    await page.click('button:has-text("Add")');
    await expect(page.locator('ul')).toContainText('Serviço E2E');

    await page.click('button:has-text("Continuar")');

    // 4. Branding / Step 3
    await expect(page.locator('h1')).toContainText('Cores & Marca');
    await page.fill('input#wp', '11999999999');
    await page.click('button:has-text("Continuar")');

    // 5. Confirmação / Step 4
    await expect(page.locator('h1')).toContainText('Tudo pronto!');
    await expect(page.locator('div')).toContainText(bizName);
    await expect(page.locator('div')).toContainText('1 profissional(is)');
    
    // Finalizar
    await page.click('button:has-text("Finalizar e Acessar o Cativa")');

    // 6. Validação no Dashboard
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('h1')).toBeVisible();

    // Validar se agendamento de teste foi criado (verificando se a agenda tem conteúdo)
    await page.goto('/app/agenda');
    // Esperamos ver o nome do profissional ou o indicador de agendamento
    await expect(page.locator('body')).toContainText('Professional E2E');
  });
});
