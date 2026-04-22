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
 * Só libera quando o usuário possui pelo menos um membership ativo (ou é super_admin).
 * Caso contrário, manda para /onboarding.
 */
export function RequireOnboarding({ children }: { children?: ReactNode }) {
  const { loading, currentTenant, availableTenants, isSuperAdmin } = useTenant();
  if (loading) return <FullScreenLoader />;
  const hasMembership = availableTenants.length > 0 || Boolean(currentTenant);
  if (!hasMembership && !isSuperAdmin) return <Navigate to="/onboarding" replace />;
  return <>{children ?? <Outlet />}</>;
}

/**
 * OnboardingGuard — usado na rota /onboarding.
 * Se o usuário JÁ tem tenant/membership ativo, redireciona para /app
 * (evita repetir o setup). Sem sessão, deixa passar (Step 0 trata signup).
 */
export function OnboardingGuard({ children }: { children?: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: tenantLoading, availableTenants, isSuperAdmin } = useTenant();

  if (authLoading) return <FullScreenLoader />;
  // Sem sessão → Onboarding mostra Step 0 (signup).
  if (!user) return <>{children ?? <Outlet />}</>;
  // Com sessão, esperamos o tenant carregar antes de decidir.
  if (tenantLoading) return <FullScreenLoader />;
  // Já tem workspace ativo → vai direto pro app.
  if (availableTenants.length > 0 || isSuperAdmin) {
    return <Navigate to="/app" replace />;
  }
  // Logado mas sem tenant → segue no onboarding.
  return <>{children ?? <Outlet />}</>;
}

export function RoleGuard({ allowed, children }: { allowed: Role[]; children?: ReactNode }) {
  const { currentRole, isSuperAdmin, loading } = useTenant();
  if (loading) return <FullScreenLoader />;
  if (isSuperAdmin) return <>{children ?? <Outlet />}</>;
  if (!canAccess(currentRole, allowed)) return <Navigate to="/app" replace />;
  return <>{children ?? <Outlet />}</>;
}
