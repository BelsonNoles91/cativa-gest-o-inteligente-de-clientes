
import { test, expect } from '@playwright/test';

/**
 * Suite de testes E2E para validação de Trial, Limites de Plano e Feature Flags.
 * O objetivo é garantir que o sistema respeite as restrições de cada plano
 * e que as Feature Flags bloqueiem corretamente o acesso a funcionalidades premium.
 */

test.describe('Trial, Limites de Plano e Feature Flags', () => {

  test.beforeEach(async ({ page }) => {
    // Login padrão como Owner para os testes de limites
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'owner@cativa.test');
    await page.fill('input[name="password"]', 'Cativa@Test2026');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/);
  });

  test('Deve exibir banner de Trial e data de expiração', async ({ page }) => {
    // Verificar se existe algum indicador de Trial no Dashboard ou Header
    const trialBadge = page.locator('text=/Trial/i');
    const trialCountdown = page.locator('text=/dias restantes/i');
    
    // Um dos dois deve estar visível para novos tenants
    await expect(trialBadge.or(trialCountdown).first()).toBeVisible();
  });

  test('Bloqueio de funcionalidade premium via Feature Gate', async ({ page }) => {
    // O Confirmation Center (Central de Confirmações) é uma feature premium
    await page.goto('/app/confirmacoes');

    // Se o plano não permitir (Starter por exemplo), o FeatureGate deve redirecionar
    // ou mostrar um Notice de bloqueio. 
    // Com base no código do FeatureGate.tsx, ele redireciona para /app/meu-plano
    await expect(page).toHaveURL(/\/app\/meu-plano/);
    await expect(page.locator('h1, h2')).toContainText(/Assinatura|Plano/i);
  });

  test('Respeito aos limites quantitativos (Ex: Limite de Profissionais)', async ({ page }) => {
    // Navegar para a tela de Profissionais/Equipe
    await page.goto('/app/configuracoes'); // Supondo que equipe fica em configurações ou rota própria
    
    // Tentar adicionar um profissional além do limite do plano Starter (limite: 3)
    // Este teste assume que já existem 3 profissionais cadastrados no tenant de teste
    await page.click('button:has-text("Adicionar Profissional")');
    
    // Deve mostrar um aviso de upgrade ou erro de limite excedido
    await expect(page.locator('text=/limite/i')).toBeVisible();
    await expect(page.locator('button:has-text("Upgrade")')).toBeVisible();
  });

  test('Feature Flag específica de Tenant deve sobrescrever Plano', async ({ page }) => {
    // Cenário: Tenant no Starter (sem Analytics), mas com Feature Flag manual "analytics_enabled = true"
    // Validar que o acesso é liberado
    await page.goto('/app/analytics');
    
    // Se a flag estiver ativa, a URL deve permanecer e o conteúdo carregar
    await expect(page).toHaveURL(/\/app\/analytics/);
    await expect(page.locator('canvas, .recharts-surface')).toBeVisible(); // Se houver gráficos
  });
});
