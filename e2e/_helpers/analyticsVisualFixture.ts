import type { Page, Route } from "@playwright/test";

const FIXED_NOW = new Date("2026-09-25T15:00:00.000Z");

const historicalAppointments = [
  appointment("hist-1", "client-1", "pro-1", "2026-09-05T13:00:00.000Z", 60, "completed", "frontdesk", 12_000, {
    confirmed_at: "2026-09-04T16:00:00.000Z",
    completed_at: "2026-09-05T14:00:00.000Z",
  }),
  appointment("hist-2", "client-2", "pro-1", "2026-09-12T14:00:00.000Z", 30, "completed", "whatsapp", 9_000, {
    confirmed_at: "2026-09-11T18:00:00.000Z",
    completed_at: "2026-09-12T14:30:00.000Z",
  }),
  appointment("hist-3", "client-3", "pro-2", "2026-09-15T15:00:00.000Z", 45, "no_show", "phone", 11_000, {
    no_show_at: "2026-09-15T15:15:00.000Z",
  }),
  appointment("hist-4", "client-1", "pro-2", "2026-09-18T16:00:00.000Z", 30, "canceled", "whatsapp", 10_000, {
    canceled_at: "2026-09-17T12:00:00.000Z",
  }),
];

const futureAppointments = [
  appointment("future-1", "client-1", "pro-1", "2026-10-02T13:00:00.000Z", 60, "pending", "frontdesk", 15_000),
  appointment("future-2", "client-2", "pro-2", "2026-10-05T14:00:00.000Z", 45, "confirmed", "whatsapp", 35_000, {
    confirmed_at: "2026-09-24T17:00:00.000Z",
  }),
];

const appointmentItems = [
  { appointment_id: "hist-1", service_id: "service-1", position: 0 },
  { appointment_id: "hist-2", service_id: "service-2", position: 0 },
  { appointment_id: "hist-3", service_id: "service-1", position: 0 },
  { appointment_id: "hist-4", service_id: "service-2", position: 0 },
  { appointment_id: "future-1", service_id: "service-1", position: 0 },
  { appointment_id: "future-2", service_id: "service-2", position: 0 },
];

const clients = [
  {
    id: "client-1",
    created_at: "2026-01-10T12:00:00.000Z",
    is_vip: true,
    full_name: "Cliente Visual 1",
    email: "cliente1@example.test",
    phone: "11999990001",
    last_visit_at: "2026-09-05T13:00:00.000Z",
  },
  {
    id: "client-2",
    created_at: "2026-08-01T12:00:00.000Z",
    is_vip: false,
    full_name: "Cliente Visual 2",
    email: "cliente2@example.test",
    phone: "11999990002",
    last_visit_at: "2026-09-12T14:00:00.000Z",
  },
  {
    id: "client-3",
    created_at: "2026-09-01T12:00:00.000Z",
    is_vip: false,
    full_name: "Cliente Visual 3",
    email: null,
    phone: "11999990003",
    last_visit_at: null,
  },
];

const businessHours = Array.from({ length: 7 }, (_, weekday) => ({
  unit_id: "unit-1",
  weekday,
  opens_at: "09:00:00",
  closes_at: "18:00:00",
  is_closed: false,
}));

function appointment(
  id: string,
  clientId: string,
  professionalId: string,
  startsAt: string,
  durationMinutes: number,
  status: string,
  source: string,
  totalPriceCents: number,
  patch: Record<string, string | null> = {},
) {
  const starts = new Date(startsAt);
  const ends = new Date(starts.getTime() + durationMinutes * 60_000);
  return {
    id,
    tenant_id: "visual-tenant",
    unit_id: "unit-1",
    professional_id: professionalId,
    client_id: clientId,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    duration_minutes: durationMinutes,
    status,
    source,
    total_price_cents: totalPriceCents,
    is_overbooked: false,
    confirmed_at: null,
    reminded_at: null,
    no_show_at: null,
    canceled_at: null,
    completed_at: null,
    created_at: "2026-08-20T12:00:00.000Z",
    ...patch,
  };
}

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: { "content-range": "0-999/*" },
    body: JSON.stringify(body),
  });
}

function isFutureAppointmentQuery(url: URL): boolean {
  return url.searchParams
    .getAll("starts_at")
    .some((value) => value.startsWith("gte.2026-09-25"));
}

/**
 * Mantém o baseline visual do Analytics determinístico. O restante da suíte
 * autenticada continua usando o Supabase real; este fixture existe somente
 * para comparação de layout/pixels desta rota.
 */
export async function installAnalyticsVisualFixture(page: Page): Promise<void> {
  await page.clock.install({ time: FIXED_NOW });

  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop();
    const select = url.searchParams.get("select") ?? "";

    if (table === "appointments" && select.includes("is_overbooked")) {
      return json(route, isFutureAppointmentQuery(url) ? futureAppointments : historicalAppointments);
    }
    if (table === "appointments" && select.includes("client_id,starts_at,status")) {
      return json(
        route,
        historicalAppointments.map(({ client_id, starts_at, status }) => ({ client_id, starts_at, status })),
      );
    }
    if (table === "appointment_items" && select.includes("appointment_id,service_id,position")) {
      return json(route, appointmentItems);
    }
    if (table === "clients" && select.includes("last_visit_at")) return json(route, clients);
    if (table === "unit_business_hours" && select.includes("opens_at")) return json(route, businessHours);
    if (table === "professional_availability" && select.includes("starts_at")) return json(route, []);
    if (table === "time_off_blocks" && select.includes("scope")) return json(route, []);
    if (table === "waitlist_entries" && select.includes("created_at")) {
      return json(route, [
        { id: "wait-1", status: "open", created_at: "2026-09-10T12:00:00.000Z" },
        { id: "wait-2", status: "contacted", created_at: "2026-09-11T12:00:00.000Z" },
        { id: "wait-3", status: "scheduled", created_at: "2026-09-12T12:00:00.000Z" },
      ]);
    }
    if (table === "client_package_balances" && select.includes("sessions_used")) {
      return json(route, [
        { client_id: "client-1", sessions_used: 2, sessions_total: 4, expires_at: "2026-12-31", status: "active" },
        { client_id: "client-2", sessions_used: 4, sessions_total: 4, expires_at: "2026-11-30", status: "completed" },
      ]);
    }
    if (table === "professionals" && select.includes("is_active,unit_id")) {
      return json(route, [
        { id: "pro-1", is_active: true, unit_id: "unit-1" },
        { id: "pro-2", is_active: true, unit_id: "unit-1" },
      ]);
    }
    if (table === "professionals" && select.includes("display_name")) {
      return json(route, [
        { id: "pro-1", display_name: "Ana Visual" },
        { id: "pro-2", display_name: "Bruno Visual" },
      ]);
    }
    if (table === "units" && select.includes("id,name")) {
      return json(route, [{ id: "unit-1", name: "Unidade Visual" }]);
    }
    if (table === "services" && select.includes("id,name")) {
      return json(route, [
        { id: "service-1", name: "Serviço Visual A" },
        { id: "service-2", name: "Serviço Visual B" },
      ]);
    }

    return route.continue();
  });
}
