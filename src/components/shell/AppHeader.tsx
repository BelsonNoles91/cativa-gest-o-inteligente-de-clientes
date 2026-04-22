/**
 * AppHeader — header global do app.
 *
 * Desktop (md+): linha única com sidebar trigger, tenant, busca expandida, ações.
 * Mobile     : linha única compacta (logo + tenant + ícone busca + perfil).
 *               A busca abre num overlay/CommandDialog ao tocar no ícone.
 */
import { useState } from "react";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TenantSwitcher } from "@/components/shell/TenantSwitcher";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { UserMenu } from "@/components/shell/UserMenu";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppHeader() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl pt-safe">
      {/* Desktop */}
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

      {/* Mobile — uma linha apenas, máximo de espaço pro conteúdo */}
      <div className="flex h-14 items-center gap-2 px-3 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full tap-feedback shrink-0"
              aria-label="Trocar estabelecimento"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-soft text-primary text-[11px] font-semibold">
                <CurrentTenantInitials />
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
            <SheetHeader className="border-b border-border/60 p-4">
              <SheetTitle className="text-left">Estabelecimento</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <TenantSwitcher compact />
            </div>
          </SheetContent>
        </Sheet>

        <CurrentTenantHeader />

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full tap-feedback shrink-0"
          aria-label="Buscar"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full tap-feedback shrink-0"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <UserMenu />
      </div>

      {/* Sheet/Dialog de busca controlado pelo botão mobile */}
      <GlobalSearch
        controlledOpen={searchOpen}
        onControlledOpenChange={setSearchOpen}
        hideTrigger
      />
    </header>
  );
}

function CurrentTenantHeader() {
  // Lazy import para evitar ciclo
  const { useTenant } = require("@/features/tenant/TenantProvider") as typeof import("@/features/tenant/TenantProvider");
  const { currentTenant, currentUnit } = useTenant();
  if (!currentTenant) return <div className="min-w-0 flex-1" />;
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold leading-tight">{currentTenant.name}</p>
      {currentUnit && (
        <p className="truncate text-[11px] leading-tight text-muted-foreground">
          {currentUnit.name}
        </p>
      )}
    </div>
  );
}

function CurrentTenantInitials() {
  const { useTenant } = require("@/features/tenant/TenantProvider") as typeof import("@/features/tenant/TenantProvider");
  const { currentTenant } = useTenant();
  if (!currentTenant) return <span>·</span>;
  const initials = currentTenant.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return <span>{initials || "·"}</span>;
}
