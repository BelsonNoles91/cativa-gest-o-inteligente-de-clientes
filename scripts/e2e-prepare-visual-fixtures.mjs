#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const guard = spawnSync(
  process.execPath,
  [resolve("scripts/e2e-target-check.mjs"), "--destructive"],
  { stdio: "inherit", env: process.env },
);
if (guard.error) throw guard.error;
if (guard.status !== 0) process.exit(guard.status ?? 1);

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "E2E_USER",
  "E2E_PASS",
  "E2E_TENANT_SLUG",
];
for (const key of required) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Preparação de screenshots: ${key} é obrigatório.`);
  }
}

const client = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

function ensure(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function main() {
  const auth = ensure(
    await client.auth.signInWithPassword({
      email: process.env.E2E_USER,
      password: process.env.E2E_PASS,
    }),
    "autenticar owner para preparar screenshots",
  );
  if (!auth.user?.id) throw new Error("Owner QA não retornou identidade válida.");

  try {
    const tenant = ensure(
      await client
        .from("tenants")
        .select("id")
        .eq("slug", process.env.E2E_TENANT_SLUG)
        .single(),
      "resolver tenant QA para screenshots",
    );
    const clients = ensure(
      await client
        .from("clients")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("full_name", "Cliente QA Local"),
      "localizar cliente sintético do portal",
    );
    const clientIds = (clients ?? []).map(({ id }) => id);
    let removedAppointments = 0;

    if (clientIds.length > 0) {
      const appointments = ensure(
        await client
          .from("appointments")
          .select("id")
          .eq("tenant_id", tenant.id)
          .in("client_id", clientIds)
          .eq("source", "client_portal"),
        "localizar agendamentos de portal da fixture sintética",
      );
      const appointmentIds = (appointments ?? []).map(({ id }) => id);

      if (appointmentIds.length > 0) {
        for (const table of [
          "confirmation_queue",
          "appointment_items",
          "appointment_status_history",
        ]) {
          ensure(
            await client
              .from(table)
              .delete()
              .in("appointment_id", appointmentIds),
            `limpar ${table} da fixture sintética do portal`,
          );
        }
        ensure(
          await client.from("appointments").delete().in("id", appointmentIds),
          "remover agendamentos sintéticos do portal antes dos screenshots",
        );
        removedAppointments = appointmentIds.length;
      }
    }

    const portalService = ensure(
      await client
        .from("services")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("internal_code", "QA-PORTAL-LOCAL")
        .maybeSingle(),
      "localizar catálogo sintético do portal",
    );
    if (portalService?.id) {
      const references = ensure(
        await client
          .from("appointment_items")
          .select("id")
          .eq("service_id", portalService.id),
        "verificar referências do serviço sintético do portal",
      );
      if ((references ?? []).length > 0) {
        throw new Error(
          "A fixture visual não está isolada: o serviço QA-PORTAL-LOCAL ainda é usado por agendamentos. Nenhum serviço foi removido.",
        );
      }
      ensure(
        await client.from("service_prices").delete().eq("service_id", portalService.id),
        "remover preço do serviço sintético do portal",
      );
      ensure(
        await client.from("services").delete().eq("id", portalService.id),
        "remover serviço sintético do portal após a jornada",
      );
    }

    console.log(
      `Fixtures visuais estabilizadas no tenant QA: ${removedAppointments} agendamento(s) sintético(s) removido(s); catálogo transitório do portal limpo.`,
    );
  } finally {
    await client.auth.signOut();
  }
}

await main();
