import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAvailableSlots: vi.fn(),
  insertAppointment: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/repositories/scheduling", () => ({
  getAvailableSlots: mocks.getAvailableSlots,
  insertAppointment: mocks.insertAppointment,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
    from: mocks.from,
  },
}));

import {
  cancelFromPortal,
  confirmFromPortal,
  createBookingFromPortal,
  fetchCancellationPolicy,
  rescheduleFromPortal,
  type CreateBookingInput,
  type RescheduleInput,
} from "./booking";

const NOW = new Date("2026-10-04T12:00:00.000Z");
const START = "2026-10-05T02:30:00.000Z";
const HOUR = 60 * 60 * 1000;

function createInput(patch: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    tenantId: "tenant-a",
    unitId: "unit-a",
    clientId: "client-a",
    professionalId: "professional-a",
    serviceId: "service-a",
    startsAt: START,
    durationMinutes: 30,
    cancellationPolicyId: "policy-a",
    tenantTimezone: "America/Belem",
    ...patch,
  };
}

function rescheduleInput(patch: Partial<RescheduleInput> = {}): RescheduleInput {
  return {
    appointmentId: "appointment-a",
    tenantId: "tenant-a",
    unitId: "unit-a",
    professionalId: "professional-a",
    serviceId: "service-a",
    startsAt: START,
    durationMinutes: 45,
    currentStartsAt: "2026-10-04T14:00:00.000Z",
    tenantTimezone: "America/Belem",
    ...patch,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mocks.getAvailableSlots.mockReset().mockResolvedValue([{ startsAt: START }]);
  mocks.insertAppointment.mockReset().mockResolvedValue({ id: "appointment-created" });
  mocks.rpc.mockReset().mockResolvedValue({ error: null });
  mocks.invoke.mockReset().mockResolvedValue({ data: null, error: null });
  mocks.from.mockReset().mockReturnValue({ select: mocks.select });
  mocks.select.mockReset().mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReset().mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
});

afterEach(() => vi.useRealTimers());

