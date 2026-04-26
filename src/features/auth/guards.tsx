/**
 * Rotas protegidas + guard por papel.
 *
 * - <ProtectedRoute>: exige sessão. Sem sessão → /auth/login.
 * - <RoleGuard>: exige papel mínimo no tenant atual (ou super_admin global).
 *   Sem papel suficiente → /app (com toast).
 *
 * IMPORTANTE: estes guards são uma camada de UX. A segurança real
 * vive nas RLS policies do Postgres.
 */
import { type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenant } from "@/features/tenant/TenantProvider";
import { canAccess, type Role } from "@/domain/roles";
import { Loader2 } from "lucide-react";

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

  return <>{children ?? <Outlet />}</>;
}

/**
 * RequireOnboarding — usado nas rotas /app/*.
 * Só libera quando o servidor confirmou que o usuário possui pelo menos um
 * membership ativo (ou é super_admin). Enquanto a verificação inicial não
 * estiver concluída, mostra loader — assim evitamos decidir baseados em cache
 * obsoleto de localStorage.
 */
export function RequireOnboarding({ children }: { children?: ReactNode }) {
  const { loading, verified, hasActiveTenant, isClient } = useTenant();
  if (loading || !verified) return <FullScreenLoader />;
  
  if (isClient && !hasActiveTenant) return <Navigate to="/portal" replace />;
  if (!hasActiveTenant) return <Navigate to="/onboarding" replace />;
  
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
  const { loading: tenantLoading, verified, hasActiveTenant, isClient } = useTenant();
  const location = useLocation();

  if (authLoading) return <FullScreenLoader />;
  if (!user) return <>{children ?? <Outlet />}</>;
  
  // Se ainda está carregando ou não verificou, espera.
  if (tenantLoading || !verified) return <FullScreenLoader />;
  
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
