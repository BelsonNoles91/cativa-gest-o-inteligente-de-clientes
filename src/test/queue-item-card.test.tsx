import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueueItemCard } from "@/features/confirmation/QueueItemCard";
import type { QueueItemHydrated } from "@/repositories/confirmation";

const item: QueueItemHydrated = {
  id: "queue-1",
  tenantId: "tenant-1",
  appointmentId: "appointment-1",
  clientId: "client-1",
  ruleId: null,
  stage: "today",
  status: "pending",
  priority: 80,
  scheduledFor: "2030-01-01T12:00:00.000Z",
  appointmentStartsAt: "2030-01-01T13:00:00.000Z",
  assignedTo: null,
  lastAttemptAt: null,
  attemptsCount: 0,
  followUpAt: null,
  closedAt: null,
  notes: null,
  createdAt: "2030-01-01T12:00:00.000Z",
  updatedAt: "2030-01-01T12:00:00.000Z",
  clientName: "Cliente QA",
  clientPhone: "11999990000",
  clientWhatsapp: "11999990000",
  clientIsVip: false,
  clientRiskLevel: "medium",
  serviceName: "Serviço QA",
  professionalName: "Profissional QA",
  unitName: "Unidade QA",
};

afterEach(() => cleanup());

describe("QueueItemCard", () => {
  it("abre as ações pelo controle dedicado mesmo quando a seleção em lote está disponível", () => {
    const onOpen = vi.fn();
    const toggleSelection = vi.fn();

    render(
      <QueueItemCard
        item={item}
        onOpen={onOpen}
        selection={{ selectedIds: new Set(), toggleSelection }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ações" }));

    expect(onOpen).toHaveBeenCalledWith(item);
    expect(toggleSelection).not.toHaveBeenCalled();
  });

  it("altera a seleção apenas pelo controle dedicado", () => {
    const onOpen = vi.fn();
    const toggleSelection = vi.fn();

    render(
      <QueueItemCard
        item={item}
        onOpen={onOpen}
        selection={{ selectedIds: new Set(), toggleSelection }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Selecionar Cliente QA" }),
    );

    expect(toggleSelection).toHaveBeenCalledWith(item.id);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
