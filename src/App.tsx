import { Suspense, lazy, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { TenantProvider } from "@/features/tenant/TenantProvider";
import { ProtectedRoute, RequireOnboarding, RoleGuard, OnboardingGuard } from "@/features/auth/guards";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { appConfig } from "@/config/app";

import { FeatureGate } from "@/features/billing/FeatureGate";
import { DebugConsole } from "@/components/debug/DebugConsole";
const Index = lazyWithReload(() => import("./pages/Index"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes (aumentado para reduzir requests redundantes)
      gcTime: 1000 * 60 * 60,    // 60 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
    },
  },
});

/**
 * Wrap dynamic imports so that, if a lazy chunk fails to load (typical
 * after a deploy/HMR where the previous chunk hash no longer exists),
 * we force a single hard reload instead of crashing into a blank screen.
 */
function lazyWithReload<T extends { default: ComponentType<any> }>(
  factory: () => Promise<T>,
) {
  return lazy(() =>
    factory().catch((error) => {
      const key = "__lovable_chunk_reload__";
      if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        // Return a never-resolving promise while the page reloads.
        return new Promise<T>(() => {});
      }
      throw error;
    }),
  );
}

const NotFound = lazyWithReload(() => import("./pages/NotFound"));
const Pricing = lazyWithReload(() => import("./pages/public/Pricing"));
const Login = lazyWithReload(() => import("./pages/auth/Login"));
const ForgotPassword = lazyWithReload(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazyWithReload(() => import("./pages/auth/ResetPassword"));
const AcceptInvite = lazyWithReload(() => import("./pages/auth/AcceptInvite"));
const Onboarding = lazyWithReload(() => import("./pages/auth/Onboarding"));
const Dashboard = lazyWithReload(() => import("./pages/app/Dashboard"));
const Settings = lazyWithReload(() => import("./pages/app/Settings"));
const Billing = lazyWithReload(() => import("./pages/app/Billing"));
const Subscription = lazyWithReload(() => import("./pages/app/Subscription"));
const SuperAdmin = lazyWithReload(() => import("./pages/app/SuperAdmin"));
const DataImportExport = lazyWithReload(() => import("./pages/app/DataImportExport"));
const ClientsPage = lazyWithReload(() => import("./pages/app/Clients"));
const ServicesPage = lazyWithReload(() => import("./pages/app/Services"));
const PackagesPage = lazyWithReload(() => import("./pages/app/Packages"));
const AgendaPage = lazyWithReload(() => import("./pages/app/Agenda"));
const WaitlistPage = lazyWithReload(() => import("./pages/app/Waitlist"));
const AnalyticsPage = lazyWithReload(() => import("./pages/app/Analytics"));
const ConfirmationCenter = lazyWithReload(() => import("./pages/app/ConfirmationCenter"));
const PortalHome = lazyWithReload(() => import("./pages/portal/PortalHome"));
const PortalAgenda = lazyWithReload(() => import("./pages/portal/PortalAgenda"));
const PortalBooking = lazyWithReload(() => import("./pages/portal/PortalBooking"));
const PortalHistory = lazyWithReload(() => import("./pages/portal/PortalHistory"));
const PortalPackages = lazyWithReload(() => import("./pages/portal/PortalPackages"));
const PortalProfile = lazyWithReload(() => import("./pages/portal/PortalProfile"));
const PortalAccess = lazyWithReload(() => import("./pages/portal/PortalAccess"));
const AppLayout = lazyWithReload(() =>
  import("@/components/shell/AppLayout").then((module) => ({ default: module.AppLayout })),
);
const PortalLayout = lazyWithReload(() =>
  import("@/components/shell/PortalLayout").then((module) => ({ default: module.PortalLayout })),
);
const PortalClientProvider = lazyWithReload(() =>
  import("@/features/portal/PortalClientProvider").then((module) => ({ default: module.PortalClientProvider })),
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary name="Root">
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
                  <Route path="/pricing" element={<Pricing />} />

                  {/* Auth */}
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/recuperar" element={<ForgotPassword />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/auth/aceite-convite" element={<AcceptInvite />} />
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
                          <Route path="assinatura" element={<Subscription />} />
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
    </ErrorBoundary>
  </QueryClientProvider>
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Skeleton "app shell": cabeçalho + área de conteúdo + bottom nav.
          Evita o flash de tela em branco durante a navegação lazy e mantém
          a sensação de aplicativo nativo. */}
      <div className="h-14 border-b border-border/70 bg-background/90 px-4 pt-safe md:h-16">
        <div className="flex h-full items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
          <div className="ml-auto h-8 w-8 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="flex-1 space-y-3 px-4 pt-6 md:px-8">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-muted/70" />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
        </div>
      </div>
      <div className="h-16 border-t border-border/70 bg-background/90 pb-safe md:hidden" />
    </div>
  );
}

export default App;
