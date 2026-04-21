import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { TenantProvider } from "@/features/tenant/TenantProvider";
import { ProtectedRoute, RequireOnboarding, RoleGuard } from "@/features/auth/guards";
import { appConfig } from "@/config/app";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/public/Pricing";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Onboarding from "./pages/auth/Onboarding";
import { AppLayout } from "@/components/shell/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Settings from "./pages/app/Settings";
import SuperAdmin from "./pages/app/SuperAdmin";
import {
  Agenda, Clients, Services, Packages, Confirmations, Waitlist, Analytics, ClientPortal,
} from "./pages/app/placeholders";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme={appConfig.defaultTheme}>
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Routes>
                {/* Público */}
                <Route path="/" element={<Index />} />
                <Route path="/planos" element={<Pricing />} />

                {/* Auth */}
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/recuperar" element={<ForgotPassword />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />

                {/* Onboarding (requer sessão) */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<Onboarding />} />
                </Route>

                {/* Portal do cliente */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/portal" element={<ClientPortal />} />
                </Route>

                {/* App autenticado + onboarding completo */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<RequireOnboarding />}>
                    <Route path="/app" element={<AppLayout />}>
                      <Route index element={<Dashboard />} />
                      <Route path="agenda" element={<Agenda />} />
                      <Route path="clientes" element={<Clients />} />
                      <Route path="confirmacoes" element={<Confirmations />} />
                      <Route path="lista-de-espera" element={<Waitlist />} />

                      <Route element={<RoleGuard allowed={["owner", "manager"]} />}>
                        <Route path="servicos" element={<Services />} />
                        <Route path="pacotes" element={<Packages />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="configuracoes" element={<Settings />} />
                      </Route>

                      <Route element={<RoleGuard allowed={["super_admin"]} />}>
                        <Route path="super-admin" element={<SuperAdmin />} />
                      </Route>
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
