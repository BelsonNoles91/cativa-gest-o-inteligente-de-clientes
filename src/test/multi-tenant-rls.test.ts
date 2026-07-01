import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { listClients, createClient } from "@/repositories/clients";

/**
 * Testes de integração para validar o isolamento Multi-Tenant.
 * Simula as chamadas do repositório garantindo que o tenant_id seja respeitado.
 * 
 * NOTA: Como os testes rodam no frontend (Vitest/JSDOM), não temos um banco 
 * real com RLS ativo no momento do teste unitário (que usa mocks ou o client real), 
 * então validamos que as queries GERADAS pelo repositório incluem obrigatoriamente 
 * o filtro de tenant_id.
 */

// Mock do supabase client para interceptar as chamadas
vi.mock("@/integrations/supabase/client", () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    throwOnError: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    then: vi.fn(),
  };

  return {
    supabase: {
      from: vi.fn(() => mockQueryBuilder),
    },
  };
});

describe("Isolamento Multi-Tenant (RLS Mocked Validation)", () => {
  const TENANT_A = "00000000-0000-0000-0000-00000000000a";
  const TENANT_B = "00000000-0000-0000-0000-00000000000b";
  const USER_ID = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listClients deve incluir obrigatoriamente o filtro eq('tenant_id', ...)", async () => {
    // Configura o mock para retornar sucesso
    const mockFrom = (supabase.from as any)();
    mockFrom.then.mockImplementation((callback: any) => callback({ data: [], error: null, count: 0 }));

    await listClients({ tenantId: TENANT_A });

    // Verifica se o filtro eq('tenant_id', ...) foi chamado com o ID correto
    expect(supabase.from).toHaveBeenCalledWith("clients");
    expect(mockFrom.eq).toHaveBeenCalledWith("tenant_id", TENANT_A);
    
    // Garante que NÃO foi chamado com o ID do outro tenant
    expect(mockFrom.eq).not.toHaveBeenCalledWith("tenant_id", TENANT_B);
  });

  it("createClient deve associar o registro ao tenant_id informado", async () => {
    const mockFrom = (supabase.from as any)();
    mockFrom.single.mockResolvedValue({ data: { id: "1", tenant_id: TENANT_B }, error: null });

    await createClient({
      tenantId: TENANT_B,
      createdBy: USER_ID,
      fullName: "Cliente Teste",
    });

    // Verifica se o insert incluiu o tenant_id correto no objeto
    expect(mockFrom.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_B,
      })
    );
  });

  it("Simulação de RLS: Repositório deve lançar erro se tentar acessar tenant indevido (implícito via filtros)", async () => {
    // Este teste valida que a lógica de negócio do repositório NÃO permite 
    // listar dados sem passar um tenantId.
    
    // @ts-expect-error - forçando chamada sem tenantId
    await expect(listClients({})).rejects.toThrow();
  });
});
