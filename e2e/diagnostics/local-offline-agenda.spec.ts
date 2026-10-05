import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { getDestructiveE2ESkipReason } from "../_helpers/qaTarget";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() ?? "";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const OWNER_EMAIL = process.env.E2E_USER?.trim() ?? "";
const OWNER_PASSWORD = process.env.E2E_PASS?.trim() ?? "";
const TENANT_SLUG = process.env.E2E_TENANT_SLUG?.trim() ?? "";
const TARGET_SKIP_REASON = getDestructiveE2ESkipReason();

type PartialFixture = {
  owner: SupabaseClient;
  admin: SupabaseClient;
  tenantId: string;
  appointmentId?: string;
  secondAppointmentId?: string;
  clientId?: string;
};

type OfflineFixture = PartialFixture & {
  appointmentId: string;
  clientId: string;
  clientName: string;
  localDate: string;
};

let fixture: OfflineFixture | null = null;
const webkitOfflineContexts = new WeakSet<BrowserContext>();

test.skip(Boolean(TARGET_SKIP_REASON), TARGET_SKIP_REASON ?? "Alvo QA local não autorizado.");
test.skip(
  process.env.E2E_LOCAL_SUPABASE !== "true",
  "A jornada offline com limpeza privilegiada só roda no Supabase local descartável.",
);
test.skip(
  !SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_ROLE_KEY || !OWNER_EMAIL || !OWNER_PASSWORD || !TENANT_SLUG,
  "Configuração Supabase local ou credenciais sintéticas de owner/service role ausentes.",
);

function newClient(key: string) {
  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function ensure<T>(data: T | null, error: { message: string } | null, action: string): T {
  if (error) throw new Error(`${action}: ${error.message}`);
  if (data === null) throw new Error(`${action}: resposta vazia.`);
  return data;
}

function dateKeyInZone(timeZone: string, offsetDays: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays),
  )
    .toISOString()
    .slice(0, 10);
}

function dateKeyForInstant(instant: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function cleanup(current: PartialFixture) {
  const appointmentIds = [...new Set([current.appointmentId, current.secondAppointmentId].filter((id): id is string => Boolean(id)))];
  for (const appointmentId of appointmentIds) {
    for (const table of ["confirmation_queue", "appointment_items", "appointment_status_history"] as const) {
      const { error } = await current.admin.from(table).delete().eq("appointment_id", appointmentId);
      if (error) throw new Error(`Limpar ${table} da fixture offline: ${error.message}`);
    }
    const { error } = await current.admin.from("appointments").delete().eq("id", appointmentId);
    if (error) throw new Error(`Remover agendamento sintético offline: ${error.message}`);
  }
  if (current.clientId) {
    const { error } = await current.admin.from("clients").delete().eq("id", current.clientId);
    if (error) throw new Error(`Remover cliente sintético offline: ${error.message}`);
  }
}

async function appointmentStatus(current: OfflineFixture, appointmentId = current.appointmentId) {
  const result = await current.admin
    .from("appointments")
    .select("status")
    .eq("tenant_id", current.tenantId)
    .eq("id", appointmentId)
    .single();
  return ensure(result.data, result.error, "ler status do agendamento offline").status;
}

async function setWebkitOfflineSimulation(page: Page, context: BrowserContext) {
  if (process.platform !== "linux") {
    throw new Error("A simulação offline segura do WebKit exige o runner Linux isolado.");
  }
  const appOrigin = new URL(page.url()).origin;
  if (!webkitOfflineContexts.has(context)) {
    await context.route("**/*", (route) => {
      const requestOrigin = new URL(route.request().url()).origin;
      return requestOrigin === appOrigin
        ? route.continue()
        : route.abort("internetdisconnected");
    });
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
      const nativeFetch = window.fetch.bind(window);
      Reflect.set(window, "__cativaOnlineFetch", nativeFetch);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = input instanceof Request ? input.url : String(input);
        if (new URL(requestUrl, window.location.href).origin !== window.location.origin) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return nativeFetch(input, init);
      };
      window.dispatchEvent(new Event("offline"));
    });
    webkitOfflineContexts.add(context);
  }
  await page.evaluate(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    window.dispatchEvent(new Event("offline"));
  });
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
}

async function setPwaOffline(page: Page, context: BrowserContext, projectName: string) {
  if (projectName.includes("webkit")) {
    await setWebkitOfflineSimulation(page, context);
    return;
  }
  await context.setOffline(true);
}

