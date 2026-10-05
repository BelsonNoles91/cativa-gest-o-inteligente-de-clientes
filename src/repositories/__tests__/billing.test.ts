import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  getSubscriptionByTenant,
  listPlanFeatures,
  listPlans,
  manageTenantSubscription,
} from "../billing";

type Result = { data: unknown; error: unknown | null };

function makeQuery(result: Result) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "eq", "in"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(async () => result);
  query.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query as Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
  };
}

const planRow = {
  id: "plan-pro",
  code: "pro",
  name: "Profissional",
  description: null,
  billing_period: "monthly",
  price_cents: 12900,
  currency: null,
  trial_days: 14,
  grace_period_days: 7,
  max_units: null,
  max_professionals: 10,
  max_active_clients: 500,
  max_storage_mb: 1024,
  max_appointments_month: 5000,
  status: "public",
  is_default: true,
  features: null,
  display_order: 2,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-02T00:00:00.000Z",
};

describe("billing repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mapeia planos e aplica defaults sem perder limites ou preço", async () => {
    const query = makeQuery({ data: [planRow], error: null });
    supabaseMock.from.mockReturnValue(query);

    await expect(listPlans()).resolves.toEqual([
      expect.objectContaining({
        id: "plan-pro",
        code: "pro",
        billingPeriod: "monthly",
        priceCents: 12900,
        currency: "BRL",
        maxUnits: null,
        maxProfessionals: 10,
        maxActiveClients: 500,
        status: "public",
        isDefault: true,
        features: {},
        displayOrder: 2,
      }),
    ]);
    expect(supabaseMock.from).toHaveBeenCalledWith("plans");
    expect(query.select).toHaveBeenCalledWith("*");
    expect(query.order).toHaveBeenCalledWith("display_order");
  });

  it("propaga falha de leitura de planos em vez de apresentar catálogo vazio", async () => {
    const databaseError = { code: "503", message: "backend indisponível" };
    supabaseMock.from.mockReturnValue(makeQuery({ data: null, error: databaseError }));

    await expect(listPlans()).rejects.toBe(databaseError);
  });

  it("não consulta o banco quando não há IDs de planos para hidratar", async () => {
    await expect(listPlanFeatures([])).resolves.toEqual([]);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("escopa assinatura pelo tenant e normaliza opcionais sem confundir tenant ausente", async () => {
    const query = makeQuery({
      data: {
        id: "subscription-a",
        tenant_id: "tenant-a",
        plan_id: "plan-pro",
        status: "active",
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: "2026-10-01T00:00:00.000Z",
        current_period_end: null,
        canceled_at: null,
        suspended_at: null,
        overdue_since: null,
        discount_cents: null,
        discount_reason: null,
        override_limits: null,
        notes: null,
      },
      error: null,
    });
    supabaseMock.from.mockReturnValue(query);

    await expect(getSubscriptionByTenant("tenant-a")).resolves.toMatchObject({
      id: "subscription-a",
      tenantId: "tenant-a",
      planId: "plan-pro",
      discountCents: 0,
      overrideLimits: {},
      currentPeriodEnd: null,
    });
    expect(supabaseMock.from).toHaveBeenCalledWith("tenant_subscriptions");
    expect(query.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("altera assinatura somente pela RPC atômica e mapeia o retorno", async () => {
    const subscriptionRow = {
      id: "subscription-a",
      tenant_id: "tenant-a",
      plan_id: "plan-pro",
      status: "active",
      trial_started_at: null,
      trial_ends_at: null,
      current_period_start: "2026-10-01T00:00:00.000Z",
      current_period_end: null,
      canceled_at: null,
      suspended_at: null,
      overdue_since: null,
      discount_cents: 2500,
      discount_reason: "campanha QA",
      override_limits: { max_units: 2 },
      notes: "observação",
    };
    supabaseMock.rpc.mockResolvedValue({ data: subscriptionRow, error: null });

    await expect(manageTenantSubscription({
      tenantId: "tenant-a",
      planId: "plan-pro",
      status: "active",
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStart: "2026-10-01T00:00:00.000Z",
      currentPeriodEnd: null,
      discountCents: 2500,
      discountReason: "campanha QA",
      overrideLimits: { max_units: 2 },
      notes: "observação",
      reason: "ajuste autorizado",
    })).resolves.toMatchObject({
      id: "subscription-a",
      tenantId: "tenant-a",
      status: "active",
      discountCents: 2500,
      overrideLimits: { max_units: 2 },
    });

    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).toHaveBeenCalledWith("admin_manage_tenant_subscription", {
      _tenant_id: "tenant-a",
      _plan_id: "plan-pro",
      _status: "active",
      _trial_started_at: null,
      _trial_ends_at: null,
      _current_period_start: "2026-10-01T00:00:00.000Z",
      _current_period_end: null,
      _discount_cents: 2500,
      _discount_reason: "campanha QA",
      _override_limits: { max_units: 2 },
      _notes: "observação",
      _reason: "ajuste autorizado",
    });
  });

  it("propaga falha da RPC sem tentar gravar parcialmente via REST", async () => {
    const databaseError = { code: "42501", message: "Apenas super_admin pode gerenciar assinaturas." };
    supabaseMock.rpc.mockResolvedValue({ data: null, error: databaseError });

    await expect(manageTenantSubscription({
      tenantId: "tenant-a",
      planId: "plan-pro",
      status: "active",
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStart: "2026-10-01T00:00:00.000Z",
      currentPeriodEnd: null,
      discountCents: 0,
      discountReason: null,
      overrideLimits: {},
      notes: null,
      reason: "ajuste autorizado",
    })).rejects.toBe(databaseError);

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("trata resposta vazia de sucesso como falha de contrato", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

    await expect(manageTenantSubscription({
      tenantId: "tenant-a",
      planId: "plan-pro",
      status: "active",
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStart: "2026-10-01T00:00:00.000Z",
      currentPeriodEnd: null,
      discountCents: 0,
      discountReason: null,
      overrideLimits: {},
      notes: null,
      reason: "ajuste autorizado",
    })).rejects.toThrow("A assinatura não foi retornada após a alteração.");
  });
});
