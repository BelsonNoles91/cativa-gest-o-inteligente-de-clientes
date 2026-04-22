/**
 * PortalLayout — layout mobile-first do portal do cliente.
 *
 * - Header com branding do tenant (nome do negócio, unidade preferida).
 * - Bottom nav com 4 áreas: Início, Agenda, Pacotes, Perfil.
 * - Carrega o vínculo client_user e bloqueia se não houver.
 */
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Calendar,
  Home,
  Package as PackageIcon,
  User as UserIcon,
  Loader2,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortalClient } from "@/features/portal/PortalClientProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { OfflineBanner } from "@/components/shell/OfflineBanner";
import { SafeAreaDebugOverlay } from "@/components/debug/SafeAreaDebugOverlay";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/portal", label: "Início", icon: Home, end: true },
  { to: "/portal/agenda", label: "Agenda", icon: Calendar, end: false },
  { to: "/portal/pacotes", label: "Pacotes", icon: PackageIcon, end: false },
  { to: "/portal/perfil", label: "Perfil", icon: UserIcon, end: false },
];

export function PortalLayout() {
  const { loading, activeLink, branding, links, setActiveTenant } = usePortalClient();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeLink) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-soft p-6">
        <div className="max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-md">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning/15 text-warning">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="font-display text-xl font-semibold">Acesso ainda não vinculado</h2>
          <p className="text-sm text-muted-foreground">
            Não encontramos seu cadastro vinculado a nenhum estabelecimento.
            Peça à recepção do seu salão/clínica para liberar seu acesso ao portal.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate("/auth/login", { replace: true });
            }}
          >
            <LogOut className="mr-1.5 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-soft">
      <OfflineBanner />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold leading-tight">
              {branding?.tenantName ?? "Meu portal"}
            </p>
            {branding?.unitName && (
              <p className="truncate text-xs text-muted-foreground">{branding.unitName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {links.length > 1 && (
              <select
                value={activeLink.tenantId}
                onChange={(e) => setActiveTenant(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                aria-label="Trocar de estabelecimento"
              >
                {links.map((l) => (
                  <option key={l.tenantId} value={l.tenantId}>
                    {l.tenantId === branding?.tenantId
                      ? branding.tenantName
                      : "Outro local"}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await signOut();
                navigate("/auth/login", { replace: true });
              }}
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main
        data-app-main
        className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4"
      >
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav
        data-bottom-nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform",
                      isActive && "scale-110",
                    )}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