async function setPwaOnline(page: Page, context: BrowserContext, projectName: string) {
  if (projectName.includes("webkit")) {
    await context.unroute("**/*");
    await page.evaluate(() => {
      const nativeFetch = Reflect.get(window, "__cativaOnlineFetch");
      if (typeof nativeFetch !== "function") {
        throw new Error("O fetch nativo não está disponível para reconectar o teste WebKit.");
      }
      window.fetch = nativeFetch as typeof window.fetch;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        get: () => true,
      });
      window.dispatchEvent(new Event("online"));
    });
    return;
  }
  await context.setOffline(false);
}

async function reloadOfflineWithServiceWorker(
  page: Page,
  projectName: string,
) {
  if (projectName.includes("webkit")) {
    // Playwright WebKit currently aborts even service-worker-fulfilled requests
    // when context.setOffline(true); see microsoft/playwright#42775. Keep the
    // browser online without emitting a spurious `online` event (which would
    // flush the offline queue), block cross-origin traffic, and stop only the
    // isolated Vite preview so navigation must come from the service-worker cache.
    if (process.platform !== "linux") {
      throw new Error("A pausa segura do preview WebKit exige o runner Linux isolado.");
    }
    const previewPid = Number(process.env.E2E_PWA_PREVIEW_PID);
    const previewOutDir = process.env.PW_PREVIEW_OUT_DIR?.trim();
    if (!Number.isSafeInteger(previewPid) || previewPid < 2 || !previewOutDir) {
      throw new Error("WebKit offline exige PID e diretório temporário do preview gerenciado pelo harness.");
    }
    let previewCommand = "";
    try {
      previewCommand = readFileSync(`/proc/${previewPid}/cmdline`, "utf8").replaceAll("\0", " ");
    } catch {
      throw new Error("O processo de preview WebKit não está acessível para validação segura.");
    }
    if (
      !previewCommand.includes(resolve("node_modules/vite/bin/vite.js")) ||
      !previewCommand.includes("preview") ||
      !previewCommand.includes(previewOutDir) ||
      !previewCommand.includes("4173")
    ) {
      throw new Error("O PID informado não corresponde ao preview Vite isolado esperado.");
    }

    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    process.kill(previewPid, "SIGSTOP");
    try {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
    } finally {
      process.kill(previewPid, "SIGCONT");
    }
    return;
  }

  await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
}

