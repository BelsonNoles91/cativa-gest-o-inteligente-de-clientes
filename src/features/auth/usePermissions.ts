/**
 * usePermissions — acesso às permissões do papel efetivo no tenant atual.
 * Super admin recebe todas as permissões.
 */
import { useCallback, useMemo } from "react";
import { useTenant } from "@/features/tenant/TenantProvider";
import { hasAnyPermission, hasPermission, type Permission } from "@/domain/permissions";

export function usePermissions() {
  const { currentRole, isSuperAdmin } = useTenant();

  const role = isSuperAdmin ? "super_admin" : currentRole;

  const can = useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role],
  );

  const canAny = useCallback(
    (permissions: Permission[]) => hasAnyPermission(role, permissions),
    [role],
  );

  return useMemo(() => ({ role, can, canAny }), [role, can, canAny]);
}
