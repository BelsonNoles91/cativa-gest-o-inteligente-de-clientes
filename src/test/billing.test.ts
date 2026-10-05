import { afterEach, describe, expect, it, vi } from "vitest";
import {
  effectiveLimits,
  formatPrice,
  hasSubscriptionAccess,
  isBooleanFeatureEnabled,
  isInGracePeriod,
  isUsageBlocked,
  isUsageWarning,
  trialDaysLeft,
  usagePct,
  type Plan,
  type TenantSubscription,
} from "@/domain/billing";

const plan: Plan = {
  id: "plan-a",
  code: "studio",
  name: "Studio",
  description: null,
  billingPeriod: "monthly",
  priceCents: 9900,
  currency: "BRL",
  trialDays: 14,
  gracePeriodDays: 3,
  maxUnits: 2,
  maxProfessionals: 5,
  maxActiveClients: 500,
  maxStorageMb: 1024,
  maxAppointmentsMonth: 1000,
  status: "public",
  isDefault: false,
  features: {},
  displayOrder: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function subscription(overrides: Partial<TenantSubscription> = {}): TenantSubscription {
  return {
    id: "subscription-a",
    tenantId: "tenant-a",
    planId: plan.id,
    status: "trialing",
    trialStartedAt: "2026-01-01T00:00:00.000Z",
    trialEndsAt: "2026-01-15T00:00:00.000Z",
    currentPeriodStart: "2026-01-01T00:00:00.000Z",
    currentPeriodEnd: null,
    canceledAt: null,
    suspendedAt: null,
    overdueSince: null,
    discountCents: 0,
    discountReason: null,
    overrideLimits: {},
    notes: null,
    ...overrides,
  };
}

afterEach(() => vi.useRealTimers());

describe("domain/billing — limites, trial e flags", () => {
  it("aplica override numérico, preserva limite do plano para null/ausente e permite ilimitado", () => {
    expect(effectiveLimits(plan, {
      max_units: 4,
      max_professionals: null,
      max_active_clients: 0,
      max_storage_mb: null,
      max_appointments_month: null,
    })).toEqual({
      maxUnits: 4,
      maxProfessionals: 5,
      maxActiveClients: 0,
      maxStorageMb: 1024,
      maxAppointmentsMonth: 1000,
    });
    expect(effectiveLimits({ ...plan, maxUnits: null }, {})).toMatchObject({ maxUnits: null });
  });

  it("arredonda dias restantes para cima e sinaliza trial expirado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));
    expect(trialDaysLeft(subscription({ trialEndsAt: "2026-01-11T00:00:00.000Z" }))).toBe(1);
    expect(trialDaysLeft(subscription({ trialEndsAt: "2026-01-10T11:59:00.000Z" }))).toBe(-1);
    expect(trialDaysLeft(subscription({ trialEndsAt: null }))).toBeNull();
  });

  it("considera o período de carência estritamente antes do limite", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-03T23:59:59.999Z"));
    const overdue = subscription({ status: "overdue", overdueSince: "2026-01-01T00:00:00.000Z" });
    expect(isInGracePeriod(overdue, plan)).toBe(true);
    vi.setSystemTime(new Date("2026-01-04T00:00:00.000Z"));
    expect(isInGracePeriod(overdue, plan)).toBe(false);
    expect(isInGracePeriod(subscription({ status: "active", overdueSince: overdue.overdueSince }), plan)).toBe(false);
    expect(isInGracePeriod(subscription({ status: "overdue" }), plan)).toBe(false);
  });

  it("libera acesso apenas para assinatura ativa, trial vigente ou carência válida", () => {
    const now = new Date("2026-01-10T12:00:00.000Z").getTime();
    expect(hasSubscriptionAccess(subscription({ status: "active" }), plan, now)).toBe(true);
    expect(
      hasSubscriptionAccess(
        subscription({ status: "trialing", trialEndsAt: "2026-01-11T00:00:00.000Z" }),
        plan,
        now,
      ),
    ).toBe(true);
    expect(
      hasSubscriptionAccess(
        subscription({ status: "trialing", trialEndsAt: "2026-01-10T12:00:00.000Z" }),
        plan,
        now,
      ),
    ).toBe(false);
    expect(hasSubscriptionAccess(subscription({ status: "trialing", trialEndsAt: null }), plan, now)).toBe(false);
    expect(
      hasSubscriptionAccess(
        subscription({ status: "overdue", overdueSince: "2026-01-09T12:00:00.000Z" }),
        plan,
        now,
      ),
    ).toBe(true);
    expect(
      hasSubscriptionAccess(
        subscription({ status: "overdue", overdueSince: "2026-01-06T12:00:00.000Z" }),
        plan,
        now,
      ),
    ).toBe(false);
    expect(hasSubscriptionAccess(subscription({ status: "suspended" }), plan, now)).toBe(false);
    expect(hasSubscriptionAccess(subscription({ status: "canceled" }), plan, now)).toBe(false);
    expect(hasSubscriptionAccess(null, plan, now)).toBe(false);
    expect(hasSubscriptionAccess(subscription(), null, now)).toBe(false);
  });

  it("mantém percentual de uso no intervalo 0..1 mesmo com valores inválidos", () => {
    expect(usagePct(0, 100)).toBe(0);
    expect(usagePct(80, 100)).toBe(0.8);
    expect(usagePct(150, 100)).toBe(1);
    expect(usagePct(-10, 100)).toBe(0);
    expect(usagePct(Number.NaN, 100)).toBe(0);
    expect(usagePct(10, 0)).toBeNull();
    expect(usagePct(10, null)).toBeNull();
    expect(usagePct(10, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("ativa alerta em 80% e bloqueio ao atingir o limite, nunca para limites ausentes", () => {
    expect(isUsageWarning(79, 100)).toBe(false);
    expect(isUsageWarning(80, 100)).toBe(true);
    expect(isUsageBlocked(99, 100)).toBe(false);
    expect(isUsageBlocked(100, 100)).toBe(true);
    expect(isUsageWarning(100, null)).toBe(false);
    expect(isUsageBlocked(100, null)).toBe(false);
  });

  it("converte valores de centavos para BRL com moeda padrão ou explícita", () => {
    expect(formatPrice(12345)).toBe("R$ 123,45");
    expect(formatPrice(12345, "USD")).toBe("US$ 123,45");
  });

  it.each([
    [true, true],
    ["true", true],
    [1, true],
    [2, true],
    [0, false],
    [-1, false],
    ["1", false],
    [false, false],
    [null, false],
  ])("interpreta flag %s como %s", (value, expected) => {
    expect(isBooleanFeatureEnabled(value)).toBe(expected);
  });
});
