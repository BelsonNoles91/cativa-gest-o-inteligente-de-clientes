/**
 * TenantProvider — agora carrega memberships reais do usuário autenticado.
 *
 * Super admin: além dos memberships próprios, recebe a lista global de tenants
 * via RPC `admin_list_all_tenants` e pode impersonar qualquer um (com auditoria).
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
  const location = useLocation();
  const navigate = useNavigate();
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
    localStorage.removeItem(LS_UNIT);
    setCurrentUnitIdState(null);
  };

  const setCurrentUnitId = (id: string) => {
    localStorage.setItem(LS_UNIT, id);
    setCurrentUnitIdState(id);
  };

  const loadBaseData = useCallback(async () => {
    // Se ainda estamos carregando auth, não faz nada
    if (authLoading) return;

    // Se estivermos em uma rota de portal, o TenantProvider não deve atuar
    // O PortalClientProvider cuidará do contexto do cliente
    if (location.pathname.startsWith("/portal")) {
      setLoading(false);
      setVerified(true);
      return;
    }

    if (!user) {
      console.log("[TenantProvider] No user found, clearing context");
      setMemberships([]);
      setAllTenants([]);
      setUnits([]);
      setIsSuperAdmin(false);
      try {
        localStorage.removeItem(LS_TENANT);
        localStorage.removeItem(LS_UNIT);
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
    try {
      const [{ data: profile, error: profileErr }, { data: memb, error: membErr }] = await Promise.all([
        supabase.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle(),
        supabase
          .from("tenant_memberships")
          .select("tenant_id, role, tenants:tenants!inner(id, name, slug, segment)")
          .eq("user_id", user.id)
          .eq("status", "active"),
      ]);

      if (profileErr || membErr) throw profileErr || membErr;

      const superAdmin = Boolean(profile?.is_super_admin);
      setIsSuperAdmin(superAdmin);
      
      const membershipList = (memb ?? []) as unknown as MembershipRow[];
      setMemberships(membershipList);

      // Se o usuário não é super admin e não tem nenhum membership ativo, 
      // mas está tentando acessar o /app, mandamos para onboarding
      if (!superAdmin && membershipList.length === 0 && location.pathname.startsWith("/app")) {
        console.log("[TenantProvider] No active memberships found, redirecting to onboarding");
        navigate("/onboarding", { replace: true });
        return;
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
  }, [user?.id, authLoading, location.pathname, navigate]);

  useEffect(() => {
    void loadBaseData();
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
      localStorage.removeItem(LS_TENANT);
      localStorage.removeItem(LS_UNIT);
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
      setCurrentTenantId,
      setCurrentUnitId,
      impersonateTenant,
      endImpersonation,
      refresh: loadBaseData,
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
