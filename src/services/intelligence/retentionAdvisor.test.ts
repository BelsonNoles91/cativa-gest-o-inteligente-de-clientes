import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import { evaluateRetentionWithJev } from "./retentionAdvisor";
import type { RetentionAdvice } from "@/domain/retentionIntelligence";

const ids = {
  tenantId: "22222222-2222-4222-8222-222222222222",
  clientId: "11111111-1111-4111-8111-111111111111",
};

const advice: RetentionAdvice = {
  status: "suggested",
  action: "offer_rebooking",
  actionLabel: "Oferecer novo agendamento",
  description: "O ciclo de retorno está vencido.",
  urgencyLevel: "moderate",
  confidence: 0.82,
  evidenceSufficiency: 0.91,
  model: "jev-1.13.0",
  evaluatedAt: "2026-10-04T12:00:00.000Z",
  automaticAction: false,
};

describe("evaluateRetentionWithJev", () => {
  beforeEach(() => invokeMock.mockReset());

  it("invokes the Edge Function with the minimal tenant/client identifiers and validates its answer", async () => {
    invokeMock.mockResolvedValue({ data: advice, error: null });

    await expect(evaluateRetentionWithJev(ids)).resolves.toEqual(advice);
    expect(invokeMock).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith("retention-advisor", { body: ids });
  });

  it("does not forward unrelated PII attached by a structural caller", async () => {
    invokeMock.mockResolvedValue({ data: advice, error: null });
    const expandedInput = {
      ...ids,
      email: "cliente@example.test",
      phone: "+5511999999999",
      notes: "Informação privada que não é necessária para esta chamada.",
    };

    await evaluateRetentionWithJev(expandedInput);

    expect(invokeMock).toHaveBeenCalledWith("retention-advisor", { body: ids });
    expect(JSON.stringify(invokeMock.mock.calls)).not.toContain("cliente@example.test");
    expect(JSON.stringify(invokeMock.mock.calls)).not.toContain("5511999999999");
    expect(JSON.stringify(invokeMock.mock.calls)).not.toContain("Informação privada");
  });

  it("propagates the Edge Function error message", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "Sessão expirada" } });

    await expect(evaluateRetentionWithJev(ids)).rejects.toThrow("Sessão expirada");
  });

  it("uses a safe fallback when the Edge Function error has no message", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "" } });

    await expect(evaluateRetentionWithJev(ids)).rejects.toThrow("Não foi possível consultar o Jev.");
  });

  it("rejects a malformed or out-of-range Edge Function response", async () => {
    invokeMock.mockResolvedValue({ data: { ...advice, confidence: 1.01 }, error: null });

    await expect(evaluateRetentionWithJev(ids)).rejects.toThrow();
  });
});
