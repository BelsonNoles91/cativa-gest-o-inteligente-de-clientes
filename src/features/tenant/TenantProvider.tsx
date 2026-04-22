/**
 * TenantProvider — agora carrega memberships reais do usuário autenticado.
 * Mantém compatibilidade com a Etapa 1 (mesma API: currentTenant, currentUnit,
 * availableTenants, availableUnits, currentRole, setCurrentTenantId, setCurrentUnitId).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Role } from "@/domain/roles";
import type { TenantSegment } from "@/domain/tenant";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  segment: TenantSegment;
}
interface UnitRow {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
}
interface MembershipRow {
  tenant_id: string;
  role: Role;
  tenants: TenantRow | null;
}

interface TenantContextValue {
  loading: boolean;
  /** True quando já fizemos pelo menos uma checagem no servidor após auth pronto. */
  verified: boolean;
  /** Confirmação real do servidor: existe membership ativo OU é super_admin. */
  hasActiveTenant: boolean;
  isSuperAdmin: boolean;
  currentTenant: TenantRow | null;
  currentUnit: UnitRow | null;
  availableTenants: TenantRow[];
  availableUnits: UnitRow[];
  currentRole: Role | null;
  setCurrentTenantId: (id: string) => void;
  setCurrentUnitId: (id: string) => void;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);
const LS_TENANT = "cativa.currentTenantId";
const LS_UNIT = "cativa.currentUnitId";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(
    () => localStorage.getItem(LS_TENANT),
  );
  const [currentUnitId, setCurrentUnitIdState] = useState<string | null>(
    () => localStorage.getItem(LS_UNIT),
  );

  const setCurrentTenantId = (id: string) => {
    localStorage.setItem(LS_TENANT, id);
    setCurrentTenantIdState(id);
  };
  const setCurrentUnitId = (id: string) => {
    localStorage.setItem(LS_UNIT, id);
    setCurrentUnitIdState(id);
  };

  const load = async () => {
    if (!user) {
      setMemberships([]);
      setUnits([]);
      setIsSuperAdmin(false);
      // Sem usuário: limpamos qualquer cache local que possa influenciar guards.
      try {
        localStorage.removeItem(LS_TENANT);
        localStorage.removeItem(LS_UNIT);
      } catch {
        /* ignore */
      }
      setCurrentTenantIdState(null);
      setCurrentUnitIdState(null);
      setVerified(true);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: profile }, { data: memb }] = await Promise.all([
      supabase.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle(),
      supabase
        .from("tenant_memberships")
        .select("tenant_id, role, tenants:tenants!inner(id, name, slug, segment)")
        .eq("user_id", user.id)
        .eq("status", "active"),
    ]);

    const superAdmin = Boolean(profile?.is_super_admin);
    setIsSuperAdmin(superAdmin);
    const list = (memb ?? []) as unknown as MembershipRow[];
    setMemberships(list);

    const tenantIds = list.map((m) => m.tenant_id);

    // Sanity: se o tenant em cache local não existe mais entre os memberships
    // ativos do servidor (e o usuário não é super_admin), limpamos o cache para
    // que os guards não sejam enganados por estado obsoleto.
    const cachedTenant = localStorage.getItem(LS_TENANT);
    if (cachedTenant && !tenantIds.includes(cachedTenant) && !superAdmin) {
      try {
        localStorage.removeItem(LS_TENANT);
        localStorage.removeItem(LS_UNIT);
      } catch {
        /* ignore */
      }
      setCurrentTenantIdState(null);
      setCurrentUnitIdState(null);
    }

    if (tenantIds.length > 0) {
      const { data: us } = await supabase
        .from("units")
        .select("id, tenant_id, name, is_default")
        .in("tenant_id", tenantIds)
        .order("is_default", { ascending: false });
      setUnits((us ?? []) as UnitRow[]);
    } else {
      setUnits([]);
    }
    setVerified(true);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const value = useMemo<TenantContextValue>(() => {
    const availableTenants = memberships
      .map((m) => m.tenants)
      .filter((t): t is TenantRow => Boolean(t));

    const effectiveTenantId =
      currentTenantId && availableTenants.some((t) => t.id === currentTenantId)
        ? currentTenantId
        : availableTenants[0]?.id ?? null;

    const currentTenant = availableTenants.find((t) => t.id === effectiveTenantId) ?? null;
    const availableUnits = units.filter((u) => u.tenant_id === effectiveTenantId);
    const effectiveUnitId =
      currentUnitId && availableUnits.some((u) => u.id === currentUnitId)
        ? currentUnitId
        : availableUnits[0]?.id ?? null;
    const currentUnit = availableUnits.find((u) => u.id === effectiveUnitId) ?? null;

    const currentRole =
      memberships.find((m) => m.tenant_id === effectiveTenantId)?.role ??
      (isSuperAdmin ? ("super_admin" as Role) : null);

    // hasActiveTenant é derivado SEMPRE da resposta do servidor (memberships
    // ativos ou flag de super_admin), nunca do cache local. Assim, os guards
    // tomam decisão sobre /onboarding vs /app com base na verdade do banco.
    const hasActiveTenant = availableTenants.length > 0 || isSuperAdmin;

    return {
      loading,
      verified,
      hasActiveTenant,
      isSuperAdmin,
      currentTenant,
      currentUnit,
      availableTenants,
      availableUnits,
      currentRole,
      setCurrentTenantId,
      setCurrentUnitId,
      refresh: load,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships, units, currentTenantId, currentUnitId, isSuperAdmin, loading, verified]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de <TenantProvider />");
  return ctx;
}
