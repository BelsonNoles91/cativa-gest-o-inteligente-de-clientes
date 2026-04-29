/**
 * DebugConsole — painel flutuante de diagnóstico.
 *
 * Mostra em tempo real:
 *  - rota atual
 *  - status de auth (loading, user id/email)
 *  - status de tenant (loading, isSuperAdmin, tenant atual, unit atual)
 *  - memberships disponíveis e papel atual
 *  - chaves relevantes do localStorage
 *
 * Habilitação:
 *  - Em DEV (import.meta.env.DEV) sempre disponível.
 *  - Em outros ambientes: ative via `localStorage.setItem("cativa.debug", "1")`.
 *  - Atalho de teclado: Ctrl/Cmd + Shift + D abre/fecha.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bug, ChevronDown, ChevronUp, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenant } from "@/features/tenant/TenantProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LS_VISIBLE = "cativa.debug.visible";
const LS_ENABLED = "cativa.debug";

function isAutomatedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.webdriver;
}

function isEnabled(): boolean {
  if (isAutomatedBrowser()) return false;
  // Desativado por padrão na preview para não poluir a página pública,
  // exceto se explicitamente habilitado via localStorage.
  try {
    return localStorage.getItem(LS_ENABLED) === "1";
  } catch {
    return false;
  }
}

export function DebugConsole() {
  const enabled = isEnabled();
  const location = useLocation();
  const auth = useAuth();
  const tenant = useTenant();

  // Em mobile (viewport < 768px), começa minimizado para não cobrir a UI.
  // Em desktop, respeita preferência salva (default: aberto).
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(LS_VISIBLE);
      if (stored !== null) return stored === "1";
      // Default: fechado em mobile, aberto em desktop
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [, setTick] = useState(0);

  // Atalho Ctrl/Cmd + Shift + D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setOpen((v) => {
          const next = !v;
          try {
            localStorage.setItem(LS_VISIBLE, next ? "1" : "0");
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const lsSnapshot = useMemo(() => {
    const keys = ["cativa.currentTenantId", "cativa.currentUnitId"];
    const out: Record<string, string | null> = {};
    try {
      keys.forEach((k) => {
        out[k] = localStorage.getItem(k);
      });
    } catch {
      /* ignore */
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.currentTenant?.id, tenant.currentUnit?.id, location.pathname]);

  if (!enabled) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          try {
            localStorage.setItem(LS_VISIBLE, "1");
          } catch {
            /* ignore */
          }
        }}
        className="fixed bottom-20 right-3 z-[9999] flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:scale-105 md:bottom-4 md:right-4 md:h-10 md:w-10"
        aria-label="Abrir console de debug"
      >
        <Bug className="h-4 w-4" />
      </button>
    );
  }

  const stateColor = (truthy: boolean, loading: boolean) =>
    loading ? "bg-amber-500" : truthy ? "bg-emerald-500" : "bg-rose-500";

  return (
    <div
      className={cn(
        "fixed bottom-20 right-3 z-[9999] w-[300px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border bg-background/95 text-foreground shadow-2xl backdrop-blur md:bottom-4 md:right-4 md:w-[360px] md:max-w-[calc(100vw-2rem)]",
        "font-mono text-xs",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Bug className="h-3.5 w-3.5 text-primary" />
          <span className="font-sans text-xs font-semibold tracking-wide">Debug Console</span>
          <Badge variant="outline" className="font-sans text-[10px] uppercase">
            dev
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setTick((t) => t + 1)}
            title="Recarregar snapshot"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => {
              setOpen(false);
              try {
                localStorage.setItem(LS_VISIBLE, "0");
              } catch {
                /* ignore */
              }
            }}
            title="Fechar (Ctrl+Shift+D para reabrir)"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </header>

      {!collapsed && (
        <div className="max-h-[60vh] space-y-3 overflow-auto p-3">
          {/* Rota */}
          <Section title="Rota">
            <Row label="pathname" value={location.pathname} />
            {location.search && <Row label="search" value={location.search} />}
          </Section>

          {/* Auth */}
          <Section
            title="Auth"
            indicator={<Dot className={stateColor(Boolean(auth.user), auth.loading)} />}
          >
            <Row label="loading" value={String(auth.loading)} />
            <Row label="user" value={auth.user ? "✓ logado" : "— sem sessão"} />
            {auth.user && (
              <>
                <Row label="user.id" value={auth.user.id} mono />
                <Row label="email" value={auth.user.email ?? "—"} />
                <Row
                  label="email_confirmed"
                  value={auth.user.email_confirmed_at ? "✓" : "✗"}
                />
              </>
            )}
          </Section>

          {/* Tenant */}
          <Section
            title="Tenant"
            indicator={
              <Dot
                className={stateColor(
                  Boolean(tenant.currentTenant) || tenant.isSuperAdmin,
                  tenant.loading,
                )}
              />
            }
          >
            <Row label="loading" value={String(tenant.loading)} />
            <Row label="isSuperAdmin" value={String(tenant.isSuperAdmin)} />
            <Row
              label="currentTenant"
              value={
                tenant.currentTenant
                  ? `${tenant.currentTenant.name} (${tenant.currentTenant.slug})`
                  : "—"
              }
            />
            {tenant.currentTenant && (
              <Row label="tenant.id" value={tenant.currentTenant.id} mono />
            )}
            <Row
              label="currentUnit"
              value={tenant.currentUnit ? tenant.currentUnit.name : "—"}
            />
            <Row label="currentRole" value={tenant.currentRole ?? "—"} />
          </Section>

          {/* Memberships */}
          <Section title={`Memberships (${tenant.availableTenants.length})`}>
            {tenant.availableTenants.length === 0 ? (
              <p className="text-muted-foreground">Nenhum membership ativo.</p>
            ) : (
              <ul className="space-y-1">
                {tenant.availableTenants.map((t) => (
                  <li
                    key={t.id}
                    className={cn(
                      "rounded border border-border/60 bg-muted/30 px-2 py-1",
                      tenant.currentTenant?.id === t.id && "border-primary/60 bg-primary/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground">{t.segment}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.id}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Units */}
          <Section title={`Units (${tenant.availableUnits.length})`}>
            {tenant.availableUnits.length === 0 ? (
              <p className="text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-0.5">
                {tenant.availableUnits.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2">
                    <span>{u.name}</span>
                    {u.is_default && (
                      <Badge variant="outline" className="font-sans text-[9px]">
                        default
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* localStorage */}
          <Section title="localStorage">
            {Object.entries(lsSnapshot).map(([k, v]) => (
              <Row key={k} label={k.replace("cativa.", "")} value={v ?? "—"} mono />
            ))}
          </Section>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-sans text-xs"
              onClick={() => void tenant.refresh()}
            >
              Refresh tenant
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 font-sans text-xs"
              onClick={() => {
                try {
                  localStorage.removeItem("cativa.currentTenantId");
                  localStorage.removeItem("cativa.currentUnitId");
                } catch {
                  /* ignore */
                }
                setTick((t) => t + 1);
              }}
            >
              Limpar LS
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 font-sans text-xs"
              onClick={async () => {
                await auth.signOut();
                try {
                  localStorage.removeItem("cativa.currentTenantId");
                  localStorage.removeItem("cativa.currentUnitId");
                } catch {
                  /* ignore */
                }
                window.location.href = "/onboarding";
              }}
            >
              Sair + reset
            </Button>
          </div>

          <p className="pt-1 text-[10px] text-muted-foreground">
            Ctrl/Cmd + Shift + D para abrir/fechar
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  indicator,
  children,
}: {
  title: string;
  indicator?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-border/60 bg-card/40 p-2">
      <header className="mb-1 flex items-center gap-2">
        {indicator}
        <h3 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </header>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("text-right break-all", mono && "font-mono text-[11px]")}>{value}</span>
    </div>
  );
}

function Dot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", className)} />;
}
