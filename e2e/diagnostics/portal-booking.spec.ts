import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import { getDestructiveE2ESkipReason } from "../_helpers/qaTarget";

type PreparedPortalData = {
  tenantId: string;
  unitId: string;
  professionalId: string;
  serviceId: string;
  clientId: string;
  clientUserId: string;
  day: string;
  weekday: number;
  previousBusinessHour:
    | {
        id: string;
        opens_at: string;
        closes_at: string;
        is_closed: boolean;
      }
    | null;
  availabilityId: string;
  marker: string;
};

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function env(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

async function createSignedInSupabase() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const supabaseUrl = env("VITE_SUPABASE_URL");
  const publishableKey = env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const email = env("E2E_USER");
  const password = env("E2E_PASS");

  if (!supabaseUrl || !publishableKey || !email || !password) {
    throw new Error(
      "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_USER e E2E_PASS são obrigatórios.",
    );
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("Login E2E não retornou usuário.");
  return { supabase, userId: data.user.id, email };
}

function futureBusinessDay(daysAhead = 14) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(12, 0, 0, 0);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  if (date.getDay() === 6) date.setDate(date.getDate() + 2);
  return {
    day: date.toISOString().slice(0, 10),
    weekday: date.getDay(),
  };
}

async function preparePortalData(
  supabase: SupabaseClient,
  userId: string,
): Promise<PreparedPortalData> {
  const marker = `portal-booking-${Date.now()}`;
  const { day, weekday } = futureBusinessDay();

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();
  if (membershipError) throw membershipError;
  const tenantId = membership.tenant_id as string;

  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .single();
  if (unitError) throw unitError;
  const unitId = unit.id as string;

  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .single();
  if (professionalError) throw professionalError;
  const professionalId = professional.id as string;

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      full_name: `E2E Portal Cliente ${marker}`,
      email: `portal.client.${marker}@cativa.test`,
      phone: "85988887777",
      preferred_unit_id: unitId,
      preferred_professional_id: professionalId,
    })
    .select("id")
    .single();
  if (clientError) throw clientError;
  const clientId = client.id as string;

  const { data: clientUser, error: clientUserError } = await supabase
    .from("client_users")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      user_id: userId,
      status: "active",
      booking_origin: "public_link",
    })
    .select("id")
    .single();
  if (clientUserError) throw clientUserError;
  const clientUserId = clientUser.id as string;

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .insert({
      tenant_id: tenantId,
      name: `E2E Serviço Portal ${marker}`,
      description: "Serviço criado pelo E2E para validar autoagendamento.",
      duration_minutes: 30,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      min_advance_hours: 0,
      max_advance_days: 60,
      is_active: true,
      is_featured: true,
      position: 0,
    })
    .select("id")
    .single();
  if (serviceError) throw serviceError;
  const serviceId = service.id as string;

  await supabase.from("service_prices").insert({
    tenant_id: tenantId,
    service_id: serviceId,
    amount_cents: 10000,
    currency: "BRL",
    is_default: true,
  });

  const { data: previousBusinessHour } = await supabase
    .from("unit_business_hours")
    .select("id, opens_at, closes_at, is_closed")
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .eq("weekday", weekday)
    .maybeSingle();

  const businessHourPayload = {
    tenant_id: tenantId,
    unit_id: unitId,
    weekday,
    opens_at: "09:00",
    closes_at: "17:00",
    is_closed: false,
  };
  const { error: businessHourError } = previousBusinessHour
    ? await supabase
        .from("unit_business_hours")
        .update(businessHourPayload)
        .eq("id", previousBusinessHour.id)
    : await supabase.from("unit_business_hours").insert(businessHourPayload);
  if (businessHourError) throw businessHourError;

  const { data: availability, error: availabilityError } = await supabase
    .from("professional_availability")
    .insert({
      tenant_id: tenantId,
      professional_id: professionalId,
      unit_id: unitId,
      weekday,
      starts_at: "09:00",
      ends_at: "17:00",
      is_active: true,
    })
    .select("id")
    .single();
  if (availabilityError) throw availabilityError;

  return {
    tenantId,
    unitId,
    professionalId,
    serviceId,
    clientId,
    clientUserId,
    day,
    weekday,
    previousBusinessHour: previousBusinessHour ?? null,
    availabilityId: availability.id as string,
    marker,
  };
}

