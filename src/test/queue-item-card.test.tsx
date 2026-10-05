import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  scheduledFor: "2000-01-01T12:00:00.000Z",
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

    const actionButton = screen.getByRole("button", { name: "Ações" });
    fireEvent.click(actionButton);

    expect(onOpen).toHaveBeenCalledWith(item, actionButton);
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

  it("bloqueia ações e seleção até a hora de contato programada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00.000Z"));
    const onOpen = vi.fn();
    const onConfirmQuick = vi.fn();
    const toggleSelection = vi.fn();

    render(
      <QueueItemCard
        item={{ ...item, scheduledFor: "2026-10-04T12:05:00.000Z" }}
        onOpen={onOpen}
        onConfirmQuick={onConfirmQuick}
        selection={{ selectedIds: new Set(), toggleSelection }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("As ações serão liberadas nesse horário.");
    expect(screen.getByRole("button", { name: "Ações" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Selecionar Cliente QA" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Ações" }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar Cliente QA" }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(onConfirmQuick).not.toHaveBeenCalled();
    expect(toggleSelection).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(5 * 60 * 1000 + 20));
    expect(screen.getByRole("button", { name: "Ações" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Selecionar Cliente QA" })).toBeEnabled();
  });
});
