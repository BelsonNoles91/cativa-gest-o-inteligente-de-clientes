/**
 * AppLayout — layout autenticado do produto.
 *  - desktop: sidebar (collapsible icon) + header + main
 *  - mobile : header + main + bottom nav
 */
import { Outlet } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { AppHeader } from "@/components/shell/AppHeader";
import { BottomNav } from "@/components/shell/BottomNav";
import { OfflineBanner } from "@/components/shell/OfflineBanner";
import { SafeAreaDebugOverlay } from "@/components/debug/SafeAreaDebugOverlay";
import { TenantBillingProvider } from "@/features/billing/TenantBillingProvider";

export function AppLayout() {
  return (
    <TenantBillingProvider>
      <SidebarProvider>
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
              <div className="mx-auto w-full max-w-7xl">
                <Outlet />
              </div>
            </main>
            <BottomNav />
          </SidebarInset>
        </div>
        <SafeAreaDebugOverlay />
      </SidebarProvider>
    </TenantBillingProvider>
  );
}