async function cleanupPortalData(
  supabase: SupabaseClient,
  data: PreparedPortalData | null,
) {
  if (!data) return;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id")
    .eq("tenant_id", data.tenantId)
    .eq("client_id", data.clientId);
  const appointmentIds = (appointments ?? []).map((appointment) => appointment.id);
  if (appointmentIds.length > 0) {
    await supabase.from("appointment_items").delete().in("appointment_id", appointmentIds);
    await supabase.from("appointment_status_history").delete().in("appointment_id", appointmentIds);
    await supabase.from("appointments").delete().in("id", appointmentIds);
  }

  await supabase.from("client_users").delete().eq("id", data.clientUserId);
  await supabase.from("client_timeline_events").delete().eq("client_id", data.clientId);
  await supabase.from("clients").delete().eq("id", data.clientId);
  await supabase.from("professional_availability").delete().eq("id", data.availabilityId);
  await supabase.from("service_prices").delete().eq("service_id", data.serviceId);
  await supabase.from("services").delete().eq("id", data.serviceId);

  if (data.previousBusinessHour) {
    await supabase
      .from("unit_business_hours")
      .update({
        opens_at: data.previousBusinessHour.opens_at,
        closes_at: data.previousBusinessHour.closes_at,
        is_closed: data.previousBusinessHour.is_closed,
      })
      .eq("id", data.previousBusinessHour.id);
  } else {
    await supabase
      .from("unit_business_hours")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("unit_id", data.unitId)
      .eq("weekday", data.weekday);
  }
}

async function cleanupPortalLeaks(supabase: SupabaseClient) {
  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .like("full_name", "E2E Portal Cliente%");
  const clientIds = (clients ?? []).map((client) => client.id);
  if (clientIds.length > 0) {
    const { data: appointments } = await supabase
      .from("appointments")
      .select("id")
      .in("client_id", clientIds);
    const appointmentIds = (appointments ?? []).map((appointment) => appointment.id);
    if (appointmentIds.length > 0) {
      await supabase.from("appointment_items").delete().in("appointment_id", appointmentIds);
      await supabase
        .from("appointment_status_history")
        .delete()
        .in("appointment_id", appointmentIds);
      await supabase.from("appointments").delete().in("id", appointmentIds);
    }
    await supabase.from("client_users").delete().in("client_id", clientIds);
    await supabase.from("client_timeline_events").delete().in("client_id", clientIds);
    await supabase.from("clients").delete().in("id", clientIds);
  }

  const { data: services } = await supabase
    .from("services")
    .select("id")
    .like("name", "E2E Serviço Portal%");
  const serviceIds = (services ?? []).map((service) => service.id);
  if (serviceIds.length > 0) {
    await supabase.from("service_prices").delete().in("service_id", serviceIds);
    await supabase.from("appointment_items").delete().in("service_id", serviceIds);
    await supabase.from("services").delete().in("id", serviceIds);
  }
}

test.describe("portal booking", () => {
  test.describe.configure({ timeout: 150_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);
  const qaTargetSkipReason = getDestructiveE2ESkipReason();
  test.skip(Boolean(qaTargetSkipReason), qaTargetSkipReason ?? "");

  test("cria autoagendamento pelo portal com vínculo real de cliente", async ({ page }) => {
    const { supabase, userId } = await createSignedInSupabase();
    let prepared: PreparedPortalData | null = null;

    try {
      await cleanupPortalLeaks(supabase);
      prepared = await preparePortalData(supabase, userId);

      await page.addInitScript((tenantId) => {
        window.localStorage.setItem("cativa.portal.tenantId", tenantId);
      }, prepared.tenantId);

      await page.goto(`/portal/agendar?date=${prepared.day}`, {
        waitUntil: "commit",
        timeout: 15_000,
      });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});

      await page.getByTestId("portal-service-option").first().click();
      await page.getByTestId("portal-professional-option").first().click();

      const slot = page.getByTestId("portal-slot-option").first();
      await expect(slot).toBeVisible({ timeout: 45_000 });
      await slot.click();
      await page.getByTestId("portal-slot-continue").click();

      await expect(page.getByText("Confirme seu agendamento")).toBeVisible({
        timeout: 20_000,
      });
      await page.getByTestId("portal-booking-submit").click();

      await expect(page.getByText("Agendamento solicitado!", { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("appointments")
              .select("id, status, source")
              .eq("tenant_id", prepared!.tenantId)
              .eq("client_id", prepared!.clientId)
              .eq("source", "client_portal")
              .maybeSingle();
            return data ? `${data.status}:${data.source}` : "";
          },
          { timeout: 30_000 },
        )
        .toBe("pending:client_portal");
    } finally {
      await cleanupPortalData(supabase, prepared);
      await cleanupPortalLeaks(supabase);
      await supabase.auth.signOut();
    }
  });
});
