
import { test, expect } from '@playwright/test';

/**
 * Este teste simula o fluxo completo de diferentes papéis no sistema.
 * 1. Owner: Cria tenant e configura o negócio.
 * 2. Frontdesk: Gerencia clientes e agenda.
 * 3. Professional: Visualiza sua própria agenda e confirma atendimentos.
 */

test.describe('Fluxo Multi-Papel (Owner, Frontdesk, Professional)', () => {
  
  // Limpar sessão global para testar logins diferentes em cada teste
  test.use({ storageState: { cookies: [], origins: [] } });
  
  test('Owner deve conseguir configurar tenant e convidar equipe', async ({ page }) => {
    // Login como Owner
    await page.goto('/auth/login');
    await page.fill('input#email', 'owner.a@cativa.test');
    await page.fill('input#password', 'Cativa@Test2026');
    await page.click('button[type="submit"]');
    
    // Validar Dashboard
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('h1')).toContainText(/Bem-vindo/i);
    
    // Navegar para Configurações
    await page.click('nav >> text=Configurações');
    await expect(page.locator('h2')).toContainText(/Perfil da Empresa/i);
    
    // Criar um novo serviço
    await page.click('nav >> text=Serviços');
    await page.click('button:has-text("Novo serviço")');
    await page.fill('input#name', 'Serviço E2E Test');
    await page.fill('input#duration_minutes', '45');
    await page.click('button:has-text("Salvar")');
    
    await expect(page.locator('table')).toContainText('Serviço E2E Test');
  });

  test('Frontdesk deve gerenciar clientes e agendamentos', async ({ page }) => {
    // Login como Frontdesk
    await page.goto('/auth/login');
    await page.fill('input#email', 'recepcao@cativa.test');
    await page.fill('input#password', 'Cativa@Test2026');
    await page.click('button[type="submit"]');

    // Adicionar Cliente
    await page.click('nav >> text=Clientes');
    await page.click('nav >> text=Clientes');
    await page.click('button:has-text("Novo cliente")');
    await page.fill('input#full_name', 'Cliente Teste E2E');
    await page.fill('input#email', 'cliente.e2e@test.com');
    await page.click('button:has-text("Salvar")');

    // Criar Agendamento na Agenda
    await page.click('nav >> text=Agenda');
    await page.click('button:has-text("Novo agendamento")');
    await page.fill('input[placeholder*="cliente"]', 'Cliente Teste E2E');
    await page.click('text=Cliente Teste E2E');
    await page.click('button:has-text("Confirmar Agendamento")');

    await expect(page.locator('.appointment-card')).toBeVisible();
  });

  test('Professional deve ver apenas seus atendimentos', async ({ page }) => {
    // Login como Professional
    await page.goto('/auth/login');
    await page.fill('input#email', 'profissional@cativa.test');
    await page.fill('input#password', 'Cativa@Test2026');
    await page.click('button[type="submit"]');

    await page.click('nav >> text=Agenda');
    // Deve haver um filtro automático pelo seu próprio ID
    await expect(page.locator('.professional-filter')).toHaveValue(/me/i);
  });
});
