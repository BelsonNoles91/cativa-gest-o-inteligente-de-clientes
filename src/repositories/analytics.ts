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
 * Nota: queries são limitadas em 1000 por chamada do PostgREST. Para volumes maiores
 * a próxima evolução é mover este cálculo para SQL/RPC.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ApptFact,
  AvailabilityFact,
  ClientFact,
  ContactAttemptFact,
} from "@/domain/analytics";
import type { AppointmentSource, AppointmentStatus } from "@/domain/scheduling";

const APPT_COLS = `
  id, tenant_id, unit_id, professional_id, client_id,
  starts_at, ends_at, duration_minutes, status, source,
  total_price_cents, is_overbooked,
  confirmed_at, reminded_at, no_show_at, canceled_at, completed_at, created_at
`;

export interface AnalyticsRangeInput {
  tenantId: string;
  start: string; // ISO
  end: string;   // ISO
}

export async function fetchAppointments(input: AnalyticsRangeInput): Promise<ApptFact[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(APPT_COLS)
    .eq("tenant_id", input.tenantId)
    .gte("starts_at", input.start)
    .lt("starts_at", input.end)
    .order("starts_at");
  if (error) throw error;
  return hydrateAppointmentsWithServices((data ?? []) as Record<string, unknown>[]);
}

/** Agendamentos futuros (para “valor futuro” e “receita em risco”). */
export async function fetchFutureAppointments(tenantId: string): Promise<ApptFact[]> {
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + 60 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPT_COLS)
    .eq("tenant_id", tenantId)
    .gte("starts_at", now)
    .lt("starts_at", horizon)
    .order("starts_at");
  if (error) throw error;
  return hydrateAppointmentsWithServices((data ?? []) as Record<string, unknown>[]);
}

