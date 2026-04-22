/**
 * Importadores: persistem linhas validadas (do preview) usando os
 * repositories existentes. Cada importer recebe linhas já normalizadas
 * pelo schema (`buildPreview`) e respeita tenant_id atual.
 *
 * Operação por lotes (bulk insert) para reduzir round-trips. Em caso de
 * falha parcial, retornamos contadores e mensagens — sem rollback global,
 * para preservar progresso parcial em importações grandes.
 */
import { supabase } from "@/integrations/supabase/client";
import { insertAppointment } from "@/repositories/scheduling";
import type { AppointmentSource, AppointmentStatus } from "@/domain/scheduling";

export interface ImportRunResult {
  inserted: number;
  failed: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

const CHUNK = 100;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function insertChunked(
  table: string,
  rows: Array<Record<string, unknown>>,
): Promise<ImportRunResult> {
  const result: ImportRunResult = { inserted: 0, failed: 0, errors: [] };
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    // cast: o Supabase types regenera depois das migrations
    const { error } = await supabase.from(table as never).insert(slice as never);
    if (error) {
      result.failed += slice.length;
      result.errors.push({ rowIndex: i, message: error.message });
    } else {
      result.inserted += slice.length;
    }
  }
  return result;
}

export async function importClients(
  rows: Array<Record<string, unknown>>,
  ctx: { tenantId: string; createdBy: string },
): Promise<ImportRunResult> {
  const payload = rows.map((r) => ({
    tenant_id: ctx.tenantId,
    created_by: ctx.createdBy,
    full_name: String(r.fullName ?? "").trim(),
    phone: (r.phone as string) || null,
    whatsapp_phone: (r.whatsappPhone as string) || null,
    email: (r.email as string) || null,
    birth_date: (r.birthDate as string) || null,
    city: (r.city as string) || null,
    state: (r.state as string) || null,
    origin: (r.origin as string) || null,
    notes: (r.notes as string) || null,
    is_vip: Boolean(r.isVip),
  }));
  return insertChunked("clients", payload);
}

export async function importServices(
  rows: Array<Record<string, unknown>>,
  ctx: { tenantId: string },
): Promise<ImportRunResult> {
  // 1) cria serviços
  const payload = rows.map((r) => ({
    tenant_id: ctx.tenantId,
    name: String(r.name ?? "").trim(),
    description: (r.description as string) || null,
    duration_minutes: Number(r.durationMinutes ?? 30),
    buffer_before_minutes: Number(r.bufferBeforeMinutes ?? 0),
    buffer_after_minutes: Number(r.bufferAfterMinutes ?? 0),
    is_active: true,
  }));
  const result = await insertChunked("services", payload);

  // 2) preços base — reload para pegar IDs e inserir service_prices
  if (result.inserted > 0) {
    const { data: services } = await supabase
      .from("services")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId);
    const byName = new Map((services ?? []).map((s) => [s.name, s.id]));
    const priceRows = rows
      .filter((r) => typeof r.priceCents === "number" && r.priceCents !== null)
      .map((r) => ({
        tenant_id: ctx.tenantId,
        service_id: byName.get(String(r.name).trim()),
        currency: "BRL",
        amount_cents: Math.round(Number(r.priceCents) * 100),
        is_default: true,
      }))
      .filter((r) => r.service_id);
    if (priceRows.length > 0) {
      await supabase.from("service_prices").insert(priceRows as never);
    }
  }
  return result;
}

export async function importPackages(
  rows: Array<Record<string, unknown>>,
  ctx: { tenantId: string },
): Promise<ImportRunResult> {
  const payload = rows.map((r) => ({
    tenant_id: ctx.tenantId,
    name: String(r.name ?? "").trim(),
    kind: ((r.kind as string) || "package") as "package" | "protocol",
    description: (r.description as string) || null,
    price_cents: r.priceCents ? Math.round(Number(r.priceCents) * 100) : 0,
    validity_days: r.validityDays ? Number(r.validityDays) : null,
    recommended_interval_days: r.recommendedIntervalDays
      ? Number(r.recommendedIntervalDays)
      : null,
    is_active: true,
  }));
  return insertChunked("packages", payload);
}

export async function importTeam(
  rows: Array<Record<string, unknown>>,
  ctx: { tenantId: string },
): Promise<ImportRunResult> {
  // Importação básica de profissionais — schema atual da tabela `professionals`
  // só guarda display_name + role_title. Contato/comissão/vínculo a auth.users
  // são tratados depois no módulo de Equipe.
  const payload = rows.map((r) => ({
    tenant_id: ctx.tenantId,
    display_name: String(r.displayName ?? "").trim(),
    role_title: (r.roleTitle as string) || null,
    is_active: true,
  }));
  return insertChunked("professionals", payload);
}

