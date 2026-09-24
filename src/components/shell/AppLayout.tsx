/**
 * AppLayout — layout autenticado do produto.
 *  - desktop: sidebar (collapsible icon) + header + main
 *  - mobile : header + main + bottom nav
 */
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { AppHeader } from "@/components/shell/AppHeader";
import { BottomNav } from "@/components/shell/BottomNav";
import { OfflineBanner } from "@/components/shell/OfflineBanner";
import { InstallAppBanner } from "@/components/shell/InstallAppBanner";
import { SafeAreaDebugOverlay } from "@/components/debug/SafeAreaDebugOverlay";
import { TenantBillingProvider } from "@/features/billing/TenantBillingProvider";
import { SubscriptionBlocker } from "@/features/billing/SubscriptionBlocker";
import { TenantRealtimeSync } from "@/features/realtime/TenantRealtimeSync";

export function AppLayout() {
  return (
    <TenantBillingProvider>
      <SidebarProvider>
        <TenantRealtimeSync />
        <OfflineBanner />
        <div className="flex min-h-screen w-full bg-background">
          <div className="hidden md:block">
            <AppSidebar />
          </div>

          <SidebarInset className="flex min-w-0 flex-1 flex-col">
            <AppHeader />
            <main
              data-app-main="true"
              data-testid="app-main"
              data-app-context="tenant"
              className="flex-1 px-4 pt-4 pb-bottom-nav md:px-8 md:pb-10 md:pt-6"
            >
              <div className="mx-auto w-full max-w-7xl space-y-3">
                <InstallAppBanner />
                <SubscriptionBlocker>
                  <Suspense
                    fallback={
                      <div className="space-y-3" aria-busy="true" aria-label="Carregando">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
                        </div>
                        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
                        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
                      </div>
                    }
                  >
                    <Outlet />
                  </Suspense>
                </SubscriptionBlocker>
              </div>
            </main>
            <BottomNav />
          </SidebarInset>
        </div>
        {import.meta.env.DEV && <SafeAreaDebugOverlay />}
      </SidebarProvider>
    </TenantBillingProvider>
  );
}