test.beforeEach(async () => {
  const owner = newClient(PUBLISHABLE_KEY);
  const admin = newClient(SERVICE_ROLE_KEY);
  const current: PartialFixture = { owner, admin, tenantId: "" };

  try {
    const authResult = await owner.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
    const auth = ensure(authResult.data, authResult.error, "autenticar owner QA");
    if (!auth.user?.id) throw new Error("Login owner QA não retornou usuário.");

    const membershipResult = await owner
      .from("tenant_memberships")
      .select("tenant_id, tenants!inner(slug)")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .eq("tenants.slug", TENANT_SLUG)
      .single();
    const membership = ensure(membershipResult.data, membershipResult.error, "resolver tenant do owner QA");
    current.tenantId = membership.tenant_id;

    const [tenantResult, professionalResult, serviceResult] = await Promise.all([
      admin.from("tenants").select("timezone").eq("id", current.tenantId).single(),
      admin
        .from("professionals")
        .select("id, unit_id")
        .eq("tenant_id", current.tenantId)
        .eq("display_name", "Profissional QA Local")
        .eq("is_active", true)
        .single(),
      admin
        .from("services")
        .select("id, duration_minutes")
        .eq("tenant_id", current.tenantId)
        .eq("internal_code", "E2E-CONFIRMATION")
        .eq("is_active", true)
        .single(),
    ]);
    const tenant = ensure(tenantResult.data, tenantResult.error, "buscar timezone QA");
    const professional = ensure(professionalResult.data, professionalResult.error, "buscar profissional QA");
    const service = ensure(serviceResult.data, serviceResult.error, "buscar serviço QA");
    const unitId = professional.unit_id as string | null;
    if (!unitId) throw new Error("O profissional QA precisa estar vinculado a uma unidade.");

    const timezone = tenant.timezone || "America/Sao_Paulo";
    let slots: Array<{ slot_start: string; slot_end: string }> = [];
    for (let offset = 3; offset <= 35 && slots.length < 2; offset += 1) {
      const day = dateKeyInZone(timezone, offset);
      const result = await admin.rpc("get_available_slots", {
        _tenant_id: current.tenantId,
        _professional_id: professional.id,
        _unit_id: unitId,
        _service_id: service.id,
        _day: day,
        _slot_step_minutes: 15,
      });
      const available = ensure(result.data as Array<{ slot_start: string; slot_end: string }> | null, result.error, "buscar horário QA");
      const firstSlot = available[0];
      const secondNonOverlappingSlot = firstSlot
        ? available.find((candidate) => Date.parse(candidate.slot_start) >= Date.parse(firstSlot.slot_end))
        : undefined;
      if (firstSlot && secondNonOverlappingSlot) slots = [firstSlot, secondNonOverlappingSlot];
    }
    if (slots.length < 2) throw new Error("Dois horários livres no mesmo dia são necessários para o teste de fila offline.");

    const clientName = `Cliente QA Offline ${randomUUID().slice(0, 8)}`;
    const clientResult = await admin
      .from("clients")
      .insert({
        tenant_id: current.tenantId,
        preferred_unit_id: unitId,
        full_name: clientName,
        email: `${randomUUID()}@cativa.test`,
        status: "active",
        origin: "e2e_local_offline",
        created_by: auth.user.id,
      })
      .select("id")
      .single();
    const client = ensure(clientResult.data, clientResult.error, "criar cliente sintético offline");
    current.clientId = client.id;

    const marker = `E2E_FIXTURE_OFFLINE_${randomUUID()}`;
    const createAppointment = async (slot: { slot_start: string; slot_end: string }) => {
      const appointmentResult = await admin.from("appointments").insert({
        tenant_id: current.tenantId,
        unit_id: unitId,
        client_id: client.id,
        professional_id: professional.id,
        starts_at: slot.slot_start,
        ends_at: slot.slot_end,
        duration_minutes: service.duration_minutes,
        status: "pending",
        source: "frontdesk",
        total_price_cents: 10000,
        internal_notes: marker,
        created_by: auth.user.id,
      })
      .select("id")
      .single();
      const appointment = ensure(appointmentResult.data, appointmentResult.error, "criar agendamento sintético offline");
      if (!current.appointmentId) current.appointmentId = appointment.id;
      else current.secondAppointmentId = appointment.id;
      const { error: itemError } = await admin.from("appointment_items").insert({
        tenant_id: current.tenantId,
        appointment_id: appointment.id,
        service_id: service.id,
        duration_minutes: service.duration_minutes,
        price_cents: 10000,
        position: 0,
      });
      if (itemError) throw new Error(`Vincular serviço ao agendamento offline: ${itemError.message}`);
      return appointment;
    };
    const appointment = await createAppointment(slots[0]);
    const secondAppointment = await createAppointment(slots[1]);

    fixture = {
      ...current,
      appointmentId: appointment.id,
      secondAppointmentId: secondAppointment.id,
      clientId: client.id,
      clientName,
      localDate: dateKeyForInstant(slots[0].slot_start, timezone),
    };
  } catch (error) {
    try {
      if (current.tenantId) await cleanup(current);
    } finally {
      await owner.auth.signOut();
    }
    throw error;
  }
});

test.afterEach(async ({ context, page }) => {
  await context.setOffline(false).catch(() => undefined);
  await page.evaluate(() => localStorage.removeItem("cativa:agenda-queue")).catch(() => undefined);
  const current = fixture;
  fixture = null;
  if (!current) return;
  try {
    await cleanup(current);
  } finally {
    await current.owner.auth.signOut();
  }
});

test("guarda ação sem PII, preserva fila após HTTP 503 e sincroniza no retry", async ({ page, context }) => {
  const current = fixture;
  if (!current) throw new Error("Fixture local do teste offline não foi preparada.");

  await page.goto(`/app/agenda?date=${current.localDate}`, { waitUntil: "domcontentloaded" });
  const card = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.appointmentId}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Pendente");

  await context.setOffline(true);
  await expect(page.getByText("Modo offline", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(card).toContainText("Confirmado");
  await expect(page.getByText("1 ação pendente será enviada quando a conexão voltar.", { exact: true })).toBeVisible();
  expect(await appointmentStatus(current), "o servidor não pode receber a ação enquanto o browser está offline").toBe("pending");

  const queuedJson = await page.evaluate(() => localStorage.getItem("cativa:agenda-queue"));
  expect(queuedJson).toBeTruthy();
  expect(queuedJson).not.toContain(current.clientName);
  const queued = JSON.parse(queuedJson!) as Array<{ tenantId: string; appointmentId: string; type: string; status: string }>;
  expect(queued).toHaveLength(1);
  expect(queued[0]).toMatchObject({
    tenantId: current.tenantId,
    appointmentId: current.appointmentId,
    type: "status",
    status: "confirmed",
  });

  let blockedMutations = 0;
  const failAppointmentPatch = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "PATCH") {
      blockedMutations += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "QA_TEMPORARY_OUTAGE", message: "Falha transitória injetada no teste." }),
      });
      return;
    }
    await route.continue();
  };
  await page.route("**/rest/v1/appointments**", failAppointmentPatch);
  await context.setOffline(false);
  await expect(page.getByText("Ações aguardando envio", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => blockedMutations, { timeout: 10_000 }).toBe(1);
  await expect.poll(() => appointmentStatus(current), { timeout: 10_000 }).toBe("pending");
  await expect(page.getByRole("button", { name: "Sincronizar agora", exact: true })).toBeEnabled();

  await page.unroute("**/rest/v1/appointments**", failAppointmentPatch);
  await page.getByRole("button", { name: "Sincronizar agora", exact: true }).click();
  await expect.poll(() => appointmentStatus(current), { timeout: 20_000 }).toBe("confirmed");
  await expect.poll(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("cativa:agenda-queue"));
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  }, { timeout: 10_000 }).toBe(0);
  await expect(page.getByText("Ações aguardando envio", { exact: true })).toHaveCount(0);
  await expect(card).toContainText("Confirmado");
});

