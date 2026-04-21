import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { TenantProvider } from "@/features/tenant/TenantProvider";
import { appConfig } from "@/config/app";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/public/Pricing";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Onboarding from "./pages/auth/Onboarding";
import { AppLayout } from "@/components/shell/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import {
  Agenda,
  Clients,
  Services,
  Packages,
  Confirmations,
  Waitlist,
  Analytics,
  SettingsPage,
  SuperAdmin,
  ClientPortal,
} from "./pages/app/placeholders";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme={appConfig.defaultTheme}>
      <TenantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Público */}
              <Route path="/" element={<Index />} />
              <Route path="/planos" element={<Pricing />} />

              {/* Auth */}
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/recuperar" element={<ForgotPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Portal do cliente (público logado) */}
              <Route path="/portal" element={<ClientPortal />} />

              {/* App autenticado */}
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="clientes" element={<Clients />} />
                <Route path="servicos" element={<Services />} />
                <Route path="pacotes" element={<Packages />} />
                <Route path="confirmacoes" element={<Confirmations />} />
                <Route path="lista-de-espera" element={<Waitlist />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="configuracoes" element={<SettingsPage />} />
                <Route path="super-admin" element={<SuperAdmin />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TenantProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
