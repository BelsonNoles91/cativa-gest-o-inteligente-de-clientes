import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RetentionIntelligenceCard } from "./RetentionIntelligenceCard";
import type { Client } from "@/domain/client";

const evaluateRetentionWithJev = vi.fn();
vi.mock("@/services/intelligence/retentionAdvisor", () => ({
  evaluateRetentionWithJev: (...args: unknown[]) => evaluateRetentionWithJev(...args),
}));

const client: Client = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  preferredUnitId: null,
  preferredProfessionalId: null,
  referredByClientId: null,
  fullName: "Cliente Teste",
  email: null,
  phone: null,
  whatsappPhone: null,
  birthDate: null,
  origin: null,
  notes: null,
  allergies: null,
  contraindications: null,
  preferences: null,
  status: "active",
  isVip: false,
  riskLevel: "medium",
  needsReactivation: true,
  lastVisitAt: null,
  nextVisitAt: null,
  city: null,
  state: null,
  averageCycleDays: 30,
  churnRiskScore: 72,
  nextBestAction: "Contato manual",
  lastServiceId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("RetentionIntelligenceCard", () => {
  beforeEach(() => evaluateRetentionWithJev.mockReset());

  it("renders metrics and a Jev recommendation without automatic-action wording", async () => {
    evaluateRetentionWithJev.mockResolvedValue({
      status: "suggested",
      action: "offer_rebooking",
      actionLabel: "Oferecer novo agendamento",
      description: "O ciclo de retorno está vencido.",
      urgency: 67,
      confidence: 0.82,
      evidenceSufficiency: 0.91,
      model: "jev-1.13.0",
      evaluatedAt: "2026-09-22T12:00:00.000Z",
      automaticAction: false,
    });
    render(<RetentionIntelligenceCard client={client} />);

    expect(screen.getByText("72%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Avaliar com Jev" }));

    await waitFor(() => expect(screen.getByText("Oferecer novo agendamento")).toBeInTheDocument());
    expect(evaluateRetentionWithJev).toHaveBeenCalledWith({ tenantId: client.tenantId, clientId: client.id });
    expect(screen.getByText(/Nenhuma mensagem é enviada/)).toBeInTheDocument();
  });

});
