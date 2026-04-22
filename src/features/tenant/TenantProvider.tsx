/**
 * TenantProvider — agora carrega memberships reais do usuário autenticado.
 *
 * Super admin: além dos memberships próprios, recebe a lista global de tenants
 * via RPC `admin_list_all_tenants` e pode impersonar qualquer um (com auditoria).
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
  /** URL do logo do tenant atual (se configurado). */
  currentLogoUrl: string | null;
  /** Indica que o super admin está atuando em um tenant onde NÃO é membro. */
  isImpersonating: boolean;
  setCurrentTenantId: (id: string) => void;
  setCurrentUnitId: (id: string) => void;
  /** Inicia impersonação registrando audit log. */
  impersonateTenant: (id: string, reason?: string | null) => Promise<void>;
  /** Encerra impersonação retornando ao primeiro tenant onde o usuário é membro. */
  endImpersonation: () => Promise<void>;
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
  const [allTenants, setAllTenants] = useState<TenantRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [logosByTenant, setLogosByTenant] = useState<Record<string, string | null>>({});
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(
    () => localStorage.getItem(LS_TENANT),
  );
  const [currentUnitId, setCurrentUnitIdState] = useState<string | null>(
    () => localStorage.getItem(LS_UNIT),
  );

  const setCurrentTenantId = (id: string) => {
    localStorage.setItem(LS_TENANT, id);
    setCurrentTenantIdState(id);
    // Reset de unit ao trocar tenant para evitar inconsistência.
    localStorage.removeItem(LS_UNIT);
    setCurrentUnitIdState(null);
  };
  const setCurrentUnitId = (id: string) => {
    localStorage.setItem(LS_UNIT, id);
    setCurrentUnitIdState(id);
  };

  const load = async () => {
    if (!user) {
      setMemberships([]);
      setAllTenants([]);
      setUnits([]);
      setIsSuperAdmin(false);
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

    // Super admin: carregar lista global de tenants para o switcher / impersonação.
    let globalTenantIds: string[] = [];
    if (superAdmin) {
      const { data: globalRows } = await supabase.rpc("admin_list_all_tenants");
      const mapped = (globalRows ?? []).map((r: { id: string; name: string; slug: string; segment: TenantSegment }) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        segment: r.segment,
      }));
      setAllTenants(mapped);
      globalTenantIds = mapped.map((t) => t.id);
    } else {
      setAllTenants([]);
    }

    const tenantIds = list.map((m) => m.tenant_id);
    const allIds = Array.from(new Set([...tenantIds, ...globalTenantIds]));

    const cachedTenant = localStorage.getItem(LS_TENANT);
    if (cachedTenant && !allIds.includes(cachedTenant)) {
      try {
        localStorage.removeItem(LS_TENANT);
        localStorage.removeItem(LS_UNIT);
      } catch {
        /* ignore */
      }
      setCurrentTenantIdState(null);
      setCurrentUnitIdState(null);
    }

    if (allIds.length > 0) {
      const [{ data: us }, { data: settings }] = await Promise.all([
        supabase
          .from("units")
          .select("id, tenant_id, name, is_default")
          .in("tenant_id", allIds)
          .order("is_default", { ascending: false }),
        supabase
          .from("tenant_settings")
          .select("tenant_id, logo_url")
          .in("tenant_id", allIds),
      ]);
      setUnits((us ?? []) as UnitRow[]);
      const map: Record<string, string | null> = {};
      for (const s of settings ?? []) {
        map[s.tenant_id as string] = (s.logo_url as string) ?? null;
      }
      setLogosByTenant(map);
    } else {
      setUnits([]);
      setLogosByTenant({});
    }
    setVerified(true);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function impersonateTenant(id: string, reason?: string | null) {
    if (!isSuperAdmin) return;
    try {
      await supabase.rpc("admin_log_impersonation_start", {
        _tenant_id: id,
        _reason: reason ?? null,
      });
    } catch (err) {
      // Mantém a troca mesmo se o log falhar; mas reporta no console.
      console.error("Falha ao registrar impersonação", err);
    }
    setCurrentTenantId(id);
  }

  async function endImpersonation() {
    if (!isSuperAdmin || !currentTenantId) return;
    try {
      await supabase.rpc("admin_log_impersonation_end", { _tenant_id: currentTenantId });
    } catch (err) {
      console.error("Falha ao registrar fim de impersonação", err);
    }
    const fallback = memberships[0]?.tenant_id ?? null;
    if (fallback) {
      setCurrentTenantId(fallback);
    } else {
      try {
        localStorage.removeItem(LS_TENANT);
        localStorage.removeItem(LS_UNIT);
      } catch {
        /* ignore */
      }
      setCurrentTenantIdState(null);
      setCurrentUnitIdState(null);
    }
  }

  const value = useMemo<TenantContextValue>(() => {
    // Tenants disponíveis: union de memberships + (se super admin) lista global.
    const fromMemberships = memberships
      .map((m) => m.tenants)
      .filter((t): t is TenantRow => Boolean(t));

    const seen = new Set<string>();
    const availableTenants: TenantRow[] = [];
    for (const t of [...fromMemberships, ...(isSuperAdmin ? allTenants : [])]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      availableTenants.push(t);
    }

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

    const membershipRole = memberships.find((m) => m.tenant_id === effectiveTenantId)?.role ?? null;
    // Super admin SEMPRE prevalece sobre o role de membership: mesmo que o usuário
    // também seja owner/manager em algum tenant, o papel efetivo exibido e usado
    // para autorização de UI é "super_admin" (privilégio mais alto e correto).
    const currentRole: Role | null = isSuperAdmin
      ? ("super_admin" as Role)
      : membershipRole;

    const hasActiveTenant = fromMemberships.length > 0 || isSuperAdmin;
    const currentLogoUrl = effectiveTenantId ? logosByTenant[effectiveTenantId] ?? null : null;

    // Impersonando: super admin atuando em tenant onde NÃO é membro.
    const isImpersonating =
      isSuperAdmin &&
      !!effectiveTenantId &&
      !memberships.some((m) => m.tenant_id === effectiveTenantId);

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
      currentLogoUrl,
      isImpersonating,
      setCurrentTenantId,
      setCurrentUnitId,
      impersonateTenant,
      endImpersonation,
      refresh: load,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships, allTenants, units, logosByTenant, currentTenantId, currentUnitId, isSuperAdmin, loading, verified]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de <TenantProvider />");
  return ctx;
}
