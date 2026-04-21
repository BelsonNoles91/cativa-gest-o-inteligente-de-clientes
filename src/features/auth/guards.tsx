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
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location }} />;

  return <>{children ?? <Outlet />}</>;
}

export function RequireOnboarding({ children }: { children?: ReactNode }) {
  const { loading, currentTenant, isSuperAdmin } = useTenant();
  if (loading) return <FullScreenLoader />;
  if (!currentTenant && !isSuperAdmin) return <Navigate to="/onboarding" replace />;
  return <>{children ?? <Outlet />}</>;
}

export function RoleGuard({ allowed, children }: { allowed: Role[]; children?: ReactNode }) {
  const { currentRole, isSuperAdmin, loading } = useTenant();
  if (loading) return <FullScreenLoader />;
  if (isSuperAdmin) return <>{children ?? <Outlet />}</>;
  if (!canAccess(currentRole, allowed)) return <Navigate to="/app" replace />;
  return <>{children ?? <Outlet />}</>;
}
