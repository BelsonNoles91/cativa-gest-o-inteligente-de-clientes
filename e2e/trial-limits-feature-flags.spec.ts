import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import {
  getDestructiveE2ESkipReason,
  getE2ECredentialsSkipReason,
} from './_helpers/qaTarget';

function createQaAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Os testes de trial e flags exigem credenciais do Supabase QA local.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function withTrialState(page: Page) {
  const tenantSlug = process.env.E2E_TENANT_SLUG;
  if (!tenantSlug) throw new Error('E2E_TENANT_SLUG ausente para o fixture de trial.');

  const admin = createQaAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single();
  if (tenantError) throw tenantError;
  const { data: subscription, error: subscriptionError } = await admin
    .from('tenant_subscriptions')
    .select('id,status,trial_started_at,trial_ends_at,overdue_since,suspended_at,canceled_at')
    .eq('tenant_id', tenant.id)
    .single();
  if (subscriptionError) throw subscriptionError;

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

  const now = Date.now();
  const { error: updateError } = await admin
    .from('tenant_subscriptions')
    .update({
      status: 'trialing',
      trial_started_at: new Date(now - 3 * 86_400_000).toISOString(),
      trial_ends_at: new Date(now + 7 * 86_400_000).toISOString(),
      overdue_since: null,
      suspended_at: null,
      canceled_at: null,
    })
    .eq('id', subscription.id)
    .eq('tenant_id', tenant.id);
  if (updateError) {
    await restore();
    throw updateError;
  }

  try {
    await page.goto('/app/assinatura');
    await expect(page.getByTestId('subscription-trial-countdown')).toContainText('Trial restante');
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Acesso bloqueado' })).toHaveCount(0);
  } finally {
    await restore();
  }
}

test.describe('Trial, limites e feature flags QA', () => {
  test.beforeEach(() => {
    const skipReason =
      getDestructiveE2ESkipReason() ?? getE2ECredentialsSkipReason();
    test.skip(Boolean(skipReason), skipReason);
  });

  test('trial vigente exibe a contagem regressiva e mantém acesso operacional', async ({ page }) => {
    await withTrialState(page);
  });

  test('flag do tenant pode liberar Analytics mesmo quando o plano Apoio a bloqueia', async ({ page }) => {
    const tenantSlug = process.env.E2E_TENANT_SLUG;
    if (!tenantSlug) throw new Error('E2E_TENANT_SLUG ausente para o fixture de feature flag.');

    const admin = createQaAdminClient();
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();
    if (tenantError) throw tenantError;

    const { data: subscription, error: subscriptionError } = await admin
      .from('tenant_subscriptions')
      .select('id,plan_id,override_limits')
      .eq('tenant_id', tenant.id)
      .single();
    if (subscriptionError) throw subscriptionError;

    const { data: freePlan, error: planError } = await admin
      .from('plans')
      .select('id')
      .eq('code', 'free')
      .single();
    if (planError) throw planError;

    const { data: priorFlag, error: flagError } = await admin
      .from('feature_flags')
      .select('id,flag_key,label,description,value_type,value,is_global,tenant_id')
      .eq('tenant_id', tenant.id)
      .eq('flag_key', 'analytics')
      .maybeSingle();
    if (flagError) throw flagError;

    const restore = async () => {
      const subscriptionRestore = await admin
        .from('tenant_subscriptions')
        .update({ plan_id: subscription.plan_id, override_limits: subscription.override_limits })
        .eq('id', subscription.id)
        .eq('tenant_id', tenant.id);
      if (subscriptionRestore.error) throw subscriptionRestore.error;

      if (priorFlag) {
        const flagRestore = await admin
          .from('feature_flags')
          .update({
            label: priorFlag.label,
            description: priorFlag.description,
            value_type: priorFlag.value_type,
            value: priorFlag.value,
            is_global: priorFlag.is_global,
            tenant_id: priorFlag.tenant_id,
          })
          .eq('id', priorFlag.id);
        if (flagRestore.error) throw flagRestore.error;
      } else {
        const flagDelete = await admin
          .from('feature_flags')
          .delete()
          .eq('tenant_id', tenant.id)
          .eq('flag_key', 'analytics');
        if (flagDelete.error) throw flagDelete.error;
      }
    };

    const { error: planUpdateError } = await admin
      .from('tenant_subscriptions')
      .update({ plan_id: freePlan.id })
      .eq('id', subscription.id)
      .eq('tenant_id', tenant.id);
    if (planUpdateError) throw planUpdateError;

    const flagMutation = priorFlag
      ? await admin
          .from('feature_flags')
          .update({ value: true, value_type: 'boolean', is_global: false })
          .eq('id', priorFlag.id)
      : await admin.from('feature_flags').insert({
          tenant_id: tenant.id,
          flag_key: 'analytics',
          label: 'E2E: Analytics habilitado no tenant',
          description: 'Override temporário, sintético e removido pelo teste.',
          value_type: 'boolean',
          value: true,
          is_global: false,
        });

    if (flagMutation.error) {
      await restore();
      throw flagMutation.error;
    }

    try {
      await page.goto('/app/analytics');
      await expect(page).toHaveURL(/\/app\/analytics(?:$|[?#])/);
      await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    } finally {
      await restore();
    }
  });
});
