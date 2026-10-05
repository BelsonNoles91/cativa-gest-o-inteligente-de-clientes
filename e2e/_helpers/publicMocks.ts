import { expect, type Page } from "@playwright/test";

const requestsWithoutMocks = new WeakMap<Page, string[]>();

/** Isolates public visual tests from every real Supabase/PostgREST instance. */
export async function mockPublicBackend(page: Page): Promise<void> {
  const unexpectedRequests: string[] = [];
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "apikey, authorization, x-client-info, content-type, prefer",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const knownEndpoints = new Set([
      "/rest/v1/plans",
      "/rest/v1/rpc/get_public_system_flags",
      "/rest/v1/system_status",
      "/rest/v1/system_incidents",
    ]);
    const knownEndpoint = knownEndpoints.has(url.pathname);

    if (!knownEndpoint) {
      unexpectedRequests.push(`${method} ${url.pathname}`);
      await route.fulfill({
        status: 501,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ message: "No deterministic mock configured for this public API request." }),
      });
      return;
    }

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    const operationalComponents = [
      { id: "qa-status-api", component_name: "API pública", status: "operational", last_updated: "2026-10-03T00:00:00.000Z" },
      { id: "qa-status-auth", component_name: "Autenticação", status: "operational", last_updated: "2026-10-03T00:00:00.000Z" },
      { id: "qa-status-database", component_name: "Banco de dados", status: "operational", last_updated: "2026-10-03T00:00:00.000Z" },
      { id: "qa-status-portal", component_name: "Portal do cliente", status: "operational", last_updated: "2026-10-03T00:00:00.000Z" },
    ];
    const body =
      url.pathname === "/rest/v1/plans"
        ? "[]"
        : url.pathname === "/rest/v1/rpc/get_public_system_flags"
          ? JSON.stringify({ enable_signups: true, maintenance_mode: false, show_cativa_index: true })
          : url.pathname === "/rest/v1/system_status"
            ? JSON.stringify(url.searchParams.get("select") === "id" ? [{ id: "qa-status-api" }] : operationalComponents)
            : JSON.stringify([
                {
                  id: "qa-incident-resolved",
                  title: "Manutenção programada concluída",
                  description: "A manutenção sintética do ambiente de QA foi concluída sem impacto para clientes.",
                  severity: "low",
                  status: "resolved",
                  created_at: "2026-10-02T12:00:00.000Z",
                  updated_at: "2026-10-02T13:00:00.000Z",
                  resolved_at: "2026-10-02T13:00:00.000Z",
                },
              ]);
    await route.fulfill({ status: 200, headers, contentType: "application/json", body });
  });

  // The landing page subscribes to public plan changes. Keep the subscription
  // protocol local too: visual tests must never handshake with a developer's
  // default Supabase stack or depend on Realtime being available.
  await page.routeWebSocket("**/realtime/v1/websocket*", (socket) => {
    socket.onMessage((rawMessage) => {
      if (typeof rawMessage !== "string") return;
      try {
        const message = JSON.parse(rawMessage) as [
          string | null,
          string | null,
          string,
          string,
          { config?: { postgres_changes?: Array<Record<string, unknown>> } }?,
        ];
        const [joinRef, ref, topic, event, payload] = message;
        if (event === "heartbeat") {
          socket.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response: {} }]));
        } else if (event === "phx_join") {
          const changes = payload?.config?.postgres_changes ?? [];
          socket.send(
            JSON.stringify([
              joinRef,
              ref,
              topic,
              "phx_reply",
              {
                status: "ok",
                response: { postgres_changes: changes.map((change, index) => ({ ...change, id: `${index + 1}` })) },
              },
            ]),
          );
        }
      } catch {
        // Ignore non-JSON keepalive frames; no data is sent to a real service.
      }
    });
  });

  requestsWithoutMocks.set(page, unexpectedRequests);
}

export function assertPublicBackendWasIsolated(page: Page): void {
  expect(
    requestsWithoutMocks.get(page) ?? [],
    "public visual route called an API endpoint without a deterministic mock",
  ).toEqual([]);
}
