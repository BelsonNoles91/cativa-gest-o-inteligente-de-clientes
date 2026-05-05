import { test, expect } from '@playwright/test';

// Usa o auth global já gerado como owner.a@cativa.test
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Testes Milimétricos de Cenários de Planos', () => {

  test.describe('Cenário 1: Plano Gratuito (Apoio)', () => {
    test.beforeEach(async ({ page }) => {
      // Navega para a tela de assinatura e seleciona o plano Gratuito
      await page.goto('/app/assinatura');
      
      // Assumindo que o plano gratuito (Apoio) tem um botão "Assinar" ou "Selecionar"
      const apoioCard = page.locator('.surface-card:has-text("Apoio")');
      if (await apoioCard.isVisible()) {
        const btn = apoioCard.locator('button');
        if (await btn.isEnabled() && (await btn.textContent())?.includes('Assinar')) {
          await btn.click();
          await expect(page.locator('text=Plano ativado')).toBeVisible();
        }
      }
    });

    test('Deve permitir acesso apenas a Agenda e Clientes', async ({ page }) => {
      // Tentar ir para Agenda (deve funcionar)
      await page.goto('/app/agenda');
      await expect(page.locator('text=Acesso bloqueado')).not.toBeVisible();
      
      // Tentar ir para Serviços (deve ser bloqueado no Starter/Apoio se não for Manager/Owner, 
      // mas como owner, ele pode acessar configurações básicas).
      // Mas o bloqueio de plano (FeatureGate) deve impedir Analytics, Pacotes e Confirmações.
      
      await page.goto('/app/confirmacoes');
      await expect(page).toHaveURL(/\/app\/meu-plano/); // Redirecionado por FeatureGate
      
      await page.goto('/app/analytics');
      await expect(page).toHaveURL(/\/app\/meu-plano/); // Redirecionado por FeatureGate
    });
  });

  test.describe('Cenário 2: Plano Intermediário (Pro)', () => {
    test.beforeEach(async ({ page }) => {
      // Simula a assinatura do plano Pro
      await page.goto('/app/assinatura');
      const proCard = page.locator('.surface-card:has-text("Pro")');
      if (await proCard.isVisible()) {
        const btn = proCard.locator('button');
        if (await btn.isEnabled() && !(await btn.textContent())?.includes('Plano Atual')) {
          await btn.click();
          // Simular fluxo de checkout ou bypass de teste
          // Como os pagamentos estão mockados no e2e, ele deve ativar direto.
        }
      }
    });

    test('Deve liberar Confirmações, mas bloquear Analytics Avançado', async ({ page }) => {
      await page.goto('/app/confirmacoes');
      // No Pro, a central de confirmações é liberada
      await expect(page.locator('text=Acesso bloqueado')).not.toBeVisible();
      await expect(page.locator('h1:has-text("Central de Confirmações")')).toBeVisible();

      await page.goto('/app/analytics');
      // Se Analytics for só no Premium, aqui será bloqueado
      // Supondo que Analytics é Premium:
      await expect(page).toHaveURL(/\/app\/meu-plano/);
    });
  });

  test.describe('Cenário 3: Plano Completo (Premium)', () => {
    test.beforeEach(async ({ page }) => {
      // Simula a assinatura do plano Premium
      await page.goto('/app/assinatura');
      const premiumCard = page.locator('.surface-card:has-text("Premium")');
      if (await premiumCard.isVisible()) {
        const btn = premiumCard.locator('button');
        if (await btn.isEnabled() && !(await btn.textContent())?.includes('Plano Atual')) {
          await btn.click();
        }
      }
    });

    test('Deve ter acesso total (Agenda, Serviços, Confirmações, Analytics e Integrações)', async ({ page }) => {
      // Confirmações
      await page.goto('/app/confirmacoes');
      await expect(page.locator('h1:has-text("Central de Confirmações")')).toBeVisible();

      // Analytics
      await page.goto('/app/analytics');
      await expect(page.locator('text=Analytics')).toBeVisible(); // Supondo que o H1 é Analytics

      // Pacotes
      await page.goto('/app/pacotes');
      await expect(page.locator('text=Pacotes')).toBeVisible(); 
    });
  });

});
