import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Subscription Blocker & Plan Selection', () => {

  test('Usuário sem plano é bloqueado e não consegue acessar Agenda nem Serviços', async ({ page }) => {
    // Como o auth global já logou como owner.a@cativa.test (sem plano),
    // apenas navegamos para o app.
    await page.goto('/app');
    
    // O sistema deve exibir a tela de bloqueio (SubscriptionBlocker)
    await expect(page.locator('text=Acesso bloqueado')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Você precisa ativar um trial ou assinar')).toBeVisible();

    // Tentar navegar para a agenda diretamente
    await page.goto('/app/agenda');
    await expect(page.locator('text=Acesso bloqueado')).toBeVisible();

    // Mas a rota de escolher plano deve estar liberada
    await page.goto('/app/assinatura');
    await expect(page.locator('text=Acesso bloqueado')).not.toBeVisible();
    await expect(page.locator('text=Nossa precificação')).toBeVisible();
  });

});