test("preserva fila mista em reconexões repetidas e sincroniza cada atendimento uma vez", async ({ page, context }) => {
  const current = fixture;
  if (!current?.secondAppointmentId) throw new Error("A fixture offline exige dois atendimentos QA.");

  await page.goto(`/app/agenda?date=${current.localDate}`, { waitUntil: "domcontentloaded" });
  const firstCard = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.appointmentId}"]`);
  const secondCard = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.secondAppointmentId}"]`);
  await expect(firstCard).toBeVisible({ timeout: 30_000 });
  await expect(secondCard).toBeVisible({ timeout: 30_000 });

  const requestsByAppointment = new Map<string, number>();
  page.on("request", (request) => {
    if (request.method() !== "PATCH" || !new URL(request.url()).pathname.endsWith("/rest/v1/appointments")) return;
    const id = new URL(request.url()).searchParams.get("id")?.replace(/^eq\./, "");
    if (id) requestsByAppointment.set(id, (requestsByAppointment.get(id) ?? 0) + 1);
  });

  await context.setOffline(true);
  await expect(page.getByText("Modo offline", { exact: true })).toBeVisible();
  await firstCard.getByRole("button", { name: "Confirmar", exact: true }).click();
  await secondCard.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByText("2 ações pendentes serão enviadas quando a conexão voltar.", { exact: true })).toBeVisible();
  expect(await appointmentStatus(current)).toBe("pending");
  expect(await appointmentStatus(current, current.secondAppointmentId)).toBe("pending");

  let blockedMutations = 0;
  const failAppointmentPatch = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "PATCH") {
      blockedMutations += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "QA_TEMPORARY_OUTAGE", message: "Falha transitória injetada no teste." }),
      });
      return;
    }
    await route.continue();
  };
  await page.route("**/rest/v1/appointments**", failAppointmentPatch);

  await context.setOffline(false);
  await expect.poll(() => blockedMutations, { timeout: 10_000 }).toBe(1);
  await expect(page.getByRole("button", { name: "Sincronizar agora", exact: true })).toBeEnabled();

  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine), { timeout: 5_000 }).toBe(false);
  await expect.poll(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("cativa:agenda-queue"));
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  }).toBe(2);
  expect(await appointmentStatus(current)).toBe("pending");
  expect(await appointmentStatus(current, current.secondAppointmentId)).toBe("pending");

  await context.setOffline(false);
  await expect.poll(() => blockedMutations, { timeout: 10_000 }).toBe(2);
  await expect(page.getByRole("button", { name: "Sincronizar agora", exact: true })).toBeEnabled();
  await expect.poll(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("cativa:agenda-queue"));
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  }).toBe(2);

  await page.unroute("**/rest/v1/appointments**", failAppointmentPatch);
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine), { timeout: 5_000 }).toBe(false);
  await context.setOffline(false);

  await expect.poll(async () => Promise.all([
    appointmentStatus(current),
    appointmentStatus(current, current.secondAppointmentId),
  ]), { timeout: 20_000 }).toEqual(["confirmed", "canceled"]);
  await expect.poll(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("cativa:agenda-queue"));
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  }, { timeout: 10_000 }).toBe(0);
  expect(requestsByAppointment.get(current.appointmentId)).toBe(3);
  expect(requestsByAppointment.get(current.secondAppointmentId)).toBe(1);
  await expect(firstCard).toContainText("Confirmado");
  await expect(secondCard).toContainText("Cancelado");
});

