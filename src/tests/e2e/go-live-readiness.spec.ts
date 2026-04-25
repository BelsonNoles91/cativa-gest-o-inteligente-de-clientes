import { test, expect } from '@playwright/test';

/**
 * Suite de testes E2E para validação de fluxos críticos de negócio
 * antes da liberação para produção (Go-Live).
 */

test.describe('Checklist de Liberação (Go-Live Readiness)', () => {

  test.beforeEach(async ({ page }) => {
    // Login padrão como Owner
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'owner@cativa.test');
    await page.fill('input[name="password"]', 'Cativa@Test2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/);
  });

  test('Configuração Completa do Perfil do Negócio', async ({ page }) => {
    await page.goto('/app/configuracoes');
    await page.click('text=Negócio');
    
    // Validar campos obrigatórios do perfil
    await page.fill('input[name="business_name"]', 'Clínica E2E Pro');
    await page.fill('input[name="legal_name"]', 'E2E Serviços Ltda');
    await page.fill('input[name="document_number"]', '12.345.678/0001-90');
    await page.click('button:has-text("Salvar")');
    
    await expect(page.locator('text=Configurações salvas')).toBeVisible();
  });

  test('Gestão de Unidades e Horários de Funcionamento', async ({ page }) => {
    await page.goto('/app/configuracoes');
    await page.click('[data-testid="settings-tab-units"]');
    
    // Adicionar Unidade
    await page.click('button:has-text("Nova Unidade")');
    await page.fill('input[name="name"]', 'Unidade Norte');
    await page.fill('input[name="address"]', 'Rua dos Testes, 123');
    await page.click('button:has-text("Criar")');
    
    await expect(page.locator('[data-testid="settings-units-panel"]')).toContainText('Unidade Norte');
  });

  test('Fluxo de Assinatura e Billing (Self-Service)', async ({ page }) => {
    await page.goto('/app/assinatura');
    
    // Validar se o plano Starter/Trial está visível
    await expect(page.locator('[data-testid="subscription-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-price"]')).not.toBeEmpty();
    
    // Validar navegação para Billing (Consumo)
    await page.goto('/app/meu-plano');
    await expect(page.locator('text=Consumo atual')).toBeVisible();
  });

  test('Segurança: Logout e Proteção de Rotas', async ({ page }) => {
    // Realizar Logout
    await page.click('[data-testid="user-menu-trigger"]');
    await page.click('text=Sair');
    
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Tentar acessar página protegida deslogado
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('Portabilidade de Dados: Exportação em Massa', async ({ page }) => {
    await page.goto('/app/importar-exportar');
    await page.click('[data-testid="import-export-tab-export"]');
    
    // Simular clique em exportar (validar se o botão está habilitado)
    const exportBtn = page.locator('button:has-text("Exportar Clientes")').first();
    await expect(exportBtn).toBeEnabled();
  });

});
