import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import {
  getDestructiveE2ESkipReason,
  getE2ECredentialsSkipReason,
} from './_helpers/qaTarget';

type SubscriptionPatch = {
  status: 'trialing' | 'active' | 'overdue' | 'suspended' | 'canceled';
  trial_started_at: string | null;
  trial_ends_at: string | null;
  overdue_since: string | null;
  suspended_at: string | null;
  canceled_at: string | null;
};

type SubscriptionSnapshot = SubscriptionPatch & {
  id: string;
  tenant_id: string;
  plan_id: string;
};

async function navigateWithClientRedirects(page: Page, path: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'commit' });
      return;
    } catch (error) {
      const interruptedNavigation =
        error instanceof Error && error.message.includes('interrupted by another navigation');
      if (!interruptedNavigation || attempt === 1) throw error;
      // A prior guard may still be completing its client-side redirect.
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 5_000 }).catch(() => {});
    }
  }
}

function createQaAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('A validação de assinatura exige credenciais do Supabase QA local.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function withQaSubscriptionState(
  page: Page,
  patch: Partial<SubscriptionPatch>,
  verify: (gracePeriodDays: number) => Promise<void>,
) {
  const tenantSlug = process.env.E2E_TENANT_SLUG;
  if (!tenantSlug) throw new Error('E2E_TENANT_SLUG ausente para o fixture de assinatura.');

  const admin = createQaAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single();
  if (tenantError) throw tenantError;

  const { data: subscriptionData, error: subscriptionError } = await admin
    .from('tenant_subscriptions')
    .select('id,tenant_id,plan_id,status,trial_started_at,trial_ends_at,overdue_since,suspended_at,canceled_at')
    .eq('tenant_id', tenant.id)
    .single();
  if (subscriptionError) throw subscriptionError;
  const subscription = subscriptionData as SubscriptionSnapshot;

  const { data: plan, error: planError } = await admin
    .from('plans')
    .select('grace_period_days')
    .eq('id', subscription.plan_id)
    .single();
  if (planError) throw planError;

  const restore = async () => {
    const { error } = await admin
      .from('tenant_subscriptions')
      .update({
        status: subscription.status,
        trial_started_at: subscription.trial_started_at,
        trial_ends_at: subscription.trial_ends_at,
        overdue_since: subscription.overdue_since,
        suspended_at: subscription.suspended_at,
        canceled_at: subscription.canceled_at,
      })
      .eq('id', subscription.id)
      .eq('tenant_id', tenant.id);
    if (error) throw new Error(`Não foi possível restaurar a assinatura QA: ${error.message}`);
  };

  const { error: updateError } = await admin
    .from('tenant_subscriptions')
    .update(patch)
    .eq('id', subscription.id)
    .eq('tenant_id', tenant.id);
  if (updateError) throw updateError;

  try {
    await verify(plan.grace_period_days);
  } finally {
    await restore();
  }
}

async function expectOperationalBlock(page: Page) {
  await navigateWithClientRedirects(page, '/app');
  await expect(page.getByRole('heading', { name: 'Acesso bloqueado' })).toBeVisible();

  await navigateWithClientRedirects(page, '/app/agenda');
  await expect(page.getByRole('heading', { name: 'Acesso bloqueado' })).toBeVisible();

  // A área de regularização permanece acessível para owner/manager.
  await navigateWithClientRedirects(page, '/app/assinatura');
  await expect(page).toHaveURL(/\/app\/assinatura(?:$|[?#])/);
  await expect(page.getByTestId('subscription-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assinatura' })).toBeVisible();
}

test.describe('Bloqueio e carência da assinatura', () => {
  test.beforeEach(() => {
    const skipReason =
      getDestructiveE2ESkipReason() ?? getE2ECredentialsSkipReason();
    test.skip(Boolean(skipReason), skipReason);
  });

  for (const status of ['suspended', 'canceled'] as const) {
    test(`${status}: bloqueia operação e preserva a área de regularização`, async ({ page }) => {
      const now = new Date().toISOString();
      await withQaSubscriptionState(
        page,
        {
          status,
          suspended_at: status === 'suspended' ? now : null,
          canceled_at: status === 'canceled' ? now : null,
          trial_started_at: null,
          trial_ends_at: null,
          overdue_since: null,
        },
        async () => expectOperationalBlock(page),
      );
    });
  }

  test('trial expirado: bloqueia agenda, mas mantém o resumo da assinatura acessível', async ({ page }) => {
    const now = Date.now();
    await withQaSubscriptionState(
      page,
      {
        status: 'trialing',
        trial_started_at: new Date(now - 14 * 86_400_000).toISOString(),
        trial_ends_at: new Date(now - 60_000).toISOString(),
        overdue_since: null,
        suspended_at: null,
        canceled_at: null,
      },
      async () => {
        await expectOperationalBlock(page);
        await expect(page.getByTestId('subscription-trial-countdown')).toContainText('Trial expirado');
      },
    );
  });

  test('trial vigente e inadimplência dentro da carência continuam operacionais', async ({ page }) => {
    const now = Date.now();
    await withQaSubscriptionState(
      page,
      {
        status: 'trialing',
        trial_started_at: new Date(now - 3 * 86_400_000).toISOString(),
        trial_ends_at: new Date(now + 7 * 86_400_000).toISOString(),
        overdue_since: null,
        suspended_at: null,
        canceled_at: null,
      },
      async () => {
        await navigateWithClientRedirects(page, '/app/assinatura');
        await expect(page).toHaveURL(/\/app\/assinatura(?:$|[?#])/);
        await expect(page.getByTestId('subscription-trial-countdown')).toContainText('Trial restante');
        await navigateWithClientRedirects(page, '/app/agenda');
        await expect(page).toHaveURL(/\/app\/agenda(?:$|[?#])/);
        await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Acesso bloqueado' })).toHaveCount(0);
      },
    );

    await withQaSubscriptionState(
      page,
      {
        status: 'overdue',
        trial_started_at: null,
        trial_ends_at: null,
        overdue_since: new Date(now - 86_400_000).toISOString(),
        suspended_at: null,
        canceled_at: null,
      },
      async (gracePeriodDays) => {
        test.skip(gracePeriodDays < 1, 'O plano de QA não configura período de carência.');
        await navigateWithClientRedirects(page, '/app/assinatura');
        await expect(page).toHaveURL(/\/app\/assinatura(?:$|[?#])/);
        await expect(page.getByTestId('subscription-grace-warning')).toBeVisible();
        await navigateWithClientRedirects(page, '/app/agenda');
        await expect(page).toHaveURL(/\/app\/agenda(?:$|[?#])/);
        await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Acesso bloqueado' })).toHaveCount(0);
      },
    );
  });

  test('inadimplência após o fim da carência bloqueia as rotas operacionais', async ({ page }) => {
    const overdueSince = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await withQaSubscriptionState(
      page,
      {
        status: 'overdue',
        trial_started_at: null,
        trial_ends_at: null,
        overdue_since: overdueSince,
        suspended_at: null,
        canceled_at: null,
      },
      async (gracePeriodDays) => {
        test.skip(gracePeriodDays >= 30, 'O plano de QA tem carência de 30 dias ou mais.');
        await expectOperationalBlock(page);
      },
    );
  });
});