test("mantém ação pendente após HTTP 429 e conclui no retry manual após Retry-After", async ({ page, context }) => {
  const current = fixture;
  if (!current) throw new Error("Fixture local do teste de rate limit offline não foi preparada.");

  await page.goto(`/app/agenda?date=${current.localDate}`, { waitUntil: "domcontentloaded" });
  const card = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.appointmentId}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });

  const appointmentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname.endsWith("/rest/v1/appointments")) {
      appointmentRequests.push(request.url());
    }
  });
  await context.setOffline(true);
  await card.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("1 ação pendente será enviada quando a conexão voltar.", { exact: true })).toBeVisible();
  expect(await appointmentStatus(current), "o servidor não recebe a confirmação enquanto offline").toBe("pending");

  let throttledRequests = 0;
  const throttleAppointmentPatch = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "PATCH") {
      throttledRequests += 1;
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "1" },
        contentType: "application/json",
        body: JSON.stringify({ code: "QA_RATE_LIMIT", message: "Limite transitório injetado no teste." }),
      });
      return;
    }
    await route.continue();
  };
  await page.route("**/rest/v1/appointments**", throttleAppointmentPatch);
  await context.setOffline(false);
  await expect.poll(() => throttledRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByRole("button", { name: "Sincronizar agora", exact: true })).toBeEnabled();
  await expect.poll(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("cativa:agenda-queue"));
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  }).toBe(1);
  expect(await appointmentStatus(current), "429 não deve remover nem aplicar a ação pendente").toBe("pending");

  await page.unroute("**/rest/v1/appointments**", throttleAppointmentPatch);
  await page.waitForTimeout(1_050);
  await page.getByRole("button", { name: "Sincronizar agora", exact: true }).click();
  await expect.poll(() => appointmentStatus(current), { timeout: 20_000 }).toBe("confirmed");
  await expect.poll(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("cativa:agenda-queue"));
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  }, { timeout: 10_000 }).toBe(0);
  expect(appointmentRequests).toHaveLength(2);
  await expect(card).toContainText("Confirmado");
});

test("preserva a fila após falhas HTTP e de transporte até o servidor voltar", async ({ page, context }) => {
  const current = fixture;
  if (!current) throw new Error("Fixture local da matriz de falhas offline não foi preparada.");

  await page.goto(`/app/agenda?date=${current.localDate}`, { waitUntil: "domcontentloaded" });
  const card = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.appointmentId}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await card.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("1 ação pendente será enviada quando a conexão voltar.", { exact: true })).toBeVisible();

  const failures: Array<{ status: number } | { abort: true }> = [
    { status: 401 },
    { status: 403 },
    { status: 409 },
    { status: 422 },
    { status: 500 },
    { status: 503 },
    { abort: true },
  ];
  let failureIndex = 0;
  let appointmentRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname.endsWith("/rest/v1/appointments")) {
      appointmentRequests += 1;
    }
  });
  const failAppointmentPatch = async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    const fault = failures[failureIndex++];
    if (!fault) {
      await route.continue();
      return;
    }
    if ("abort" in fault) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: fault.status,
      headers: fault.status === 429 ? { "Retry-After": "0" } : undefined,
      contentType: "application/json",
      body: JSON.stringify({ code: `QA_HTTP_${fault.status}`, message: "Falha injetada na matriz offline." }),
    });
  };
  await page.route("**/rest/v1/appointments**", failAppointmentPatch);
  await context.setOffline(false);

  const queueSizeInBrowser = async () => page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("cativa:agenda-queue") ?? "[]").length as number;
    } catch {
      return -1;
    }
  });
  const retryButton = page.getByRole("button", { name: "Sincronizar agora", exact: true });
  for (let index = 0; index < failures.length; index += 1) {
    await expect.poll(() => failureIndex, { timeout: 10_000 }).toBe(index + 1);
    await expect(retryButton).toBeEnabled({ timeout: 10_000 });
    await expect.poll(queueSizeInBrowser).toBe(1);
    expect(await appointmentStatus(current), `a falha ${index + 1} não deve alterar o servidor`).toBe("pending");
    if (index < failures.length - 1) await retryButton.click();
  }

  await page.unroute("**/rest/v1/appointments**", failAppointmentPatch);
  await retryButton.click();
  await expect.poll(() => appointmentStatus(current), { timeout: 20_000 }).toBe("confirmed");
  await expect.poll(queueSizeInBrowser, { timeout: 10_000 }).toBe(0);
  expect(failureIndex).toBe(failures.length);
  expect(appointmentRequests).toBe(failures.length + 1);
  await expect(card).toContainText("Confirmado");
});