describe("createBookingFromPortal", () => {
  it("revalidates the tenant-local day and creates a pending portal booking", async () => {
    mocks.getAvailableSlots.mockResolvedValue([{ startsAt: "2026-10-05T02:30:30.000Z" }]);

    await expect(createBookingFromPortal(createInput({ cancellationPolicyId: null })))
      .resolves.toBe("appointment-created");
    expect(mocks.getAvailableSlots).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      professionalId: "professional-a",
      unitId: "unit-a",
      serviceId: "service-a",
      day: "2026-10-04",
    });
    expect(mocks.insertAppointment).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a",
      clientId: "client-a",
      startsAt: START,
      endsAt: "2026-10-05T03:00:00.000Z",
      durationMinutes: 30,
      cancellationPolicyId: null,
      source: "client_portal",
      status: "pending",
      notes: null,
      createdBy: null,
    }));
  });

  it("rejects a booking earlier than its minimum advance without querying or inserting", async () => {
    const startsAt = new Date(NOW.getTime() + HOUR).toISOString();

    await expect(createBookingFromPortal(createInput({ startsAt, minAdvanceHours: 2 })))
      .rejects.toThrow("pelo menos 2h");
    expect(mocks.getAvailableSlots).not.toHaveBeenCalled();
    expect(mocks.insertAppointment).not.toHaveBeenCalled();
  });

  it("accepts a booking exactly at the configured advance boundary", async () => {
    const startsAt = new Date(NOW.getTime() + 2 * HOUR).toISOString();
    mocks.getAvailableSlots.mockResolvedValue([{ startsAt }]);

    await expect(createBookingFromPortal(createInput({ startsAt, minAdvanceHours: 2 })))
      .resolves.toBe("appointment-created");
  });

  it("uses the safe default timezone when none is configured", async () => {
    await expect(createBookingFromPortal(createInput({ tenantTimezone: undefined })))
      .resolves.toBe("appointment-created");
    expect(mocks.getAvailableSlots).toHaveBeenCalledWith(expect.objectContaining({ day: "2026-10-04" }));
  });

  it("does not insert when the slot was taken", async () => {
    mocks.getAvailableSlots.mockResolvedValue([]);

    await expect(createBookingFromPortal(createInput())).rejects.toThrow("indisponível");
    expect(mocks.insertAppointment).not.toHaveBeenCalled();
  });

  it("accepts a slot timestamp difference just under the one-minute tolerance", async () => {
    mocks.getAvailableSlots.mockResolvedValue([{ startsAt: "2026-10-05T02:30:59.999Z" }]);

    await expect(createBookingFromPortal(createInput())).resolves.toBe("appointment-created");
  });

  it("rejects a slot timestamp difference of exactly one minute", async () => {
    mocks.getAvailableSlots.mockResolvedValue([{ startsAt: "2026-10-05T02:31:00.000Z" }]);

    await expect(createBookingFromPortal(createInput())).rejects.toThrow("indisponível");
    expect(mocks.insertAppointment).not.toHaveBeenCalled();
  });

  it.each([
    "not-a-date",
    "2026-02-30T12:00:00.000Z",
    "2026-10-05T25:00:00.000Z",
  ])(
    "rejects an invalid start timestamp (%s) before checking availability",
    async (startsAt) => {
      await expect(createBookingFromPortal(createInput({ startsAt })))
        .rejects.toThrow("horário válido");
      expect(mocks.getAvailableSlots).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid tenant timezones before querying availability", async () => {
    await expect(createBookingFromPortal(createInput({ tenantTimezone: "Invalid/Zone" })))
      .rejects.toThrow("fuso horário");
    expect(mocks.getAvailableSlots).not.toHaveBeenCalled();
  });

  it.each([0, -15, 2.5, Number.NaN])("rejects an invalid service duration (%s)", async (durationMinutes) => {
    await expect(createBookingFromPortal(createInput({ durationMinutes })))
      .rejects.toThrow("duração do serviço");
    expect(mocks.getAvailableSlots).not.toHaveBeenCalled();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid minimum-advance setting (%s)",
    async (minAdvanceHours) => {
      await expect(createBookingFromPortal(createInput({ minAdvanceHours })))
        .rejects.toThrow("antecedência mínima");
      expect(mocks.getAvailableSlots).not.toHaveBeenCalled();
    },
  );

  it("propagates repository insert failures", async () => {
    mocks.insertAppointment.mockRejectedValue(new Error("database unavailable"));

    await expect(createBookingFromPortal(createInput())).rejects.toThrow("database unavailable");
  });
});

describe("rescheduleFromPortal", () => {
  it("revalidates the destination slot and delegates the mutation to the server RPC", async () => {
    await expect(rescheduleFromPortal(rescheduleInput())).resolves.toBeUndefined();

    expect(mocks.getAvailableSlots).toHaveBeenCalledWith(expect.objectContaining({ day: "2026-10-04" }));
    expect(mocks.rpc).toHaveBeenCalledWith("portal_reschedule_appointment", {
      _appointment_id: "appointment-a",
      _starts_at: START,
      _ends_at: "2026-10-05T03:15:00.000Z",
      _professional_id: "professional-a",
    });
  });

  it("does not call the mutation RPC when the slot is unavailable", async () => {
    mocks.getAvailableSlots.mockResolvedValue([]);

    await expect(rescheduleFromPortal(rescheduleInput())).rejects.toThrow("indisponível");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid start time, timezone, or duration before checking slots", async () => {
    await expect(rescheduleFromPortal(rescheduleInput({ startsAt: "not-a-date" })))
      .rejects.toThrow("horário válido");
    await expect(rescheduleFromPortal(rescheduleInput({ tenantTimezone: "Invalid/Zone" })))
      .rejects.toThrow("fuso horário");
    await expect(rescheduleFromPortal(rescheduleInput({ durationMinutes: 0 })))
      .rejects.toThrow("duração do serviço");
    expect(mocks.getAvailableSlots).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("propagates server-side policy errors and uses a safe fallback", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "Reagendamento não permitido" } });
    await expect(rescheduleFromPortal(rescheduleInput())).rejects.toThrow("Reagendamento não permitido");

    mocks.rpc.mockResolvedValueOnce({ error: {} });
    await expect(rescheduleFromPortal(rescheduleInput())).rejects.toThrow("Erro ao reagendar");
  });
});

