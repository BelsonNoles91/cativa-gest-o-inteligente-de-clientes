import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import {
  getDestructiveE2ESkipReason,
  getE2ECredentialsSkipReason,
} from './_helpers/qaTarget';

type PlanCode = 'free' | 'pro' | 'studio';
type FeatureScenario = {
  plan: PlanCode;
  label: string;
  features: {
    confirmation_center: boolean;
    analytics: boolean;
    packages_memberships: boolean;
  };
};

const scenarios: FeatureScenario[] = [
  {
    plan: 'free',
    label: 'Apoio',
    features: {
      confirmation_center: false,
      analytics: false,
      packages_memberships: true,
    },
  },
  {
    plan: 'pro',
    label: 'Empreendedor',
    features: {
      confirmation_center: false,
      analytics: false,
      packages_memberships: false,
    },
  },
  {
    plan: 'studio',
    label: 'Studio',
    features: {
      confirmation_center: true,
      analytics: true,
      packages_memberships: true,
    },
  },
];

let activeRestore: (() => Promise<void>) | null = null;

function createQaAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('A matriz de planos exige credenciais do Supabase QA local.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function applyPlanForCurrentFixture(planCode: PlanCode) {
  const tenantSlug = process.env.E2E_TENANT_SLUG;
  if (!tenantSlug) throw new Error('E2E_TENANT_SLUG ausente para o fixture de planos.');

  const admin = createQaAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single();
  if (tenantError) throw tenantError;

  const { data: subscription, error: subscriptionError } = await admin
    .from('tenant_subscriptions')
    .select('id, plan_id, override_limits')
    .eq('tenant_id', tenant.id)
    .single();
  if (subscriptionError) throw subscriptionError;

  const { data: plan, error: planError } = await admin
    .from('plans')
    .select('id')
    .eq('code', planCode)
    .single();
  if (planError) throw planError;

  let restored = false;
  const restore = async () => {
    if (restored) return;
    restored = true;
    const { error } = await admin
      .from('tenant_subscriptions')
      .update({
        plan_id: subscription.plan_id,
        override_limits: subscription.override_limits,
      })
      .eq('id', subscription.id)
      .eq('tenant_id', tenant.id);
    if (error) throw new Error(`Não foi possível restaurar o plano QA original: ${error.message}`);
  };
  activeRestore = restore;

  const { error: updateError } = await admin
    .from('tenant_subscriptions')
    .update({ plan_id: plan.id })
    .eq('id', subscription.id)
    .eq('tenant_id', tenant.id);
  if (updateError) {
    await restore();
    activeRestore = null;
    throw updateError;
  }

  return restore;
}

async function expectFeatureRoute(
  page: Page,
  path: string,
  enabled: boolean,
  heading: string,
) {
  // A guarda de feature faz uma navegação client-side para /app/meu-plano.
  // Esperar "load" no documento original deixa o Playwright tratar esse
  // redirecionamento esperado como uma navegação interrompida.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(`/app/${path}`, { waitUntil: 'commit' });
      break;
    } catch (error) {
      const interruptedTo = error instanceof Error
        ? error.message.match(/interrupted by another navigation to "([^"]+)"/)?.[1]
        : undefined;
      if (!interruptedTo) throw error;

      const interruptedPath = new URL(interruptedTo, page.url()).pathname;
      if (!enabled && interruptedPath === '/app/meu-plano') {
        await expect(page).toHaveURL(/\/app\/meu-plano(?:$|[?#])/);
        return;
      }
      if (attempt === 1) throw error;

      // An in-flight navigation from the preceding guard must settle before
      // retrying the requested deep link; the final URL assertion stays strict.
      await page.waitForURL((url) => url.pathname === interruptedPath, { timeout: 5_000 });
      await page.waitForTimeout(100);
    }
  }

  if (!enabled) {
    await expect(page).toHaveURL(/\/app\/meu-plano(?:$|[?#])/);
    await expect(page.getByRole('heading', { name: 'Meu plano', exact: true })).toBeVisible();
    return;
  }

  await expect(page).toHaveURL(new RegExp(`/app/${path}(?:$|[?#])`));
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

test.describe('Entitlements por plano ativo', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    const skipReason =
      getDestructiveE2ESkipReason() ?? getE2ECredentialsSkipReason();
    test.skip(Boolean(skipReason), skipReason);
  });

  test.afterEach(async () => {
    if (!activeRestore) return;
    const restore = activeRestore;
    activeRestore = null;
    await restore();
  });

  for (const scenario of scenarios) {
    test(`${scenario.label}: rotas seguem os entitlements do catálogo`, async ({ page }) => {
      const restore = await applyPlanForCurrentFixture(scenario.plan);
      try {
        // A agenda é base operacional disponível em todos os planos.
        await page.goto('/app/agenda');
        await expect(page).toHaveURL(/\/app\/agenda(?:$|[?#])/);

        await expectFeatureRoute(
          page,
          'confirmacoes',
          scenario.features.confirmation_center,
          'Central de Confirmação',
        );
        await expectFeatureRoute(
          page,
          'analytics',
          scenario.features.analytics,
          'Analytics',
        );
        await expectFeatureRoute(
          page,
          'pacotes',
          scenario.features.packages_memberships,
          'Pacotes, Memberships e Protocolos',
        );
      } finally {
        await restore();
        activeRestore = null;
      }
    });
  }
});
