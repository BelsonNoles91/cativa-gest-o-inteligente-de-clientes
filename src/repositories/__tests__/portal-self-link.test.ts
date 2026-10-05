import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { ensureClientUserLink } from "../portal";

type QueryResult = { data: Record<string, unknown> | null; error: unknown | null };

function makeSingleQuery(result: QueryResult) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "ilike", "insert"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(async () => result);
  return query;
}

const input = {
  userId: "user-client-a",
  email: "cliente@example.test",
  fullName: "Cliente QA",
  tenantId: "tenant-a",
};

const link = {
  id: "link-a",
  tenant_id: "tenant-a",
  client_id: "client-a",
  user_id: "user-client-a",
  status: "active",
  linked_at: "2026-10-03T12:00:00.000Z",
};

describe("portal repository — vínculo seguro cliente/usuário", () => {
  let existingLinkQuery: ReturnType<typeof makeSingleQuery>;
  let clientSearchQuery: ReturnType<typeof makeSingleQuery>;
  let reloadedLinkQuery: ReturnType<typeof makeSingleQuery>;

  beforeEach(() => {
    vi.clearAllMocks();
    existingLinkQuery = makeSingleQuery({ data: null, error: null });
    clientSearchQuery = makeSingleQuery({ data: { id: "client-a" }, error: null });
    reloadedLinkQuery = makeSingleQuery({ data: link, error: null });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "client_users") {
        return existingLinkQuery.maybeSingle.mock.calls.length === 0
          ? existingLinkQuery
          : reloadedLinkQuery;
      }
      if (table === "clients") return clientSearchQuery;
      throw new Error(`Tabela inesperada no teste do portal: ${table}`);
    });
    supabaseMock.rpc.mockResolvedValue({ data: 1, error: null });
  });

  it("reutiliza vínculo já existente sem consultar cliente nem reivindicar novamente", async () => {
    existingLinkQuery = makeSingleQuery({ data: link, error: null });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "client_users") return existingLinkQuery;
      throw new Error(`Consulta inesperada: ${table}`);
    });

    await expect(ensureClientUserLink(input)).resolves.toMatchObject({
      id: "link-a",
      tenantId: "tenant-a",
      clientId: "client-a",
      userId: "user-client-a",
      status: "active",
    });

    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(existingLinkQuery.eq).toHaveBeenCalledWith("user_id", input.userId);
    expect(existingLinkQuery.eq).toHaveBeenCalledWith("tenant_id", input.tenantId);
    expect(existingLinkQuery.insert).not.toHaveBeenCalled();
  });

  it("reivindica no servidor após encontrar o cadastro e recarrega o vínculo", async () => {
    const actualLink = await ensureClientUserLink(input);

    expect(actualLink).toMatchObject({ id: "link-a", clientId: "client-a", tenantId: "tenant-a" });
    expect(clientSearchQuery.eq).toHaveBeenCalledWith("tenant_id", input.tenantId);
    expect(clientSearchQuery.ilike).toHaveBeenCalledWith("email", input.email);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("claim_portal_links_for_current_user");
    expect(supabaseMock.from).toHaveBeenNthCalledWith(3, "client_users");
    expect(reloadedLinkQuery.eq).toHaveBeenCalledWith("user_id", input.userId);
    expect(reloadedLinkQuery.eq).toHaveBeenCalledWith("tenant_id", input.tenantId);
    expect(clientSearchQuery.insert).not.toHaveBeenCalled();
    expect(existingLinkQuery.insert).not.toHaveBeenCalled();
    expect(reloadedLinkQuery.insert).not.toHaveBeenCalled();
  });

  it("nega vínculo quando não há cadastro correspondente e não chama a RPC", async () => {
    clientSearchQuery = makeSingleQuery({ data: null, error: null });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "client_users") return existingLinkQuery;
      if (table === "clients") return clientSearchQuery;
      throw new Error(`Consulta inesperada: ${table}`);
    });

    await expect(ensureClientUserLink(input)).rejects.toThrow(
      "Não encontramos seu cadastro neste estabelecimento.",
    );

    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
    expect(clientSearchQuery.insert).not.toHaveBeenCalled();
  });

  it("nega vínculo quando a reivindicação segura não encontra e-mail verificado", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 0, error: null });

    await expect(ensureClientUserLink(input)).rejects.toThrow(
      "Seu e-mail ainda não está vinculado a um cadastro.",
    );

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
    expect(clientSearchQuery.insert).not.toHaveBeenCalled();
    expect(existingLinkQuery.insert).not.toHaveBeenCalled();
  });

  it("preserva erro do banco e não cria vínculo como fallback", async () => {
    const databaseError = { code: "42501", message: "permission denied" };
    supabaseMock.rpc.mockResolvedValue({ data: null, error: databaseError });

    await expect(ensureClientUserLink(input)).rejects.toBe(databaseError);

    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
    expect(clientSearchQuery.insert).not.toHaveBeenCalled();
    expect(existingLinkQuery.insert).not.toHaveBeenCalled();
  });
});
