import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getDestructiveE2ESkipReason } from './_helpers/qaTarget';

/**
 * Teste E2E do fluxo de Onboarding Otimizado (Beta).
 * Valida a criação atômica do tenant, o início do trial e o catálogo inicial.
 */

test.describe('Onboarding Guiado (Owner Experience)', () => {
  // O setup global autentica o owner das demais jornadas; onboarding precisa
  // começar realmente deslogado para exercitar cadastro e criação do tenant.
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(15_000);
  });

  let createdAuthUserId: string | undefined;

  test.afterEach(async () => {
    if (!createdAuthUserId) return;

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey || getDestructiveE2ESkipReason()) {
      throw new Error('Limpeza do onboarding bloqueada: credenciais admin/alvo QA não estão validados.');
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: ownedTenants, error: tenantLookupError } = await admin
      .from('tenants')
      .select('id')
      .eq('created_by', createdAuthUserId);
    if (tenantLookupError) throw new Error(`Não foi possível localizar o tenant sintético para limpeza: ${tenantLookupError.message}`);

    for (const tenant of ownedTenants ?? []) {
      const { error } = await admin
        .from('tenants')
        .delete()
        .eq('id', tenant.id)
        .eq('created_by', createdAuthUserId);
      if (error) throw new Error(`Não foi possível remover o tenant sintético do teste: ${error.message}`);
    }

    const { error: userDeleteError } = await admin.auth.admin.deleteUser(createdAuthUserId);
    if (userDeleteError) throw new Error(`Não foi possível remover a conta sintética do teste: ${userDeleteError.message}`);
    createdAuthUserId = undefined;
  });

  test('Deve completar o onboarding e criar recursos iniciais', async ({ page }, testInfo) => {
    const signupPassword = process.env.E2E_ONBOARDING_PASS;
    const testId = `test-${Date.now()}-${testInfo.project.name}-${randomUUID().slice(0, 8)}`;
    const testEmail = `${testId}@onboarding.test`;
    const bizName = `Studio ${testId}`;
    const skipReason = getDestructiveE2ESkipReason() ??
      (!signupPassword?.trim()
        ? 'E2E_ONBOARDING_PASS ausente; não será criada conta usando senha fictícia.'
        : !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim()
          ? 'Credenciais locais de limpeza ausentes; o onboarding destrutivo não deixaria fixtures residuais.'
        : undefined);
    test.skip(Boolean(skipReason), skipReason);

    // 1. Signup / Step 0
    await page.goto('/onboarding');
    await page.fill('input#name', 'Test Owner');
    await page.fill('input#se', testEmail);
    await page.fill('input#sp', signupPassword!);
    const formIsValid = await page.locator('form').evaluate((form) => (form as HTMLFormElement).checkValidity());
    expect(formIsValid, 'os campos obrigatórios do cadastro devem estar válidos antes do envio').toBe(true);
    // No projeto iPhone/WebKit, fechar o teclado virtual consome o primeiro
    // toque em alguns estados. Tab desfoca a senha e deixa o CTA pronto.
    const submitSignup = page.getByRole('button', { name: /Continuar para Configuração/ });
    await page.locator('input#sp').press('Tab');
    await expect(submitSignup).toBeFocused();
    const signupResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname.endsWith('/auth/v1/signup'),
      { timeout: 15_000 },
    ).catch(() => null);
    await submitSignup.click();
    const authResponse = await signupResponse;
    expect(authResponse?.status(), 'o formulário deve enviar o cadastro ao Supabase Auth').toBe(200);
    const authPayload = await authResponse!.json() as { user?: { id?: string } };
    createdAuthUserId = authPayload.user?.id;
    expect(createdAuthUserId, 'o Supabase deve retornar a conta recém-criada para limpeza controlada').toBeTruthy();

    // Quando o cadastro retorna uma sessão imediatamente, a própria jornada
    // avança para a configuração do negócio. A tela “Vamos começar” é apenas
    // para quem abre /onboarding já autenticado, não um passo após o signup.
    // 2. Negócio / Step 1
    await expect(page.locator('h1')).toContainText('Sobre seu negócio');
    await page.fill('input#bn', bizName);
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Salão de beleza' }).click();
    await page.getByRole('button', { name: /Continuar para Identidade Visual/ }).click();

    // 3. Equipe & Serviços / Step 2
    await expect(page.locator('h1')).toContainText('Equipe & Serviços');
    
    // Adicionar Profissional
    await page.fill('input#pro-input', 'Professional E2E');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Professional E2E', { exact: true })).toBeVisible();

    // Adicionar Serviço
    await page.fill('input#svc-name', 'Serviço E2E');
    await page.fill('input#svc-price', '150');
    const addService = page.getByRole('button', { name: 'Adicionar', exact: true });
    // Desfocar o campo numérico antes do toque: no Safari/WebKit mobile o
    // teclado virtual pode consumir o primeiro tap no CTA ao ser fechado.
    await page.locator('input#svc-price').press('Tab');
    await expect(addService).toBeFocused();
    await addService.click();
    await expect(page.getByText('Serviço E2E · R$ 150', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    // 4. Branding / Step 3
    await expect(page.locator('h1')).toContainText('Cores & Marca');
    await page.fill('input#wp', '11999999999');
    // On touch WebKit, blur the text field first so the virtual keyboard does
    // not consume the button tap while closing; also exercise keyboard focus.
    await page.locator('input#wp').press('Tab');
    await page.keyboard.press('Tab');
    const continueToReview = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(continueToReview).toBeFocused();
    await continueToReview.click();

    // 5. Confirmação / Step 4
    await expect(page.locator('h1')).toContainText('Tudo pronto!');
    await expect(page.getByText(bizName, { exact: true })).toBeVisible();
    await expect(page.getByText('1 profissional(is)', { exact: true })).toBeVisible();
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(viewportWidth, 'o fluxo precisa ser executado em viewport declarada').toBeGreaterThan(0);
    const summaryRows = page.getByTestId('onboarding-summary-item');
    const summaryGeometry = await summaryRows.evaluateAll((rows) => rows.map((row) => {
      const [label, value] = Array.from(row.querySelectorAll('span'), (span) => span.getBoundingClientRect());
      const bounds = row.getBoundingClientRect();
      return {
        labelLeft: label?.left ?? Number.NEGATIVE_INFINITY,
        labelRight: label?.right ?? Number.POSITIVE_INFINITY,
        labelTop: label?.top ?? Number.NEGATIVE_INFINITY,
        labelBottom: label?.bottom ?? Number.POSITIVE_INFINITY,
        valueLeft: value?.left ?? Number.NEGATIVE_INFINITY,
        valueRight: value?.right ?? Number.POSITIVE_INFINITY,
        valueTop: value?.top ?? Number.NEGATIVE_INFINITY,
        valueBottom: value?.bottom ?? Number.POSITIVE_INFINITY,
        rowLeft: bounds.left,
        rowRight: bounds.right,
      };
    }));
    expect(summaryGeometry, `todos os campos da revisão devem estar presentes em ${viewportWidth}px`).toHaveLength(5);
    for (const row of summaryGeometry) {
      const overlaps = row.labelLeft < row.valueRight && row.labelRight > row.valueLeft &&
        row.labelTop < row.valueBottom && row.labelBottom > row.valueTop;
      expect(overlaps, `rótulo e valor não devem se sobrepor em ${viewportWidth}px`).toBe(false);
      expect(row.valueLeft, `valor deve ficar dentro do cartão em ${viewportWidth}px`).toBeGreaterThanOrEqual(row.rowLeft - 1);
      expect(row.valueRight, `valor deve ficar dentro do cartão em ${viewportWidth}px`).toBeLessThanOrEqual(row.rowRight + 1);
    }

    // Finalizar
    const finalizeOnboarding = page.getByRole('button', { name: /Finalizar e Acessar o Cativa/ });
    await finalizeOnboarding.scrollIntoViewIfNeeded();
    await expect(finalizeOnboarding).toBeVisible();
    const finalizeGeometry = await finalizeOnboarding.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        viewportWidth: window.innerWidth,
        clientWidth: button.clientWidth,
        scrollWidth: button.scrollWidth,
        contentBounds: Array.from(button.children, (child) => {
          const childBounds = child.getBoundingClientRect();
          return { left: childBounds.left, right: childBounds.right };
        }),
      };
    });
    expect(finalizeGeometry.left, 'CTA deve iniciar dentro da viewport').toBeGreaterThanOrEqual(-1);
    expect(finalizeGeometry.right, 'CTA deve terminar dentro da viewport').toBeLessThanOrEqual(finalizeGeometry.viewportWidth + 1);
    expect(finalizeGeometry.scrollWidth, 'texto do CTA não deve transbordar o botão').toBeLessThanOrEqual(finalizeGeometry.clientWidth + 1);
    for (const child of finalizeGeometry.contentBounds) {
      expect(child.left, 'conteúdo do CTA deve permanecer dentro do botão').toBeGreaterThanOrEqual(finalizeGeometry.left - 1);
      expect(child.right, 'conteúdo do CTA deve permanecer dentro do botão').toBeLessThanOrEqual(finalizeGeometry.right + 1);
    }
    const tenantCreationRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname.endsWith('/rest/v1/rpc/create_tenant_with_owner'),
      { timeout: 15_000 },
    ).catch(() => null);
    await finalizeOnboarding.click();
    const createRequest = await tenantCreationRequest;
    expect(createRequest, 'a confirmação deve chamar a RPC transacional de criação do tenant').not.toBeNull();
    const createResponse = await createRequest!.response();
    expect(createResponse, 'a RPC transacional deve receber uma resposta HTTP').not.toBeNull();
    expect(createResponse!.status(), 'a RPC de criação do tenant deve concluir com sucesso').toBe(200);

    // 6. Validação no Dashboard
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByRole('heading', { name: 'Olá! Bem-vindo de volta' })).toBeVisible();

    // O onboarding não deve inventar um cliente/agendamento fictício: valida os
    // registros iniciais no catálogo e na agenda, que são os dados realmente
    // informados pela pessoa durante a configuração.
    await page.goto('/app/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Filtrar por profissional' }).click();
    await expect(page.getByRole('option', { name: 'Professional E2E', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto('/app/servicos');
    await expect(page.getByRole('heading', { name: 'Serviço E2E', exact: true })).toBeVisible();
  });
});
