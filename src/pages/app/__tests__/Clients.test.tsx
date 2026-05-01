import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClientsPage from "../Clients";
import { BrowserRouter } from "react-router-dom";
import { TenantProvider } from "@/features/tenant/TenantProvider";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { TenantBillingProvider } from "@/features/billing/TenantBillingProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as clientsRepo from "@/repositories/clients";
import * as schedulingRepo from "@/repositories/scheduling";

// Mock das dependências pesadas
vi.mock("@/repositories/clients");
vi.mock("@/repositories/scheduling");
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <TenantBillingProvider>
            {children}
          </TenantBillingProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);


describe("ClientsPage Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (clientsRepo.listClients as any).mockResolvedValue([
      { id: "c1", fullName: "Test Client", status: "active", riskLevel: "low" }
    ]);
    (clientsRepo.listTags as any).mockResolvedValue([]);
    (schedulingRepo.listProfessionalsLite as any).mockResolvedValue([]);
  });

  it("should render client list and allow selecting a client", async () => {
    render(<ClientsPage />, { wrapper });
    
    // Verifica se a lista carregou
    const clientItem = await screen.findByText("Test Client");
    expect(clientItem).toBeInTheDocument();

    // Mock do detalhe do cliente
    (clientsRepo.getClient as any).mockResolvedValue({
      id: "c1",
      fullName: "Test Client",
      status: "active",
      riskLevel: "low",
      churnRiskScore: 10,
    });

    fireEvent.click(clientItem);

    // Verifica se o detalhe apareceu
    await waitFor(() => {
      expect(screen.getByText("Dados principais")).toBeInTheDocument();
    });
  });
});
