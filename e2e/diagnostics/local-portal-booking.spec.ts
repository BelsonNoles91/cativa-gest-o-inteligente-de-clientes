import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { getDestructiveE2ESkipReason } from "../_helpers/qaTarget";

function env(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

const SUPABASE_URL = env("VITE_SUPABASE_URL");
const PUBLISHABLE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const OWNER_EMAIL = env("E2E_USER");
const OWNER_PASSWORD = env("E2E_PASS");
const CLIENT_EMAIL = env("E2E_CLIENT_USER");
const CLIENT_PASSWORD = env("E2E_CLIENT_PASS");
const HAS_LOCAL_CLIENT_FIXTURE = Boolean(
  SUPABASE_URL &&
    PUBLISHABLE_KEY &&
    OWNER_EMAIL &&
    OWNER_PASSWORD &&
    CLIENT_EMAIL &&
    CLIENT_PASSWORD,
);

async function cleanupBooking(
  tenantId: string,
  clientId: string,
  startsAt: string | null,
) {
  if (!tenantId || !clientId || !startsAt) return;
  const owner = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error: loginError } = await owner.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (loginError) {
    throw new Error(`Login do owner para limpeza QA falhou: ${loginError.message}`);
  }

  try {
    const { data: appointments, error } = await owner
      .from("appointments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .eq("source", "client_portal")
      .eq("starts_at", startsAt);
    if (error) throw new Error(`Localizar agendamento QA para limpeza: ${error.message}`);
    const appointmentIds = (appointments ?? []).map(({ id }) => id);
    if (appointmentIds.length === 0) return;

    for (const table of [
      "confirmation_queue",
      "appointment_items",
      "appointment_status_history",
    ] as const) {
      const { error: deleteError } = await owner
        .from(table)
        .delete()
        .in("appointment_id", appointmentIds);
      if (deleteError) {
        throw new Error(`Limpar ${table} do agendamento QA: ${deleteError.message}`);
      }
    }
    const { error: deleteError } = await owner
      .from("appointments")
      .delete()
      .in("id", appointmentIds);
    if (deleteError) {
      throw new Error(`Remover agendamento sintético QA: ${deleteError.message}`);
    }
  } finally {
    await owner.auth.signOut();
  }
}

function addDaysAsDateKey(daysAhead: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

test.describe("jornada local do cliente no portal", () => {
  test.describe.configure({ timeout: 150_000 });

  const targetSkipReason = getDestructiveE2ESkipReason();
  test.skip(
    Boolean(targetSkipReason),
    targetSkipReason ?? "Alvo QA local não autorizado.",
  );
  test.skip(
    !HAS_LOCAL_CLIENT_FIXTURE,
    "As credenciais do cliente sintético local não foram provisionadas.",
  );

  test("cliente agenda um serviço e o registro respeita seu tenant", async ({
    page,
  }) => {
    const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data: auth, error: authError } =
      await supabase.auth.signInWithPassword({
        email: CLIENT_EMAIL,
        password: CLIENT_PASSWORD,
      });
    if (authError || !auth.session || !auth.user) {
      throw new Error(
        `Login do cliente QA falhou: ${authError?.message ?? "sessão ausente"}`,
      );
    }

    let bookingTenantId = "";
    let bookingClientId = "";
    let bookingStartsAt: string | null = null;

    try {
      const { data: link, error: linkError } = await supabase
        .from("client_users")
        .select("tenant_id, client_id")
        .eq("user_id", auth.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (linkError || !link) {
        throw new Error(
          `Vínculo do cliente QA não está ativo: ${linkError?.message ?? "ausente"}`,
        );
      }
      bookingTenantId = link.tenant_id;
      bookingClientId = link.client_id;

      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("id, duration_minutes")
        .eq("tenant_id", link.tenant_id)
        .eq("internal_code", "QA-PORTAL-LOCAL")
        .eq("is_active", true)
        .eq("is_public", true)
        .single();
      if (serviceError || !service) {
        throw new Error(
          `Serviço público sintético não está disponível: ${serviceError?.message ?? "ausente"}`,
        );
      }

      const { data: client } = await supabase
        .from("clients")
        .select("preferred_unit_id")
        .eq("id", link.client_id)
        .single();
      if (!client?.preferred_unit_id) {
        throw new Error(
          "O cliente sintético precisa ter uma unidade preferencial para agendar.",
        );
      }

      const { data: professional, error: professionalError } = await supabase
        .from("professionals")
        .select("id")
        .eq("tenant_id", link.tenant_id)
        .eq("unit_id", client.preferred_unit_id)
        .eq("display_name", "Profissional QA Local")
        .eq("is_active", true)
        .single();
      if (professionalError || !professional) {
        throw new Error(
          `Profissional sintético não está disponível: ${professionalError?.message ?? "ausente"}`,
        );
      }

      const day = addDaysAsDateKey(7);
      await page.addInitScript(
        ({ session, user, tenantId, storageKey }) => {
          window.localStorage.clear();
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({ ...session, user, weak_password: null }),
          );
          window.localStorage.setItem("cativa.portal.tenantId", tenantId);
        },
        {
          session: auth.session,
          user: auth.user,
          tenantId: link.tenant_id,
          storageKey: `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`,
        },
      );

      await page.goto(`/portal/agendar?date=${day}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      const serviceOption = page
        .getByTestId("portal-service-option")
        .filter({ hasText: "Serviço QA Portal Local" });
      await expect(serviceOption).toBeVisible({ timeout: 30_000 });
      await serviceOption.click();

      const professionalOption = page
        .getByTestId("portal-professional-option")
        .filter({ hasText: "Profissional QA Local" });
      await expect(professionalOption).toBeVisible({ timeout: 20_000 });
      await professionalOption.click();

      const slot = page.getByTestId("portal-slot-option").first();
      await expect(slot).toBeVisible({ timeout: 45_000 });
      const startsAt = await slot.getAttribute("data-slot-start");
      expect(
        startsAt,
        "O horário selecionável precisa expor o instante usado pelo backend.",
      ).toBeTruthy();
      bookingStartsAt = startsAt!;
      await slot.click();
      await page.getByTestId("portal-slot-continue").click();
      await expect(page.getByText("Confirme seu agendamento")).toBeVisible({
        timeout: 20_000,
      });
      await page.getByTestId("portal-booking-submit").click();
      await expect(
        page.getByText("Agendamento solicitado!", { exact: true }),
      ).toBeVisible({
        timeout: 30_000,
      });

      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select(
          "id, tenant_id, unit_id, client_id, professional_id, starts_at, duration_minutes, status, source",
        )
        .eq("tenant_id", link.tenant_id)
        .eq("client_id", link.client_id)
        .eq("source", "client_portal")
        .eq("starts_at", startsAt!)
        .maybeSingle();
      if (appointmentError || !appointment) {
        throw new Error(
          `O agendamento não foi persistido para o cliente: ${appointmentError?.message ?? "ausente"}`,
        );
      }

      expect(appointment).toMatchObject({
        tenant_id: link.tenant_id,
        unit_id: client.preferred_unit_id,
        client_id: link.client_id,
        professional_id: professional.id,
        starts_at: startsAt,
        duration_minutes: service.duration_minutes,
        status: "pending",
        source: "client_portal",
      });

      const { data: item, error: itemError } = await supabase
        .from("appointment_items")
        .select("service_id, duration_minutes")
        .eq("appointment_id", appointment.id)
        .single();
      if (itemError || !item) {
        throw new Error(
          `O serviço não foi vinculado ao agendamento: ${itemError?.message ?? "ausente"}`,
        );
      }
      expect(item).toEqual({
        service_id: service.id,
        duration_minutes: service.duration_minutes,
      });
    } finally {
      try {
        await cleanupBooking(bookingTenantId, bookingClientId, bookingStartsAt);
      } finally {
        await supabase.auth.signOut();
      }
    }
  });
});
