/**
 * Repositório de Analytics.
 *
 * - Lê os fatos crus por tenant + período: appointments, clients, contact_attempts,
 *   waitlist, packages.
 * - O cálculo das métricas vive no domínio (`@/domain/analytics`).
 * - Aqui também calculamos a **disponibilidade** (minutos disponíveis no período)
 *   somando: para cada dia do range, para cada profissional ativo na unidade,
 *   somar (close - open) ∩ (proAvail) − bloqueios pontuais.
 *
 * As leituras paginam além do limite por resposta do PostgREST. Para volumes
 * muito grandes, a próxima evolução é mover agregações pesadas para SQL/RPC.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ApptFact,
  AvailabilityFact,
  ClientFact,
  ContactAttemptFact,
} from "@/domain/analytics";
import { calculateAvailableMinutes } from "@/domain/availability";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import type { AppointmentSource, AppointmentStatus } from "@/domain/scheduling";

const APPT_COLS = `
  id, tenant_id, unit_id, professional_id, client_id,
  starts_at, ends_at, duration_minutes, status, source,
  total_price_cents, is_overbooked,
  confirmed_at, reminded_at, no_show_at, canceled_at, completed_at, created_at
`;

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export interface AnalyticsRangeInput {
  tenantId: string;
  start: string; // ISO
  end: string;   // ISO
}

export async function fetchAppointments(input: AnalyticsRangeInput): Promise<ApptFact[]> {
  const data = await fetchAllPages((from, to) =>
    supabase
      .from("appointments")
      .select(APPT_COLS)
      .eq("tenant_id", input.tenantId)
      .gte("starts_at", input.start)
      .lt("starts_at", input.end)
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return hydrateAppointmentsWithServices(data as Record<string, unknown>[]);
}

/** Agendamentos futuros (para “valor futuro” e “receita em risco”). */
export async function fetchFutureAppointments(tenantId: string): Promise<ApptFact[]> {
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + 60 * 86_400_000).toISOString();
  const data = await fetchAllPages((from, to) =>
    supabase
      .from("appointments")
      .select(APPT_COLS)
      .eq("tenant_id", tenantId)
      .gte("starts_at", now)
      .lt("starts_at", horizon)
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return hydrateAppointmentsWithServices(data as Record<string, unknown>[]);
}

