/**
 * Rotas protegidas + guard por papel.
 *
 * - <ProtectedRoute>: exige sessão. Sem sessão → /auth/login.
 * - <RequireOnboarding>: exige membership ativa. Sem membership →
 *   verifica convites pendentes. Se houver convite → /auth/aceite-convite.
 *   Se não → /onboarding.
 * - <RoleGuard>: exige papel mínimo no tenant atual (ou super_admin global).
 *   Sem papel suficiente → /app (com toast).
 *
 * IMPORTANTE: estes guards são uma camada de UX. A segurança real
 * vive nas RLS policies do Postgres.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenant } from "@/features/tenant/TenantProvider";
import { canAccess, type Role } from "@/domain/roles";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPendingInvitationsForCurrentUser } from "@/services/team/inviteMember";

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function LoadErrorScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <WifiOff className="h-10 w-10 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">Não foi possível carregar seus dados</p>
          <p className="text-sm text-muted-foreground">
            Verifique sua conexão com a internet e tente novamente.
          </p>
        </div>
        <Button onClick={onRetry} disabled={retrying} className="min-h-[48px] min-w-[200px] rounded-2xl">
          {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    const fallback = location.pathname.startsWith("/portal") ? "/portal/acesso" : "/auth/login";
    return <Navigate to={fallback} replace state={{ from: location }} />;
  }

  // Se o super admin forçou um reset de senha, bloqueia navegação para qualquer outra tela além do Perfil
  if (user.app_metadata?.force_password_reset === true && location.pathname !== "/app/perfil") {
    return <Navigate to="/app/perfil" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

/**
 * RequireOnboarding — usado nas rotas /app/*.
 * Só libera quando o servidor confirmou que o usuário possui pelo menos um
 * membership ativo (ou é super_admin). Enquanto a verificação inicial não
 * estiver concluída, mostra loader — assim evitamos decidir baseados em cache
 * obsoleto de localStorage.
 *
 * Se o usuário NÃO tem membership mas possui convites pendentes, redireciona
 * para a página de aceite do convite (sem forçar onboarding de negócio).
 */
export function RequireOnboarding({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const { loading, verified, loadError, hasActiveTenant, isClient, isSuperAdmin, refresh } = useTenant();
  const [checkingInvites, setCheckingInvites] = useState(false);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null | undefined>(undefined);

  // Verificar convites pendentes quando não tem tenant ativo
  useEffect(() => {
    if (loading || !verified || hasActiveTenant || isSuperAdmin || isClient || !user) return;

    let active = true;
    setCheckingInvites(true);

    (async () => {
      try {
        const invites = await listPendingInvitationsForCurrentUser();
        if (!active) return;
        // Se houver convites pendentes, pegar o token do primeiro
        if (invites && invites.length > 0) {
          // A RPC retorna dados do convite — precisamos do token (se disponível)
          // ou pelo menos redirecionar para a página com o ID
          const firstInvite = invites[0] as { token?: string | null; id?: string | null };
          setPendingInviteToken(firstInvite.token ?? firstInvite.id ?? null);
        } else {
          setPendingInviteToken(null);
        }
      } catch {
        if (active) setPendingInviteToken(null);
      } finally {
        if (active) setCheckingInvites(false);
      }
    })();

    return () => { active = false; };
  }, [loading, verified, hasActiveTenant, isSuperAdmin, isClient, user]);

  if (loading) return <FullScreenLoader />;
  if (!verified) {
    if (loadError) return <LoadErrorScreen onRetry={() => void refresh()} retrying={loading} />;
    return <FullScreenLoader />;
  }
  
  // Super Admin não precisa de onboarding de negócio
  if (isSuperAdmin) return <>{children ?? <Outlet />}</>;
  
  if (isClient && !hasActiveTenant) return <Navigate to="/portal" replace />;

  if (!hasActiveTenant) {
    // Ainda verificando convites
    if (checkingInvites || pendingInviteToken === undefined) return <FullScreenLoader />;

    // Se tem convite pendente, redirecionar para aceite
    if (pendingInviteToken) {
      return <Navigate to={`/auth/aceite-convite?token=${pendingInviteToken}`} replace />;
    }

    // Sem convites → onboarding normal (criar negócio)
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children ?? <Outlet />}</>;
}

/**
 * OnboardingGuard — usado na rota /onboarding.
 * - Sem sessão: deixa passar (Step 0 trata signup).
 * - Com sessão: aguarda a verificação no servidor; se já houver tenant/membership
 *   ativo, redireciona para /app (evita refazer o setup); caso contrário, segue
 *   no onboarding.
 */
export function OnboardingGuard({ children }: { children?: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: tenantLoading, verified, loadError, hasActiveTenant, isClient, isSuperAdmin, refresh } = useTenant();
  const location = useLocation();

  if (authLoading) return <FullScreenLoader />;
  if (!user) return <>{children ?? <Outlet />}</>;
  
  // Se ainda está carregando ou não verificou, espera.
  if (tenantLoading || !verified) return <FullScreenLoader />;

  // Super Admin não faz onboarding
  if (isSuperAdmin && location.pathname === "/onboarding") {
    return <Navigate to="/app" replace />;
  }
  
  // Cliente vai para o portal
  if (isClient && !hasActiveTenant) return <Navigate to="/portal" replace />;
  
  // Se já tem tenant e está tentando acessar onboarding, manda para /app
  if (hasActiveTenant && location.pathname === "/onboarding") {
    return <Navigate to="/app" replace />;
  }
  
  return <>{children ?? <Outlet />}</>;
}

export function RoleGuard({ allowed, children }: { allowed: Role[]; children?: ReactNode }) {
  const { currentRole, isSuperAdmin, loading } = useTenant();
  if (loading) return <FullScreenLoader />;
  if (isSuperAdmin) return <>{children ?? <Outlet />}</>;
  if (!canAccess(currentRole, allowed)) return <Navigate to="/app" replace />;
  return <>{children ?? <Outlet />}</>;
}