test("reflete na agenda a alteração confirmada por outra sessão via Supabase Realtime", async ({ page }) => {
  const current = fixture;
  if (!current) throw new Error("Fixture local do teste Realtime não foi preparada.");

  const topic = `realtime:tenant-sync-${current.tenantId}`;
  let subscribed = false;
  let subscriptionFailure = "";
  let realtimeEventCount = 0;
  const websocketPaths: string[] = [];
  const realtimeFrames: string[] = [];
  page.on("websocket", (socket) => {
    const path = new URL(socket.url()).pathname;
    websocketPaths.push(path);
    if (!path.endsWith("/realtime/v1/websocket")) return;
    socket.on("framereceived", ({ payload }) => {
      const frame = typeof payload === "string" ? payload : payload.toString();
      try {
        const wireMessage = JSON.parse(frame) as unknown;
        const message = Array.isArray(wireMessage)
          ? { topic: wireMessage[2], event: wireMessage[3], payload: wireMessage[4] }
          : wireMessage as { topic?: unknown; event?: unknown; payload?: unknown };
        const messageTopic = typeof message.topic === "string" ? message.topic : "?";
        const messageEvent = typeof message.event === "string" ? message.event : "?";
        const messagePayload = typeof message.payload === "object" && message.payload !== null
          ? message.payload as { status?: unknown }
          : {};
        const status = typeof messagePayload.status === "string" ? messagePayload.status : "";
        realtimeFrames.push(`${messageTopic}:${messageEvent}:${status}`);
        if (messageTopic !== topic || messageEvent !== "phx_reply") return;
        if (status === "ok") subscribed = true;
        else subscriptionFailure = `ack Realtime ${status || "sem status"}`;
      } catch {
        realtimeFrames.push("frame-non-json");
        // Frames de heartbeat/protocolo que não são JSON de canal são ignorados.
      }
    });
  });

  await page.goto(`/app/agenda?date=${current.localDate}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.documentElement.dataset.qaRealtimeEventCount = "0";
    window.addEventListener("cativa:realtime", () => {
      const currentCount = Number(document.documentElement.dataset.qaRealtimeEventCount ?? 0);
      document.documentElement.dataset.qaRealtimeEventCount = String(currentCount + 1);
    });
  });
  const card = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.appointmentId}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Pendente");
  try {
    await expect.poll(
      () => subscribed,
      { timeout: 15_000, message: `Canal ${topic} não confirmou a assinatura Realtime.` },
    ).toBe(true);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
        `Diagnóstico Realtime: ${JSON.stringify({ websocketPaths, realtimeFrames, subscriptionFailure })}`,
    );
  }

  const update = await current.admin
    .from("appointments")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("tenant_id", current.tenantId)
    .eq("id", current.appointmentId)
    .select("id")
    .single();
  ensure(update.data, update.error, "alterar agendamento pela segunda sessão QA");

  try {
    await expect(card).toContainText("Confirmado", { timeout: 15_000 });
  } catch (error) {
    realtimeEventCount = await page.evaluate(() => Number(document.documentElement.dataset.qaRealtimeEventCount ?? 0));
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
        `Diagnóstico do evento: ${JSON.stringify({
          websocketPaths,
          realtimeFrames,
          subscriptionFailure,
          realtimeEventCount,
          visibleStatus: await card.locator("[data-testid='appointment-status']").textContent().catch(() => null),
        })}`,
    );
  }
  realtimeEventCount = await page.evaluate(() => Number(document.documentElement.dataset.qaRealtimeEventCount ?? 0));
  expect(realtimeEventCount, "a mudança deve chegar pelo evento local disparado pelo Supabase Realtime").toBeGreaterThan(0);
  expect(await appointmentStatus(current)).toBe("confirmed");
});

test("recarrega snapshot e ação pendente offline perto do limite de 24 horas", async ({ page, context }, testInfo) => {
  const current = fixture;
  if (!current) throw new Error("Fixture local do teste PWA offline não foi preparada.");

  await page.goto(`/app/agenda?date=${current.localDate}`, { waitUntil: "domcontentloaded" });
  const card = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.appointmentId}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Pendente");
  const agendaState = page.getByTestId("agenda-page");
  await expect(agendaState).toHaveAttribute("data-online", "true");
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker?.controller),
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
  await expect(agendaState).toHaveAttribute("data-online", "true");

  const hasAgendaSnapshot = await page.evaluate((appointmentId) =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("cativa:agenda-cache:"))
      .some((key) => {
        try {
          const entry = JSON.parse(localStorage.getItem(key) ?? "null") as {
            data?: Array<{ appointment?: { id?: string } }>;
          } | null;
          return entry?.data?.some((item) => item.appointment?.id === appointmentId) ?? false;
        } catch {
          return false;
        }
      }),
    current.appointmentId,
  );
  expect(hasAgendaSnapshot, "o snapshot deve conter o agendamento sintético do período/tenant atual").toBe(true);

  await setPwaOffline(page, context, testInfo.project.name);
  await expect.poll(() => page.evaluate(() => navigator.onLine), { timeout: 5_000 }).toBe(false);
  await expect(agendaState).toHaveAttribute("data-online", "false", { timeout: 5_000 });
  await card.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(card).toContainText("Confirmado");
  await expect(page.getByText("1 ação pendente será enviada quando a conexão voltar.", { exact: true })).toBeVisible();

  const contextNearExpiry = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith("cativa:offline-tenant-context:"));
    if (!key) return false;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null") as { savedAt?: string } | null;
      if (!value || typeof value.savedAt !== "string") return false;
      // Mantém 60 s de margem para tempo de gravação + navegação do Playwright,
      // sem deixar de validar a restauração imediatamente antes do limite.
      value.savedAt = new Date(Date.now() - 24 * 60 * 60 * 1000 + 60_000).toISOString();
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  });
  expect(contextNearExpiry, "o cenário deve avançar o contexto para 23h59m").toBe(true);
  await reloadOfflineWithServiceWorker(page, testInfo.project.name);
  await expect(agendaState).toBeVisible({ timeout: 10_000 });
  await expect(agendaState).toHaveAttribute("data-online", "false", { timeout: 10_000 });
  await expect(agendaState).toHaveAttribute("data-using-cache", "true", { timeout: 10_000 });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/TypeError:\s*Failed to fetch/i)).toHaveCount(0);

  const reloadDiagnostics = await page.evaluate(({ appointmentId, tenantId }) => ({
    online: navigator.onLine,
    controlledByWorker: Boolean(navigator.serviceWorker?.controller),
    agendaPageCount: document.querySelectorAll('[data-testid="agenda-page"]').length,
    cardCount: document.querySelectorAll(`[data-appointment-id="${appointmentId}"]`).length,
    appOnline: document.querySelector('[data-testid="agenda-page"]')?.getAttribute("data-online"),
    usingSnapshot: document.querySelector('[data-testid="agenda-page"]')?.getAttribute("data-using-cache"),
    queuedActionCount: (() => {
      try {
        return JSON.parse(localStorage.getItem("cativa:agenda-queue") ?? "[]").length as number;
      } catch {
        return -1;
      }
    })(),
    offlineBannerVisible: Array.from(document.querySelectorAll('[role="status"]')).some((element) =>
      element.textContent?.includes("Modo offline"),
    ),
    hasCachedAppointment: Object.keys(localStorage)
      .filter((key) => key.startsWith("cativa:agenda-cache:"))
      .some((key) => {
        try {
          const entry = JSON.parse(localStorage.getItem(key) ?? "null") as {
            data?: Array<{ appointment?: { id?: string } }>;
          } | null;
          return entry?.data?.some((item) => item.appointment?.id === appointmentId) ?? false;
        } catch {
          return false;
        }
      }),
    matchingCacheRanges: Object.keys(localStorage)
      .filter((key) => key.startsWith(`cativa:agenda-cache:${tenantId}:`))
      .filter((key) => {
        try {
          const entry = JSON.parse(localStorage.getItem(key) ?? "null") as {
            data?: Array<{ appointment?: { id?: string } }>;
          } | null;
          return entry?.data?.some((item) => item.appointment?.id === appointmentId) ?? false;
        } catch {
          return false;
        }
      })
      .map((key) => key.slice(`cativa:agenda-cache:${tenantId}:`.length)),
  }), { appointmentId: current.appointmentId, tenantId: current.tenantId });
  console.log(`Diagnóstico de reload offline: ${JSON.stringify(reloadDiagnostics)}`);
  await expect(page.getByText("Mostrando a agenda sincronizada em", { exact: false })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Modo offline", { exact: true })).toBeVisible();
  await expect(page.getByText("1 ação pendente será enviada quando a conexão voltar.", { exact: true })).toBeVisible();
  await expect(card).toContainText("Confirmado");
  expect(reloadDiagnostics.queuedActionCount).toBe(1);
  expect(await appointmentStatus(current), "a leitura offline não deve alterar o banco").toBe("pending");
});

test("nega a restauração offline quando o contexto de tenant ultrapassa 24 horas", async ({ page, context }, testInfo) => {
  const current = fixture;
  if (!current) throw new Error("Fixture local do teste de expiração offline não foi preparada.");

  await page.goto(`/app/agenda?date=${current.localDate}`, { waitUntil: "domcontentloaded" });
  const card = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.appointmentId}"]`);
  await expect(card).toBeVisible({ timeout: 30_000 });
  const cachedContext = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith("cativa:offline-tenant-context:"));
    if (!key) return false;
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as { savedAt?: string } | null;
    if (!value || typeof value.savedAt !== "string") return false;
    value.savedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  });
  expect(cachedContext, "a sessão deve ter persistido contexto de tenant validado online").toBe(true);
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker?.controller),
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 15_000 });

  await setPwaOffline(page, context, testInfo.project.name);
  await reloadOfflineWithServiceWorker(page, testInfo.project.name);
  await expect(page.getByText("Não foi possível carregar seus dados", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("agenda-page")).toHaveCount(0);
  await expect(card).toHaveCount(0);
  expect(await appointmentStatus(current), "a tentativa offline não deve modificar o servidor").toBe("pending");
});

