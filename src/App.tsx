import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { TenantProvider } from "@/features/tenant/TenantProvider";
import { ProtectedRoute, RequireOnboarding, RoleGuard, OnboardingGuard } from "@/features/auth/guards";
import { appConfig } from "@/config/app";

import { FeatureGate } from "@/features/billing/FeatureGate";
import { DebugConsole } from "@/components/debug/DebugConsole";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Pricing = lazy(() => import("./pages/public/Pricing"));
const Login = lazy(() => import("./pages/auth/Login"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Onboarding = lazy(() => import("./pages/auth/Onboarding"));
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Settings = lazy(() => import("./pages/app/Settings"));
const Billing = lazy(() => import("./pages/app/Billing"));
const SuperAdmin = lazy(() => import("./pages/app/SuperAdmin"));
const DataImportExport = lazy(() => import("./pages/app/DataImportExport"));
const ClientsPage = lazy(() => import("./pages/app/Clients"));
const ServicesPage = lazy(() => import("./pages/app/Services"));
const PackagesPage = lazy(() => import("./pages/app/Packages"));
const AgendaPage = lazy(() => import("./pages/app/Agenda"));
const WaitlistPage = lazy(() => import("./pages/app/Waitlist"));
const AnalyticsPage = lazy(() => import("./pages/app/Analytics"));
const ConfirmationCenter = lazy(() => import("./pages/app/ConfirmationCenter"));
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalAgenda = lazy(() => import("./pages/portal/PortalAgenda"));
const PortalBooking = lazy(() => import("./pages/portal/PortalBooking"));
const PortalHistory = lazy(() => import("./pages/portal/PortalHistory"));
const PortalPackages = lazy(() => import("./pages/portal/PortalPackages"));
const PortalProfile = lazy(() => import("./pages/portal/PortalProfile"));
const PortalAccess = lazy(() => import("./pages/portal/PortalAccess"));
const AppLayout = lazy(() =>
  import("@/components/shell/AppLayout").then((module) => ({ default: module.AppLayout })),
);
const PortalLayout = lazy(() =>
  import("@/components/shell/PortalLayout").then((module) => ({ default: module.PortalLayout })),
);
const PortalClientProvider = lazy(() =>
  import("@/features/portal/PortalClientProvider").then((module) => ({ default: module.PortalClientProvider })),
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme={appConfig.defaultTheme}>
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  {/* Público */}
                  <Route path="/" element={<Index />} />
                  <Route path="/planos" element={<Pricing />} />

                  {/* Auth */}
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/recuperar" element={<ForgotPassword />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/portal/acesso" element={<PortalAccess />} />

                  {/* Onboarding — público no Step 0 (signup); quando há sessão,
                      o OnboardingGuard redireciona para /app caso o usuário já
                      possua tenant/membership ativo (evita refazer o setup). */}
                  <Route
                    path="/onboarding"
                    element={
                      <OnboardingGuard>
                        <Onboarding />
                      </OnboardingGuard>
                    }
                  />

                  {/* Portal do cliente */}
                  <Route element={<ProtectedRoute />}>
                    <Route
                      path="/portal"
                      element={
                        <PortalClientProvider>
                          <PortalLayout />
                        </PortalClientProvider>
                      }
                    >
                      <Route index element={<PortalHome />} />
                      <Route path="agenda" element={<PortalAgenda />} />
                      <Route path="agendar" element={<PortalBooking />} />
                      <Route path="historico" element={<PortalHistory />} />
                      <Route path="pacotes" element={<PortalPackages />} />
                      <Route path="perfil" element={<PortalProfile />} />
                    </Route>
                  </Route>

                  {/* App autenticado + onboarding completo */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<RequireOnboarding />}>
                      <Route path="/app" element={<AppLayout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="agenda" element={<AgendaPage />} />
                        <Route path="clientes" element={<ClientsPage />} />
                        <Route
                          path="confirmacoes"
                          element={
                            <FeatureGate featureKey="confirmation_center">
                              <ConfirmationCenter />
                            </FeatureGate>
                          }
                        />
                        <Route path="lista-de-espera" element={<WaitlistPage />} />

                        <Route element={<RoleGuard allowed={["owner", "manager"]} />}>
                          <Route path="servicos" element={<ServicesPage />} />
                          <Route
                            path="pacotes"
                            element={
                              <FeatureGate featureKey="packages_memberships">
                                <PackagesPage />
                              </FeatureGate>
                            }
                          />
                          <Route
                            path="analytics"
                            element={
                              <FeatureGate featureKey="analytics">
                                <AnalyticsPage />
                              </FeatureGate>
                            }
                          />
                          <Route path="meu-plano" element={<Billing />} />
                          <Route path="dados" element={<DataImportExport />} />
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
              </Suspense>
              <DebugConsole />
            </TooltipProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Carregando módulo...</div>
    </div>
  );
}

export default App;
