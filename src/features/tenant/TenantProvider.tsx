/**
 * @file TenantProvider.tsx
 * @description Centralized state management for Multi-tenant context.
 * Responsible for resolving the current tenant, managing impersonation for super-admins,
 * and handling tenant-specific settings and units.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
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

/**
 * @interface TenantContextValue
 * @description Contract for the Multi-tenant context.
 */
interface TenantContextValue {
  /** Global loading state for tenant resolution */
  loading: boolean;
  /** True when the initial server verification of memberships has completed */
  verified: boolean;
  /** Whether the user has at least one active tenant membership or is a super admin */
  hasActiveTenant: boolean;
  /** Flag for internal support/admin users with global access */
  isSuperAdmin: boolean;
  /** The currently selected tenant object */
  currentTenant: TenantRow | null;
  /** The currently selected business unit within the tenant */
  currentUnit: UnitRow | null;
  /** List of all tenants the user has access to */
  availableTenants: TenantRow[];
  /** List of business units available for the current tenant */
  availableUnits: UnitRow[];
  /** Effective role of the user (resolved between memberships and super_admin status) */
  currentRole: Role | null;
  /** Public URL for the tenant's branding logo */
  currentLogoUrl: string | null;
  /** True if a super_admin is accessing a tenant they are not explicitly a member of */
  isImpersonating: boolean;
  /** Whether the user is identified as a client/customer in the portal */
  isClient: boolean;
  /** Updates the active tenant and persists selection to localStorage */
  setCurrentTenantId: (id: string) => void;
  /** Updates the active unit and persists selection to localStorage */
  setCurrentUnitId: (id: string) => void;
  /**
   * Switches context to any tenant (Super Admin only).
   * @async
   * @param id - Target tenant ID
   * @param reason - Optional justification for audit logging
   */
  impersonateTenant: (id: string, reason?: string | null) => Promise<void>;
  /**
   * Resets impersonation context back to the user's primary memberships.
   * @async
   */
  endImpersonation: () => Promise<void>;
  /** Forces a re-fetch of all tenant memberships and profile data */
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);
const STORAGE_KEY_TENANT = "cativa.currentTenantId";
const STORAGE_KEY_UNIT = "cativa.currentUnitId";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [allTenants, setAllTenants] = useState<TenantRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [logosByTenant, setLogosByTenant] = useState<Record<string, string | null>>({});
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY_TENANT),
  );
  const [currentUnitId, setCurrentUnitIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY_UNIT),
  );

  const setCurrentTenantId = (id: string) => {
    localStorage.setItem(STORAGE_KEY_TENANT, id);
    setCurrentTenantIdState(id);
    localStorage.removeItem(STORAGE_KEY_UNIT);
    setCurrentUnitIdState(null);
  };

  const setCurrentUnitId = (id: string) => {
    localStorage.setItem(STORAGE_KEY_UNIT, id);
    setCurrentUnitIdState(id);
  };

  const loadBaseData = useCallback(async (force = false) => {
    // Se ainda estamos carregando auth, não faz nada
    if (authLoading) return;

    // Se estivermos em uma rota de portal, o TenantProvider não deve atuar
    // O PortalClientProvider cuidará do contexto do cliente
    const isPortalRoute = window.location.pathname.startsWith("/portal");
    
    if (isPortalRoute) {
      setLoading(false);
      setVerified(true);
      return;
    }

    // Se já está verificado e não é um force refresh, evita reload inútil
    if (verified && !force && user?.id) return;

    if (!user) {
      console.log("[TenantProvider] No user found, clearing context");
      setMemberships([]);
      setAllTenants([]);
      setUnits([]);
      setIsSuperAdmin(false);
      setIsClient(false);
      try {
        localStorage.removeItem(STORAGE_KEY_TENANT);
        localStorage.removeItem(STORAGE_KEY_UNIT);
      } catch (e) {
        console.warn("[TenantProvider:clearLS]", e);
      }
      setCurrentTenantIdState(null);
      setCurrentUnitIdState(null);
      setVerified(true);
      setLoading(false);
      return;
    }

    console.log("[TenantProvider] Requesting load for user:", user.id);
    setLoading(true);
    setVerified(false);
    try {
      const [
        { data: profile, error: profileErr }, 
        { data: memb, error: membErr },
        { data: clientLinks, error: clientErr }
      ] = await Promise.all([
        supabase.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle(),
        supabase
          .from("tenant_memberships")
          .select("tenant_id, role, tenants:tenants!inner(id, name, slug, segment)")
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("client_users")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
      ]);

      if (profileErr || membErr || clientErr) throw profileErr || membErr || clientErr;

      const superAdmin = Boolean(profile?.is_super_admin);
      setIsSuperAdmin(superAdmin);
      
      const clientLinksList = clientLinks ?? [];
      setIsClient(clientLinksList.length > 0);
      
      const membershipList = (memb ?? []) as unknown as MembershipRow[];
      setMemberships(membershipList);

      // Se o usuário não é super admin e não tem nenhum membership ativo, 
      // precisamos decidir para onde enviá-lo.
      if (!superAdmin && membershipList.length === 0) {
        const isClient = (clientLinks ?? []).length > 0;
        
        // Log para debug, mas os Guards (RequireOnboarding/OnboardingGuard) 
        // agora cuidam do redirecionamento baseados no estado isClient.
        if (isClient && location.pathname.startsWith("/app")) {
          console.log("[TenantProvider] Client detected, guards will redirect to portal");
        } else if (!isClient && location.pathname.startsWith("/app")) {
          console.log("[TenantProvider] No memberships found, guards will redirect to onboarding");
        }
      }

      if (superAdmin) {
        const { data: globalRows, error: globalErr } = await supabase.rpc("admin_list_all_tenants");
        if (globalErr) console.error("[TenantProvider:admin_list]", globalErr);

        const mapped = (globalRows ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          segment: r.segment,
        }));
        setAllTenants(mapped);
      } else {
        setAllTenants([]);
      }

      setVerified(true);
    } catch (err) {
      console.error("[TenantProvider:loadBaseData]", err);
      toast.error("Erro ao carregar contexto", {
        description: "Não foi possível carregar suas contas.",
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, authLoading, verified]);

  useEffect(() => {
    let ignore = false;
    if (!ignore) void loadBaseData();
    return () => { ignore = true; };
  }, [loadBaseData]);

  // Cálculo do Tenant Efetivo (memoizado para evitar re-renderers desnecessários)
  const availableTenants = useMemo(() => {
    // No Portal, não mostramos os tenants do painel administrativo
    if (location.pathname.startsWith("/portal")) return [];
    
    const fromMemberships = memberships.map((m) => m.tenants).filter((t): t is TenantRow => Boolean(t));
    const seen = new Set<string>();
    const result: TenantRow[] = [];
    for (const t of [...fromMemberships, ...(isSuperAdmin ? allTenants : [])]) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        result.push(t);
      }
    }
    return result;
  }, [memberships, allTenants, isSuperAdmin]);

  const effectiveTenantId = useMemo(() => {
    if (currentTenantId && availableTenants.some((t) => t.id === currentTenantId)) {
      return currentTenantId;
    }
    return availableTenants[0]?.id ?? null;
  }, [currentTenantId, availableTenants]);

  // Carrega unidades e configurações APENAS do tenant selecionado
  useEffect(() => {
    if (!effectiveTenantId) {
      setUnits([]);
      setLogosByTenant({});
      return;
    }

    let ignore = false;
    const loadTenantDetails = async () => {
      const [usRes, settingsRes] = await Promise.all([
        supabase
          .from("units")
          .select("id, tenant_id, name, is_default")
          .eq("tenant_id", effectiveTenantId)
          .order("is_default", { ascending: false }),
        supabase
          .from("tenant_settings")
          .select("tenant_id, logo_url")
          .eq("tenant_id", effectiveTenantId)
          .maybeSingle(),
      ]);

      if (ignore) return;
      if (usRes.error) console.error("[TenantProvider:units]", usRes.error);
      
      setUnits((usRes.data ?? []) as UnitRow[]);
      const map: Record<string, string | null> = {};
      if (settingsRes.data) {
        map[settingsRes.data.tenant_id] = settingsRes.data.logo_url ?? null;
      }
      setLogosByTenant(map);
    };

    void loadTenantDetails();
    return () => { ignore = true; };
  }, [effectiveTenantId]);

  async function impersonateTenant(id: string, reason?: string | null) {
    if (!isSuperAdmin) return;
    try {
      await supabase.rpc("admin_log_impersonation_start", { _tenant_id: id, _reason: reason ?? null });
    } catch (err) {
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
      localStorage.removeItem(STORAGE_KEY_TENANT);
      localStorage.removeItem(STORAGE_KEY_UNIT);
      setCurrentTenantIdState(null);
      setCurrentUnitIdState(null);
    }
  }

  const contextValue = useMemo<TenantContextValue>(() => {
    const currentTenant = availableTenants.find((t) => t.id === effectiveTenantId) ?? null;
    const availableUnits = units.filter((u) => u.tenant_id === effectiveTenantId);
    
    const effectiveUnitId = currentUnitId && availableUnits.some((u) => u.id === currentUnitId)
      ? currentUnitId
      : availableUnits[0]?.id ?? null;
    const currentUnit = availableUnits.find((u) => u.id === effectiveUnitId) ?? null;

    const membershipRole = memberships.find((m) => m.tenant_id === effectiveTenantId)?.role ?? null;
    const currentRole: Role | null = isSuperAdmin ? ("super_admin" as Role) : membershipRole;

    const hasActiveTenant = (memberships.length > 0 || isSuperAdmin) && !location.pathname.startsWith("/portal");
    const currentLogoUrl = effectiveTenantId ? logosByTenant[effectiveTenantId] ?? null : null;

    const isImpersonating = isSuperAdmin && !!effectiveTenantId && !memberships.some((m) => m.tenant_id === effectiveTenantId);

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
      isClient,
      setCurrentTenantId,
      setCurrentUnitId,
      impersonateTenant,
      endImpersonation,
      refresh: () => loadBaseData(true),
    };
  }, [
    loading, verified, memberships, availableTenants, effectiveTenantId, 
    units, currentUnitId, isSuperAdmin, logosByTenant, loadBaseData
  ]);

  return <TenantContext.Provider value={contextValue}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de <TenantProvider />");
  return ctx;
}
