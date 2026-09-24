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
  const { loading, activeLink, branding, links, setActiveTenant, portalEnabled, profile, tenantNames } = usePortalClient();
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
            Para começar, abra o link de agendamento que o estabelecimento divulgou — seu perfil é liberado na hora.
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

  if (!portalEnabled) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-soft p-6">
        <div className="max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-md">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="font-display text-xl font-semibold">
            Portal indisponível neste momento
          </h2>
          <p className="text-sm text-muted-foreground">
            {branding?.tenantName ?? "Este estabelecimento"} ainda não habilitou o portal
            do cliente no plano atual. Entre em contato com a recepção para reagendar
            ou pedir informações.
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
      {/* Header pessoal: o portal é do cliente, não do estabelecimento */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-brand font-display text-base font-semibold text-primary-foreground">
              {(profile?.fullName ?? "?").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold leading-tight">
                {profile?.fullName?.split(" ")[0] ? `Olá, ${profile.fullName.split(" ")[0]}` : "Meu espaço"}
              </p>
              <p className="truncate text-xs text-muted-foreground">Seu perfil pessoal Cativa</p>
            </div>
          </div>
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
        {/* Onde sou atendido */}
        <div className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto px-4 pb-3" aria-label="Onde sou atendido">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vendo:</span>
          {links.map((l) => {
            const active = l.tenantId === activeLink.tenantId;
            return (
              <button
                key={l.tenantId}
                type="button"
                onClick={() => setActiveTenant(l.tenantId)}
                aria-pressed={active}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-secondary",
                )}
              >
                {active && branding?.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="h-4 w-4 rounded-full bg-background object-contain" data-testid="portal-tenant-logo" />
                )}
                {tenantNames[l.tenantId] ?? (active ? branding?.tenantName : null) ?? "Estabelecimento"}
              </button>
            );
          })}
        </div>
      </header>

      {/* Conteúdo */}
      <main
        data-app-main="true"
        data-testid="app-main"
        data-app-context="portal"
        className="mx-auto w-full max-w-3xl px-4 pb-bottom-nav pt-4"
      >
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav
        data-bottom-nav="true"
        data-testid="bottom-nav"
        data-app-context="portal"
        aria-label="Navegação do portal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-safe pl-safe pr-safe"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid="bottom-nav-item"
              data-route={to.replace(/^\/+/, "").replace(/\//g, "-") || "root"}
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
      {import.meta.env.DEV && <SafeAreaDebugOverlay />}
    </div>
  );
}
