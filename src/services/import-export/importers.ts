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

export interface ImportRunResult {
  inserted: number;
  failed: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

const CHUNK = 100;

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
  // Importação básica de profissionais — vinculação a auth.users é manual depois.
  const payload = rows.map((r) => ({
    tenant_id: ctx.tenantId,
    full_name: String(r.fullName ?? "").trim(),
    display_name: (r.displayName as string) || null,
    email: (r.email as string) || null,
    phone: (r.phone as string) || null,
    specialty: (r.specialty as string) || null,
    commission_pct: r.commissionPct ? Number(r.commissionPct) : 0,
    is_active: true,
  }));
  return insertChunked("professionals", payload);
}
