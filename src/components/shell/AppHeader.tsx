/**
 * AppHeader — header global do app (desktop + mobile).
 */
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TenantSwitcher } from "@/components/shell/TenantSwitcher";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { UserMenu } from "@/components/shell/UserMenu";
import { Logo } from "@/components/brand/Logo";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md pt-safe">
      {/* Linha 1 — desktop */}
      <div className="hidden h-16 items-center gap-3 px-4 md:flex">
        <SidebarTrigger className="rounded-lg" />
        <div className="ml-1 hidden lg:block">
          <TenantSwitcher />
        </div>
        <div className="mx-auto w-full max-w-xl">
          <GlobalSearch />
        </div>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>

      {/* Linha 1 — mobile */}
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:hidden">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notificações">
            <Bell className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      {/* Linha 2 mobile — busca + tenant */}
      <div className="space-y-2 border-t border-border/60 px-4 py-2 md:hidden">
        <GlobalSearch />
        <TenantSwitcher compact />
      </div>
    </header>
  );
}
