/**
 * BottomNav — navegação inferior mobile.
 *
 * Mostra até 4 atalhos diretos (showInBottomNav) + um item "Mais"
 * que abre um Sheet com todos os módulos restantes acessíveis ao role.
 */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Lock, X } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { navItems } from "@/config/navigation";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { canAccess } from "@/domain/roles";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

export function BottomNav() {
  const { currentRole } = useTenant();
  const { hasFeature } = useTenantBilling();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // Gestores enxergam módulos com featureKey mesmo sem assinatura ativa
  // (com indicador de cadeado). FeatureGate cuida do redirecionamento ao /app/meu-plano.
  const canPreviewLockedFeatures = currentRole === "owner" || currentRole === "manager";

  const allowedItems = navItems
    .filter(
      (i) =>
        canAccess(currentRole, i.roles) &&
        (!i.featureKey || hasFeature(i.featureKey) || canPreviewLockedFeatures),
    )
    .map((i) => ({
      ...i,
      locked: Boolean(i.featureKey) && !hasFeature(i.featureKey!),
    }));
  const primary = allowedItems.filter((i) => i.showInBottomNav).slice(0, 4);
  const secondary = allowedItems.filter(
    (i) => !primary.some((p) => p.to === i.to),
  );

  const moreActive = secondary.some((i) =>
    i.to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(i.to),
  );

  return (
    <>
      <nav
        data-bottom-nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl pb-safe pl-safe pr-safe md:hidden"
      >
        <ul className="grid grid-cols-5 px-1 pt-1">
          {primary.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/app"}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10.5px] font-medium tap-feedback",
                  "text-muted-foreground transition-colors min-h-touch",
                )}
                activeClassName="text-primary"
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.locked && (
                    <Lock
                      aria-label="Recurso bloqueado pelo plano"
                      className="absolute -right-1.5 -top-1 h-2.5 w-2.5 text-muted-foreground"
                    />
                  )}
                </span>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </NavLink>
            </li>
          ))}
          {secondary.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10.5px] font-medium tap-feedback transition-colors min-h-touch",
                  moreActive ? "text-primary" : "text-muted-foreground",
                )}
                aria-label="Mais opções"
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
              >
                <LayoutGrid className="h-5 w-5" />
                <span>Mais</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-border/70 p-0 max-h-[85vh]"
        >
          <SheetHeader className="flex-row items-center justify-between border-b border-border/60 px-5 py-4">
            <SheetTitle className="text-left">Todos os módulos</SheetTitle>
            <SheetClose className="rounded-full p-2 text-muted-foreground tap-feedback">
              <X className="h-4 w-4" />
            </SheetClose>
          </SheetHeader>
          <div className="overflow-y-auto p-4 pb-safe">
            <div className="grid grid-cols-3 gap-3">
              {secondary.map((item) => {
                const active = item.to === "/app"
                  ? location.pathname === "/app"
                  : location.pathname.startsWith(item.to);
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(item.to);
                    }}
                    className={cn(
                      "surface-card flex aspect-square flex-col items-center justify-center gap-2 p-3 tap-feedback transition-colors",
                      active && "border-primary/50 bg-primary-soft/40",
                    )}
                  >
                    <span
                      className={cn(
                        "relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary",
                        active && "bg-primary text-primary-foreground",
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.locked && (
                        <Lock
                          aria-label="Recurso bloqueado pelo plano"
                          className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-background p-0.5 text-muted-foreground"
                        />
                      )}
                    </span>
                    <span className="text-center text-[11px] font-medium leading-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