export async function importAppointments(
  rows: Array<Record<string, unknown>>,
  ctx: { tenantId: string; createdBy?: string | null },
): Promise<ImportRunResult> {
  const result: ImportRunResult = { inserted: 0, failed: 0, errors: [] };

  const [
    clientsResponse,
    professionalsResponse,
    servicesResponse,
    servicePricesResponse,
    unitsResponse,
  ] = await Promise.all([
    supabase.from("clients").select("id, full_name").eq("tenant_id", ctx.tenantId),
    supabase.from("professionals").select("id, display_name").eq("tenant_id", ctx.tenantId),
    supabase.from("services").select("id, name, duration_minutes").eq("tenant_id", ctx.tenantId),
    supabase
      .from("service_prices")
      .select("service_id, amount_cents, is_default")
      .eq("tenant_id", ctx.tenantId),
    supabase.from("units").select("id, name, is_active").eq("tenant_id", ctx.tenantId),
  ]);

  if (clientsResponse.error) throw clientsResponse.error;
  if (professionalsResponse.error) throw professionalsResponse.error;
  if (servicesResponse.error) throw servicesResponse.error;
  if (servicePricesResponse.error) throw servicePricesResponse.error;
  if (unitsResponse.error) throw unitsResponse.error;

  const clientByName = new Map(
    (clientsResponse.data ?? []).map((row) => [normalizeText(row.full_name), row.id]),
  );
  const professionalByName = new Map<string, string>();
  (professionalsResponse.data ?? []).forEach((row) => {
    const displayName = normalizeText(row.display_name);
    if (displayName) professionalByName.set(displayName, row.id);
  });
  const serviceByName = new Map(
    (servicesResponse.data ?? []).map((row) => [
      normalizeText(row.name),
      { id: row.id, durationMinutes: row.duration_minutes },
    ]),
  );
  const unitRows = (unitsResponse.data ?? []).filter((row) => row.is_active);
  const unitByName = new Map(unitRows.map((row) => [normalizeText(row.name), row.id]));
  const defaultUnitId = unitRows.length === 1 ? unitRows[0].id : null;
  const defaultPriceByServiceId = new Map<string, number>();
  (servicePricesResponse.data ?? []).forEach((row) => {
    if (row.is_default && !defaultPriceByServiceId.has(row.service_id)) {
      defaultPriceByServiceId.set(row.service_id, row.amount_cents);
    }
  });

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const clientId = clientByName.get(normalizeText(row.clientName));
      if (!clientId) throw new Error(`Cliente não encontrado: ${row.clientName ?? "—"}`);

      const professionalId = professionalByName.get(normalizeText(row.professionalName));
      if (!professionalId) throw new Error(`Profissional não encontrado: ${row.professionalName ?? "—"}`);

      const service = serviceByName.get(normalizeText(row.serviceName));
      if (!service) throw new Error(`Serviço não encontrado: ${row.serviceName ?? "—"}`);

      const unitName = normalizeText(row.unitName);
      const unitId = unitName ? unitByName.get(unitName) : defaultUnitId;
      if (!unitId) {
        throw new Error(
          unitName
            ? `Unidade não encontrada: ${row.unitName ?? "—"}`
            : "Informe a unidade na planilha ou deixe apenas uma unidade ativa no tenant para importação guiada.",
        );
      }

      const startsAtRaw = row.startsAt;
      if (typeof startsAtRaw !== "string" || Number.isNaN(new Date(startsAtRaw).getTime())) {
        throw new Error(`Data/hora inválida: ${row.startsAt ?? "—"}`);
      }

      const durationMinutes =
        typeof row.durationMinutes === "number" && row.durationMinutes > 0
          ? Number(row.durationMinutes)
          : service.durationMinutes;
      if (!durationMinutes || durationMinutes <= 0) {
        throw new Error("Não foi possível determinar a duração do agendamento.");
      }

      const startsAt = new Date(startsAtRaw);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000).toISOString();
      const totalPriceCents =
        typeof row.priceCents === "number"
          ? Math.round(Number(row.priceCents) * 100)
          : defaultPriceByServiceId.get(service.id) ?? 0;

      await insertAppointment({
        tenantId: ctx.tenantId,
        unitId,
        clientId,
        professionalId,
        serviceId: service.id,
        startsAt: startsAt.toISOString(),
        endsAt,
        durationMinutes,
        source: ((row.source as AppointmentSource | null) ?? "frontdesk"),
        status: ((row.status as AppointmentStatus | null) ?? "pending"),
        notes: (row.notes as string) ?? null,
        totalPriceCents,
        itemPriceCents: totalPriceCents,
        createdBy: ctx.createdBy ?? null,
      });

      result.inserted += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        rowIndex: index,
        message: error instanceof Error ? error.message : "Erro inesperado ao importar agendamento.",
      });
    }
  }

  return result;
}
