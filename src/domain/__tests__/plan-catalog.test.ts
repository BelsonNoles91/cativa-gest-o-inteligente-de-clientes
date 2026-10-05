import { describe, expect, it } from "vitest";
import { formatLimit, isFeatureOn, PLAN_FEATURE_CATALOG } from "../plan-catalog";

describe("plan feature catalog", () => {
  it("keeps every feature uniquely identified and ready for the UI", () => {
    const keys = PLAN_FEATURE_CATALOG.map(({ key }) => key);

    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    expect(PLAN_FEATURE_CATALOG.every(({ label, description }) => label.trim() && description.trim())).toBe(true);
  });

  it.each([true, "true"])('enables a feature only for the explicit value %j', (value) => {
    expect(isFeatureOn({ analytics: value }, "analytics")).toBe(true);
  });

  it.each([false, "false", "TRUE", 1, 0, null, undefined])(
    "does not enable a feature for a non-boolean true value (%j)",
    (value) => {
      expect(isFeatureOn({ analytics: value }, "analytics")).toBe(false);
    },
  );

  it("fails closed when the feature map or key is absent", () => {
    expect(isFeatureOn(null, "analytics")).toBe(false);
    expect(isFeatureOn(undefined, "analytics")).toBe(false);
    expect(isFeatureOn({}, "analytics")).toBe(false);
    expect(isFeatureOn({ analytics: true }, "unknown_feature")).toBe(false);
  });
});

describe("plan limit formatting", () => {
  it("formats unlimited, singular, plural, and zero limits", () => {
    expect(formatLimit(null, "profissional", "profissionais")).toBe("Profissionais ilimitados");
    expect(formatLimit(undefined, "cliente", "clientes")).toBe("Clientes ilimitados");
    expect(formatLimit(1, "profissional", "profissionais")).toBe("Até 1 profissional");
    expect(formatLimit(2, "cliente", "clientes")).toBe("Até 2 clientes");
    expect(formatLimit(0, "agendamento/mês", "agendamentos/mês")).toBe("Até 0 agendamentos/mês");
  });
});
