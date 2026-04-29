/**
 * BottomNav — navegação inferior mobile.
 *
 * Mostra até 4 atalhos diretos (showInBottomNav) + um item "Mais"
 * que abre um Sheet com todos os módulos restantes acessíveis ao role.
 */
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Lock, PackageOpen, X } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { navItems } from "@/config/navigation";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { canAccess } from "@/domain/roles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

export function BottomNav() {
  const { currentRole } = useTenant();
  const { hasFeature, loading: billingLoading } = useTenantBilling();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // Gestores (owner/manager) e super_admin enxergam módulos com featureKey
  // mesmo sem assinatura ativa (com indicador de cadeado). FeatureGate cuida
  // do redirecionamento ao /app/meu-plano.
  const canPreviewLockedFeatures = useMemo(() =>
    currentRole === "owner" || currentRole === "manager" || currentRole === "super_admin", [currentRole]);

  const { primary, secondary, moreActive } = useMemo(() => {
    // Computação de itens permitidos e normalizados
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

    // Divisão entre barra principal e menu "Mais"
    const p = allowedItems.filter((i) => i.showInBottomNav).slice(0, 3);
    const s = allowedItems.filter((i) => !p.some((prev) => prev.to === i.to));
    
    // Verificação de rota ativa (O(n) amortizado)
    const active = s.some((i) =>
      i.to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(i.to),
    );

    return { primary: p, secondary: s, moreActive: active };
  }, [currentRole, hasFeature, canPreviewLockedFeatures, location.pathname]);

  /**
   * Convenção de testids (estável para E2E):
   *   [data-bottom-nav="true"]                     → container do nav
   *   [data-testid="bottom-nav"]                   → idem (alias semântico)
   *   [data-testid="bottom-nav-item"][data-route]  → cada item primary
   *   [data-testid="bottom-nav-more"]              → botão "Mais"
   *   [data-testid="bottom-nav-sheet"]             → Sheet aberto
   *   [data-testid="bottom-nav-sheet-item"][data-route]
   * O atributo data-route guarda a rota de destino (slug estável)
   * mesmo que o label visível seja traduzido/alterado.
   */
  const slugOf = (to: string) => to.replace(/^\/+/, "").replace(/\//g, "-") || "root";

  return (
    <>
      <nav
        data-bottom-nav="true"
        data-testid="bottom-nav"
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl pb-safe pl-safe pr-safe md:hidden"
      >
        <ul className="grid grid-cols-4 px-1 pt-1">
          {/* Skeletons enquanto billing carrega: evita "pulo" do nav
              quando itens com featureKey são incluídos/removidos. */}
          {billingLoading && primary.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <li key={`skeleton-${i}`} data-testid="bottom-nav-skeleton">
                  <div className="flex flex-col items-center justify-center gap-1 py-2 min-h-touch">
                    <Skeleton className="h-5 w-5 rounded-md" />
                    <Skeleton className="h-2.5 w-10" />
                  </div>
                </li>
              ))
            : primary.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/app"}
                    data-testid="bottom-nav-item"
                    data-route={slugOf(item.to)}
                    data-locked={item.locked ? "true" : "false"}
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
          {!billingLoading && secondary.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                data-testid="bottom-nav-more"
                data-state={moreOpen ? "open" : "closed"}
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
          data-testid="bottom-nav-sheet"
          className="rounded-t-3xl border-t border-border/70 p-0 max-h-[85vh]"
        >
          <SheetHeader className="flex-row items-center justify-between border-b border-border/60 px-5 py-4">
            <div className="space-y-1 text-left">
              <SheetTitle className="text-left">Todos os módulos</SheetTitle>
              <SheetDescription>
                Acesse os módulos disponíveis para o seu perfil e plano atual.
              </SheetDescription>
            </div>
            <SheetClose
              data-testid="bottom-nav-sheet-close"
              className="rounded-full p-2 text-muted-foreground tap-feedback"
            >
              <X className="h-4 w-4" />
            </SheetClose>
          </SheetHeader>
          <div className="overflow-y-auto p-4 pb-safe">
            {billingLoading ? (
              <div
                className="grid grid-cols-3 gap-3"
                data-testid="bottom-nav-sheet-skeleton"
                aria-busy="true"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="surface-card flex aspect-square flex-col items-center justify-center gap-2 p-3"
                  >
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-2.5 w-12" />
                  </div>
                ))}
              </div>
            ) : secondary.length === 0 ? (
              <div data-testid="bottom-nav-sheet-empty" className="py-6">
                <EmptyState
                  icon={<PackageOpen className="h-6 w-6" />}
                  title="Nada por aqui ainda"
                  description="Todos os módulos disponíveis para o seu perfil já estão na barra inferior."
                />
              </div>
            ) : (
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
                      data-testid="bottom-nav-sheet-item"
                      data-route={slugOf(item.to)}
                      data-locked={item.locked ? "true" : "false"}
                      data-active={active ? "true" : "false"}
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
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