async function hydrateAppointmentsWithServices(
  rows: Record<string, unknown>[],
): Promise<ApptFact[]> {
  const facts = rows.map(rowToAppt);
  const appointmentIds = facts.map((fact) => fact.id);
  if (appointmentIds.length === 0) return facts;

  const items: Array<{ appointment_id: string; service_id: string | null; position: number; id: string }> = [];
  const appointmentIdChunks = chunkValues(appointmentIds, 300);
  // Limita simultaneamente o tamanho do filtro IN e a pressão sobre o banco.
  for (let index = 0; index < appointmentIdChunks.length; index += 4) {
    const itemPages = await Promise.all(
      appointmentIdChunks.slice(index, index + 4).map((ids) =>
        fetchAllPages((from, to) =>
          supabase
            .from("appointment_items")
            .select("id, appointment_id, service_id, position")
            .in("appointment_id", ids)
            .order("position", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        ),
      ),
    );
    items.push(...itemPages.flat());
  }

  const primaryServiceByAppointment = new Map<string, string>();
  for (const item of items) {
    const appointmentId = item.appointment_id as string;
    const serviceId = item.service_id as string | null;
    if (!serviceId || primaryServiceByAppointment.has(appointmentId)) continue;
    primaryServiceByAppointment.set(appointmentId, serviceId);
  }

  return facts.map((fact) => ({
    ...fact,
    serviceId: primaryServiceByAppointment.get(fact.id) ?? null,
  }));
}

function rowToAppt(r: Record<string, unknown>): ApptFact {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    unitId: r.unit_id as string,
    professionalId: r.professional_id as string,
    serviceId: null,
    clientId: r.client_id as string,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    durationMinutes: r.duration_minutes as number,
    status: r.status as AppointmentStatus,
    source: r.source as AppointmentSource,
    totalPriceCents: (r.total_price_cents as number) ?? 0,
    isOverbooked: Boolean(r.is_overbooked),
    confirmedAt: (r.confirmed_at as string) ?? null,
    remindedAt: (r.reminded_at as string) ?? null,
    noShowAt: (r.no_show_at as string) ?? null,
    canceledAt: (r.canceled_at as string) ?? null,
    completedAt: (r.completed_at as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function fetchClients(tenantId: string): Promise<ClientFact[]> {
  const allRows = await fetchAllPages((from, to) =>
    supabase
      .from("clients")
      .select("id, created_at, is_vip, full_name, email, phone, last_visit_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  ) as Record<string, unknown>[];

  const ids = allRows.map((c) => c.id as string);
  const visits = await aggregateClientVisits(tenantId, ids);

  return allRows.map((c) => {
    const v = visits.get(c.id as string);
    return {
      id: c.id as string,
      createdAt: c.created_at as string,
      isVip: Boolean(c.is_vip),
      fullName: c.full_name as string,
      email: (c.email as string) ?? null,
      phone: (c.phone as string) ?? null,
      whatsappPhone: null,
      birthDate: null,
      preferences: null,
      preferredProfessionalId: null,
      preferredUnitId: null,
      completedVisits: v?.count ?? 0,
      firstVisitAt: v?.first ?? null,
      lastVisitAt: (c.last_visit_at as string) ?? v?.last ?? null,
    };
  });
}

async function aggregateClientVisits(
  tenantId: string,
  clientIds: string[],
): Promise<Map<string, { count: number; first: string | null; last: string | null }>> {
  const out = new Map<string, { count: number; first: string | null; last: string | null }>();
  if (clientIds.length === 0) return out;
  const clientIdChunks = chunkValues(clientIds, 100);
  for (let index = 0; index < clientIdChunks.length; index += 4) {
    const rowPages = await Promise.all(
      clientIdChunks.slice(index, index + 4).map((ids) =>
        fetchAllPages((from, to) =>
          supabase
            .from("appointments")
            .select("id, client_id, starts_at, status")
            .eq("tenant_id", tenantId)
            .in("client_id", ids)
            .order("starts_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        ),
      ),
    );
    for (const r of rowPages.flat()) {
      const cid = r.client_id as string;
      if ((r.status as string) !== "completed") continue;
      const entry = out.get(cid) ?? { count: 0, first: null, last: null };
      entry.count += 1;
      const ts = r.starts_at as string;
      if (!entry.first || ts < entry.first) entry.first = ts;
      if (!entry.last || ts > entry.last) entry.last = ts;
      out.set(cid, entry);
    }
  }
  return out;
}

/**
 * Disponibilidade total do tenant no período (filtros aplicados em memória).
 * Calcula minutos abertos por (unidade × dia × profissional disponível).
 */
export async function fetchAvailability(
  input: AnalyticsRangeInput & {
    unitId?: string | null;
    professionalId?: string | null;
  },
): Promise<AvailabilityFact> {
  const [hours, avails, pros, blocks] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("unit_business_hours")
        .select("unit_id, weekday, opens_at, closes_at, is_closed")
        .eq("tenant_id", input.tenantId)
        .order("unit_id", { ascending: true })
        .order("weekday", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("professional_availability")
        .select("professional_id, unit_id, weekday, starts_at, ends_at, is_active")
        .eq("tenant_id", input.tenantId)
        .eq("is_active", true)
        .order("professional_id", { ascending: true })
        .order("weekday", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("professionals")
        .select("id, is_active, unit_id")
        .eq("tenant_id", input.tenantId)
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("time_off_blocks")
        .select("scope, professional_id, unit_id, starts_at, ends_at")
        .eq("tenant_id", input.tenantId)
        .gt("ends_at", input.start)
        .lt("starts_at", input.end)
        .order("starts_at", { ascending: true })
        .range(from, to),
    ),
  ]);

  const availableMinutes = calculateAvailableMinutes({
    start: input.start,
    end: input.end,
    unitId: input.unitId,
    professionalId: input.professionalId,
    businessHours: (hours ?? []).map((row) => ({
      unitId: row.unit_id as string,
      weekday: row.weekday as number,
      opensAt: row.opens_at as string,
      closesAt: row.closes_at as string,
      isClosed: Boolean(row.is_closed),
    })),
    professionalAvailability: (avails ?? []).map((row) => ({
      professionalId: row.professional_id as string,
      unitId: (row.unit_id as string | null) ?? null,
      weekday: row.weekday as number,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
    })),
    professionals: (pros ?? []).map((row) => ({
      id: row.id as string,
      unitId: (row.unit_id as string | null) ?? null,
    })),
    blocks: (blocks ?? []).map((row) => ({
      scope: row.scope as "professional" | "unit",
      professionalId: (row.professional_id as string | null) ?? null,
      unitId: (row.unit_id as string | null) ?? null,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
    })),
  });

  // bookedMinutes/completedMinutes: o caller já carrega os appts; aqui devolvemos só availability.
  return { availableMinutes, bookedMinutes: 0, completedMinutes: 0 };
}

export async function fetchContactAttempts(input: AnalyticsRangeInput): Promise<ContactAttemptFact[]> {
  const data = await fetchAllPages((from, to) =>
    supabase
      .from("contact_attempts")
      .select("id, tenant_id, appointment_id, channel, result, attempted_at")
      .eq("tenant_id", input.tenantId)
      .gte("attempted_at", input.start)
      .lt("attempted_at", input.end)
      .order("attempted_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.map((r) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    appointmentId: (r.appointment_id as string) ?? null,
    channel: r.channel as ContactAttemptFact["channel"],
    result: r.result as string,
    attemptedAt: r.attempted_at as string,
  }));
}

export interface WaitlistMetricsRaw {
  totalOpen: number;
  worked: number;     // entries com pelo menos 1 contato
  scheduled: number;  // entries que viraram appointment
}

export async function fetchWaitlistMetrics(input: AnalyticsRangeInput): Promise<WaitlistMetricsRaw> {
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from("waitlist_entries")
      .select("id, status, created_at")
      .eq("tenant_id", input.tenantId)
      .gte("created_at", input.start)
      .lt("created_at", input.end)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return {
    totalOpen: rows.filter((r) => r.status === "open").length,
    worked: rows.filter((r) => r.status !== "open").length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
  };
}

export async function fetchClientPackages(tenantId: string): Promise<Array<{ used: number; total: number; clientId: string; expiresAt: string | null }>> {
  const data = await fetchAllPages((from, to) =>
    supabase
      .from("client_package_balances")
      .select("client_id, sessions_used, sessions_total, expires_at, status")
      .eq("tenant_id", tenantId)
      .order("client_id", { ascending: true })
      .range(from, to),
  );
  return data.map((r) => ({
    clientId: r.client_id as string,
    used: r.sessions_used as number,
    total: r.sessions_total as number,
    expiresAt: (r.expires_at as string) ?? null,
  }));
}

/** Lookups para rótulos: profissionais, unidades, serviços. */
export async function fetchLabels(tenantId: string): Promise<{
  units: Map<string, string>;
  pros: Map<string, string>;
  services: Map<string, string>;
}> {
  const [u, p, s] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase.from("units").select("id, name").eq("tenant_id", tenantId).order("id").range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase.from("professionals").select("id, display_name").eq("tenant_id", tenantId).order("id").range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase.from("services").select("id, name").eq("tenant_id", tenantId).order("id").range(from, to),
    ),
  ]);
  return {
    units: new Map(u.map((r) => [r.id as string, r.name as string])),
    pros: new Map(p.map((r) => [r.id as string, r.display_name as string])),
    services: new Map(s.map((r) => [r.id as string, r.name as string])),
  };
}
