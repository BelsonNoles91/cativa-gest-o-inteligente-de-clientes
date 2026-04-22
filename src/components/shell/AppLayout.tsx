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
import { TenantBillingProvider } from "@/features/billing/TenantBillingProvider";

export function AppLayout() {
  return (
    <TenantBillingProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <div className="hidden md:block">
            <AppSidebar />
          </div>

          <SidebarInset className="flex min-w-0 flex-1 flex-col">
            <AppHeader />
            <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
              <div className="mx-auto w-full max-w-7xl animate-fade-in">
                <Outlet />
              </div>
            </main>
            <BottomNav />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TenantBillingProvider>
  );
}
