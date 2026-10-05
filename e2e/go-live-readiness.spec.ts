import { test, expect } from '@playwright/test';
import {
  getDestructiveE2ESkipReason,
  getE2ECredentialsSkipReason,
} from './_helpers/qaTarget';

/**
 * Suite de testes E2E para validação de fluxos críticos de negócio
 * antes da liberação para produção (Go-Live).
 */

test.describe('Checklist de Liberação (Go-Live Readiness)', () => {
  test.beforeEach(async () => {
    const skipReason =
      getDestructiveE2ESkipReason() ?? getE2ECredentialsSkipReason();
    test.skip(Boolean(skipReason), skipReason);
    // Uses globalSetup's authenticated synthetic QA storageState.
  });

  test('Configuração Completa do Perfil do Negócio', async ({ page }) => {
    await page.goto('/app/configuracoes');
    const businessName = page.getByLabel('Nome do estabelecimento');
    await expect(businessName).toBeVisible();
    const originalName = await businessName.inputValue();
    try {
      await businessName.fill(`${originalName} QA`);
      await page.getByRole('button', { name: 'Salvar alterações' }).click();
      await expect(page.getByText('Dados atualizados', { exact: true }).last()).toBeVisible();
      await expect(businessName).toHaveValue(`${originalName} QA`);
    } finally {
      await businessName.fill(originalName);
      await page.getByRole('button', { name: 'Salvar alterações' }).click();
      await expect(page.getByText('Dados atualizados', { exact: true }).last()).toBeVisible();
    }
  });

  test('Gestão de unidades respeita o limite do plano ativo', async ({ page }) => {
    await page.goto('/app/configuracoes');
    await page.getByTestId('settings-tab-units').click();
    const panel = page.getByTestId('settings-units-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('units-create-trigger')).toBeDisabled();
    await expect(panel.getByTestId('units-limit-warning')).toContainText(
      /permite apenas uma unidade|limite de unidades atingido/i,
    );
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

  test('Portabilidade de Dados: Exportação em Massa', async ({ page }) => {
    await page.goto('/app/dados');
    await page.getByTestId('import-export-tab-export').click();
    const exportBtn = page.getByTestId('export-clients-csv');
    await expect(exportBtn).toBeEnabled();
  });

});