async function hydrateAppointmentsWithServices(
  rows: Record<string, unknown>[],
): Promise<ApptFact[]> {
  const facts = rows.map(rowToAppt);
  const appointmentIds = facts.map((fact) => fact.id);
  if (appointmentIds.length === 0) return facts;

  const { data: items, error } = await supabase
    .from("appointment_items")
    .select("appointment_id, service_id, position")
    .in("appointment_id", appointmentIds)
    .order("position", { ascending: true });
  if (error) throw error;

  const primaryServiceByAppointment = new Map<string, string>();
  for (const item of items ?? []) {
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
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, created_at, is_vip, full_name, email, phone, whatsapp_phone, birth_date, preferences, preferred_professional_id, preferred_unit_id, last_visit_at",
    )
    .eq("tenant_id", tenantId);
  if (error) throw error;
  // calcula completedVisits e firstVisitAt em outra query agregada
  const ids = (data ?? []).map((c) => c.id as string);
  const visits = await aggregateClientVisits(tenantId, ids);

  return (data ?? []).map((c) => {
    const v = visits.get(c.id as string);
    return {
      id: c.id as string,
      createdAt: c.created_at as string,
      isVip: Boolean(c.is_vip),
      fullName: c.full_name as string,
      email: (c.email as string) ?? null,
      phone: (c.phone as string) ?? null,
      whatsappPhone: (c.whatsapp_phone as string) ?? null,
      birthDate: (c.birth_date as string) ?? null,
      preferences: (c.preferences as string) ?? null,
      preferredProfessionalId: (c.preferred_professional_id as string) ?? null,
      preferredUnitId: (c.preferred_unit_id as string) ?? null,
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
  const { data, error } = await supabase
    .from("appointments")
    .select("client_id, starts_at, status")
    .eq("tenant_id", tenantId)
    .in("client_id", clientIds);
  if (error) throw error;
  for (const r of data ?? []) {
    const cid = r.client_id as string;
    if ((r.status as string) !== "completed") continue;
    const entry = out.get(cid) ?? { count: 0, first: null, last: null };
    entry.count += 1;
    const ts = r.starts_at as string;
    if (!entry.first || ts < entry.first) entry.first = ts;
    if (!entry.last || ts > entry.last) entry.last = ts;
    out.set(cid, entry);
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
  const { data: hours, error: hErr } = await supabase
    .from("unit_business_hours")
    .select("unit_id, weekday, opens_at, closes_at, is_closed")
    .eq("tenant_id", input.tenantId);
  if (hErr) throw hErr;

  const { data: avails, error: aErr } = await supabase
    .from("professional_availability")
    .select("professional_id, unit_id, weekday, starts_at, ends_at, is_active")
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true);
  if (aErr) throw aErr;

  const { data: pros, error: pErr } = await supabase
    .from("professionals")
    .select("id, is_active, unit_id")
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true);
  if (pErr) throw pErr;

  const { data: blocks, error: bErr } = await supabase
    .from("time_off_blocks")
    .select("scope, professional_id, unit_id, starts_at, ends_at")
    .eq("tenant_id", input.tenantId)
    .gte("ends_at", input.start)
    .lt("starts_at", input.end);
  if (bErr) throw bErr;

  let availableMinutes = 0;

  const start = new Date(input.start);
  const end = new Date(input.end);
  const dayMs = 86_400_000;

  for (let t = new Date(start); t < end; t = new Date(t.getTime() + dayMs)) {
    const weekday = t.getDay();
    const dayStart = new Date(t);
    dayStart.setHours(0, 0, 0, 0);

    for (const u of hours ?? []) {
      if (u.is_closed) continue;
      if ((u.weekday as number) !== weekday) continue;
      if (input.unitId && u.unit_id !== input.unitId) continue;

      const open = parseHM(u.opens_at as string, dayStart);
      const close = parseHM(u.closes_at as string, dayStart);
      const unitMin = Math.max(0, (close.getTime() - open.getTime()) / 60000);

      const unitPros = (pros ?? []).filter(
        (p) => !p.unit_id || p.unit_id === u.unit_id,
      );
      for (const pro of unitPros) {
        if (input.professionalId && pro.id !== input.professionalId) continue;

        // janelas do profissional naquele dia
        const windows = (avails ?? []).filter(
          (a) =>
            a.professional_id === pro.id &&
            (a.weekday as number) === weekday &&
            (!a.unit_id || a.unit_id === u.unit_id),
        );
        let proMin: number;
        if (windows.length === 0) {
          // se não declarou janela, assume horário da unidade
          proMin = unitMin;
        } else {
          proMin = windows.reduce((acc, w) => {
            const ws = parseHM(w.starts_at as string, dayStart);
            const we = parseHM(w.ends_at as string, dayStart);
            const winStart = new Date(Math.max(open.getTime(), ws.getTime()));
            const winEnd = new Date(Math.min(close.getTime(), we.getTime()));
            return acc + Math.max(0, (winEnd.getTime() - winStart.getTime()) / 60000);
          }, 0);
        }

        // descontar bloqueios que tocam o dia
        const dayBlocks = (blocks ?? []).filter(
          (b) =>
            (b.scope === "professional" && b.professional_id === pro.id) ||
            (b.scope === "unit" && b.unit_id === u.unit_id),
        );
        for (const blk of dayBlocks) {
          const bs = new Date(blk.starts_at as string);
          const be = new Date(blk.ends_at as string);
          const overlapStart = Math.max(bs.getTime(), dayStart.getTime());
          const overlapEnd = Math.min(be.getTime(), dayStart.getTime() + dayMs);
          if (overlapEnd > overlapStart) {
            proMin = Math.max(0, proMin - (overlapEnd - overlapStart) / 60000);
          }
        }

        availableMinutes += proMin;
      }
    }
  }

  // bookedMinutes/completedMinutes: o caller já carrega os appts; aqui devolvemos só availability.
  return { availableMinutes, bookedMinutes: 0, completedMinutes: 0 };
}

function parseHM(hm: string, dayStart: Date): Date {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(dayStart);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export async function fetchContactAttempts(input: AnalyticsRangeInput): Promise<ContactAttemptFact[]> {
  const { data, error } = await supabase
    .from("contact_attempts")
    .select("id, tenant_id, appointment_id, channel, result, attempted_at")
    .eq("tenant_id", input.tenantId)
    .gte("attempted_at", input.start)
    .lt("attempted_at", input.end);
  if (error) throw error;
  return (data ?? []).map((r) => ({
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
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("id, status, created_at")
    .eq("tenant_id", input.tenantId)
    .gte("created_at", input.start)
    .lt("created_at", input.end);
  if (error) throw error;
  const rows = data ?? [];
  return {
    totalOpen: rows.filter((r) => r.status === "open").length,
    worked: rows.filter((r) => r.status !== "open").length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
  };
}

export async function fetchClientPackages(tenantId: string): Promise<Array<{ used: number; total: number; clientId: string; expiresAt: string | null }>> {
  const { data, error } = await supabase
    .from("client_package_balances")
    .select("client_id, sessions_used, sessions_total, expires_at, status")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
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
    supabase.from("units").select("id, name").eq("tenant_id", tenantId),
    supabase.from("professionals").select("id, display_name").eq("tenant_id", tenantId),
    supabase.from("services").select("id, name").eq("tenant_id", tenantId),
  ]);
  if (u.error) throw u.error;
  if (p.error) throw p.error;
  if (s.error) throw s.error;
  return {
    units: new Map((u.data ?? []).map((r) => [r.id as string, r.name as string])),
    pros: new Map((p.data ?? []).map((r) => [r.id as string, r.display_name as string])),
    services: new Map((s.data ?? []).map((r) => [r.id as string, r.name as string])),
  };
}
