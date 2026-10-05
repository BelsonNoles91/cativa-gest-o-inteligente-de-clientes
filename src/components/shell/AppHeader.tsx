/**
 * AppHeader — header global do app.
 *
 * Desktop (lg+): linha única com sidebar trigger, tenant, busca e ações.
 * Tablet/mobile: linha compacta com troca de tenant/unidade e busca acessível.
 *               A busca abre num CommandDialog ao tocar no ícone.
 */
import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { Bell, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TenantSwitcher } from "@/components/shell/TenantSwitcher";
/** Busca global carregada sob demanda: tira o pacote do command do carregamento inicial. */
const GlobalSearch = lazy(() =>
  import("@/components/shell/GlobalSearch").then((m) => ({ default: m.GlobalSearch })),
);

function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = (event?: MediaQueryListEvent) => setIsDesktop(event?.matches ?? media.matches);
    update();
    media.addEventListener?.("change", update);
    if (!media.addEventListener) media.addListener(update);
    return () => {
      media.removeEventListener?.("change", update);
      if (!media.removeEventListener) media.removeListener(update);
    };
  }, []);

  return isDesktop;
}
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { UserMenu } from "@/components/shell/UserMenu";
import { OfflineBanner } from "@/components/shell/OfflineBanner";
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
  const isDesktopViewport = useIsDesktopViewport();
  const { currentTenant, currentUnit, currentLogoUrl } = useTenant();

  // Memoização do cálculo de iniciais para evitar processamento de strings em todo render
  const initials = useMemo(() => {
    if (!currentTenant?.name) return "·";
    return currentTenant.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "·";
  }, [currentTenant?.name]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl pt-safe-top">
      {/* Desktop */}
      <div className="hidden h-16 items-center gap-3 px-4 lg:flex">
        <SidebarTrigger className="rounded-lg" />
        {currentLogoUrl && (
          <img
            src={currentLogoUrl}
            alt={currentTenant?.name ?? "Logo"}
            className="h-9 w-9 rounded-lg object-contain bg-muted"
            data-testid="tenant-logo-desktop"
          />
        )}
        <div className="ml-1 hidden lg:block">
          <TenantSwitcher />
        </div>
        <div className="mx-auto w-full max-w-xl">
          {isDesktopViewport && (
            <Suspense fallback={<div className="h-10 w-full rounded-lg bg-muted/50" />}>
              <GlobalSearch />
            </Suspense>
          )}
        </div>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notificações">
          < Bell className="h-4 w-4" />
        </Button>
        < ThemeToggle />
        < UserMenu />
      </div>

      {/* Mobile — uma linha apenas */}
      <div className="flex h-14 items-center gap-2 px-3 lg:hidden">
        <SidebarTrigger className="hidden rounded-lg md:flex" />
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full tap-feedback shrink-0"
              aria-label="Trocar estabelecimento"
              data-testid="tenant-badge-trigger"
            >
              {currentLogoUrl ? (
                <img
                  src={currentLogoUrl}
                  alt={currentTenant?.name ?? "Logo"}
                  className="h-8 w-8 rounded-lg object-contain bg-muted"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-soft text-primary text-[11px] font-semibold">
                  {initials}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
            <SheetHeader className="border-b border-border/60 p-4 pt-safe-top">
              <SheetTitle className="text-left">Estabelecimento</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <TenantSwitcher compact />
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          {currentTenant && (
            <>
              <p className="truncate text-sm font-semibold leading-tight">
                {currentTenant.name}
              </p>
              {currentUnit && (
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {currentUnit.name}
                </p>
              )}
            </>
          )}
        </div>

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

      {/* A faixa ocupa espaço no header sticky; não encobre controles no offline. */}
      <OfflineBanner />

      {/* CommandDialog de busca controlado pelo botão mobile */}
      {searchOpen && (
        <Suspense fallback={null}>
          <GlobalSearch
            controlledOpen={searchOpen}
            onControlledOpenChange={setSearchOpen}
            hideTrigger
          />
        </Suspense>
      )}
    </header>
  );
}