test.describe("SOAK opcional da jornada offline", () => {
  test.skip(
    process.env.E2E_RUN_OFFLINE_SOAK !== "true",
    "Soak de cinco minutos é opt-in; use E2E_RUN_OFFLINE_SOAK=true para executá-lo.",
  );

  test("SOAK: mantém a fila e o snapshot estáveis durante cinco minutos desconectado", async ({ page, context }, testInfo) => {
    test.setTimeout(7 * 60 * 1000);
    const current = fixture;
    if (!current) throw new Error("Fixture local do soak offline não foi preparada.");

    await page.goto(`/app/agenda?date=${current.localDate}`, { waitUntil: "domcontentloaded" });
    const card = page.locator(`[data-testid="agenda-appointment-card"][data-appointment-id="${current.appointmentId}"]`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, { timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    let appointmentPatchRequests = 0;
    page.on("request", (request) => {
      if (request.method() === "PATCH" && new URL(request.url()).pathname.endsWith("/rest/v1/appointments")) {
        appointmentPatchRequests += 1;
      }
    });
    await setPwaOffline(page, context, testInfo.project.name);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await card.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(card).toContainText("Confirmado");

    const pendingCount = () => page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("cativa:agenda-queue") ?? "[]").length as number;
      } catch {
        return -1;
      }
    });
    await expect.poll(pendingCount).toBe(1);
    const checkpointCount = Number(process.env.E2E_OFFLINE_SOAK_CHECKPOINTS ?? "10");
    if (!Number.isInteger(checkpointCount) || checkpointCount < 1 || checkpointCount > 10) {
      throw new Error("E2E_OFFLINE_SOAK_CHECKPOINTS deve ser um inteiro entre 1 e 10.");
    }
    const soakStartedAt = Date.now();
    for (let checkpoint = 1; checkpoint <= checkpointCount; checkpoint += 1) {
      await page.waitForTimeout(30_000);
      await expect.poll(pendingCount).toBe(1);
      await expect(card).toContainText("Confirmado");
      expect(
        Date.now() - soakStartedAt,
        `checkpoint offline ${checkpoint}/10 deve respeitar o tempo real decorrido`,
      ).toBeGreaterThanOrEqual(checkpoint * 30_000);
      expect(await appointmentStatus(current), "a fila local não deve gravar enquanto a rede estiver desligada").toBe("pending");
      expect(appointmentPatchRequests, "nenhum PATCH deve sair durante o período desconectado").toBe(0);
      console.log(`SOAK offline: checkpoint ${checkpoint}/${checkpointCount}; servidor ainda pending.`);
    }

    await reloadOfflineWithServiceWorker(page, testInfo.project.name);
    const agenda = page.getByTestId("agenda-page");
    await expect(agenda).toBeVisible({ timeout: 20_000 });
    await expect(agenda).toHaveAttribute("data-using-cache", "true");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Confirmado");
    await expect(pendingCount()).resolves.toBe(1);
    expect(await appointmentStatus(current), "reload desconectado continua sem mutar o servidor").toBe("pending");

    await setPwaOnline(page, context, testInfo.project.name);
    await expect.poll(async () => ({
      status: await appointmentStatus(current),
      queued: await pendingCount(),
    }), { timeout: 30_000 }).toEqual({ status: "confirmed", queued: 0 });
    expect(appointmentPatchRequests, "uma ação local deve gerar exatamente um PATCH ao reconectar").toBe(1);
  });
});
