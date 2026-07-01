import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClientsPage from "../Clients";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as clientsRepo from "@/repositories/clients";
import * as schedulingRepo from "@/repositories/scheduling";

// Mock das dependências pesadas
vi.mock("@/repositories/clients");
vi.mock("@/repositories/scheduling");
const mockTenant = { id: "t1", name: "Test Tenant", slug: "test" };
vi.mock("@/features/tenant/TenantProvider", () => ({
  useTenant: () => ({
    currentTenant: mockTenant,
    availableUnits: [],
    currentRole: "owner",
  }),
}));
vi.mock("@/features/billing/useTenantBilling", () => ({
  useTenantBilling: () => ({
    limits: { maxActiveClients: 200 },
    usage: { activeClientsCount: 0 },
    refresh: vi.fn(),
  }),
}));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
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
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);



describe("ClientsPage Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (clientsRepo.listClients as any).mockResolvedValue({
      clients: [
        { 
          id: "c1", 
          fullName: "Test Client", 
          status: "active", 
          riskLevel: "low",
          phone: "11999999999",
          email: "test@example.com",
          isVip: false,
          lastVisitAt: null,
          city: "São Paulo",
          tenantId: "t1"
        }
      ],
      total: 1,
      hasMore: false,
    });
    (clientsRepo.listTags as any).mockResolvedValue([]);
    (schedulingRepo.listProfessionalsLite as any).mockResolvedValue([]);
    (clientsRepo.getClient as any).mockResolvedValue({
      id: "c1",
      fullName: "Test Client",
      status: "active",
      riskLevel: "low",
      churnRiskScore: 10,
      tenantId: "t1",
    });
    (clientsRepo.listClientTagIds as any).mockResolvedValue([]);
    (clientsRepo.listNotes as any).mockResolvedValue([]);
    (clientsRepo.listFiles as any).mockResolvedValue([]);
    (clientsRepo.listPhotos as any).mockResolvedValue([]);
    (clientsRepo.listTimeline as any).mockResolvedValue([]);
    (clientsRepo.listCustomFieldDefs as any).mockResolvedValue([]);
    (clientsRepo.listClientCustomValues as any).mockResolvedValue({});
    (clientsRepo.listConsentTemplates as any).mockResolvedValue([]);
    (clientsRepo.listConsentResponses as any).mockResolvedValue([]);
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