describe("cancelFromPortal", () => {
  it("sends only the appointment id and an optional reason to the server RPC", async () => {
    await cancelFromPortal({ appointmentId: "appointment-a", reason: "Preciso remarcar" });
    expect(mocks.rpc).toHaveBeenCalledWith("portal_cancel_appointment", {
      _appointment_id: "appointment-a",
      _reason: "Preciso remarcar",
    });

    mocks.rpc.mockClear();
    await cancelFromPortal({ appointmentId: "appointment-b" });
    expect(mocks.rpc).toHaveBeenCalledWith("portal_cancel_appointment", {
      _appointment_id: "appointment-b",
      _reason: null,
    });
  });

  it("propagates server cancellation errors and uses a safe fallback", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "Cancelamento bloqueado" } });
    await expect(cancelFromPortal({ appointmentId: "appointment-a" })).rejects.toThrow("Cancelamento bloqueado");

    mocks.rpc.mockResolvedValueOnce({ error: {} });
    await expect(cancelFromPortal({ appointmentId: "appointment-a" })).rejects.toThrow("Erro ao cancelar");
  });
});

describe("confirmFromPortal", () => {
  it("confirms server-side then requests a secondary notification", async () => {
    await confirmFromPortal("appointment-a");

    expect(mocks.rpc).toHaveBeenCalledWith("portal_confirm_appointment", {
      _appointment_id: "appointment-a",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("push-dispatch", {
      body: { action: "confirmed", appointmentId: "appointment-a" },
    });
  });

  it("does not dispatch a notification when server confirmation fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Agendamento expirado" } });

    await expect(confirmFromPortal("appointment-a")).rejects.toThrow("Agendamento expirado");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("uses a safe fallback when the confirmation RPC has no error message", async () => {
    mocks.rpc.mockResolvedValue({ error: {} });

    await expect(confirmFromPortal("appointment-a"))
      .rejects.toThrow("Erro ao confirmar agendamento");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("keeps confirmation successful when the secondary push throws or returns an error", async () => {
    mocks.invoke.mockRejectedValueOnce(new Error("push offline"));
    await expect(confirmFromPortal("appointment-a")).resolves.toBeUndefined();

    mocks.invoke.mockResolvedValueOnce({ data: null, error: { message: "push unavailable" } });
    await expect(confirmFromPortal("appointment-b")).resolves.toBeUndefined();
  });
});

describe("fetchCancellationPolicy", () => {
  it("returns null when the policy does not exist", async () => {
    await expect(fetchCancellationPolicy("policy-missing")).resolves.toBeNull();
    expect(mocks.from).toHaveBeenCalledWith("cancellation_policies");
    expect(mocks.eq).toHaveBeenCalledWith("id", "policy-missing");
  });

  it("maps a stored policy snapshot and normalizes its optional description", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "policy-a",
        name: "Cancelamento padrão",
        description: null,
        hours_before_no_charge: 24,
        late_cancel_fee_pct: 50,
        no_show_fee_pct: 100,
      },
      error: null,
    });

    await expect(fetchCancellationPolicy("policy-a")).resolves.toEqual({
      id: "policy-a",
      name: "Cancelamento padrão",
      description: null,
      hoursBeforeNoCharge: 24,
      lateCancelFeePct: 50,
      noShowFeePct: 100,
    });
  });

  it("propagates policy query errors without converting them to a missing policy", async () => {
    const databaseError = new Error("policy query failed");
    mocks.maybeSingle.mockResolvedValue({ data: null, error: databaseError });

    await expect(fetchCancellationPolicy("policy-a")).rejects.toBe(databaseError);
  });
});
