/**
 * PortalClientProvider — escopo do portal do cliente.
 *
 * - Carrega vínculos `client_users` do usuário autenticado.
 * - Permite escolher tenant ativo (se houver mais de um).
 * - Expõe branding do tenant + perfil do cliente para o portal.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  claimPortalLinksForCurrentUser,
  getClientProfile,
  getPortalBranding,
  listMyClientLinks,
  touchPortalLink,
  type ClientProfile,
} from "@/repositories/portal";
import {
  getSubscriptionByTenant,
  listPlanFeatures,
} from "@/repositories/billing";
import { isBooleanFeatureEnabled } from "@/domain/billing";
import { handleError } from "@/lib/error-handler";
import type {
  ClientUserLink,
  PortalTenantBranding,
} from "@/domain/portal";

interface PortalContextValue {
  loading: boolean;
  links: ClientUserLink[];
  activeLink: ClientUserLink | null;
  branding: PortalTenantBranding | null;
  profile: ClientProfile | null;
  /** Indica se o tenant ativo possui a feature `client_portal` no plano. */
  portalEnabled: boolean;
  /** Nome de cada estabelecimento onde o cliente é atendido. */
  tenantNames: Record<string, string>;
  setActiveTenant: (tenantId: string) => void;
  refresh: () => Promise<void>;
}

const PortalContext = createContext<PortalContextValue | undefined>(undefined);
const LS_PORTAL_TENANT = "cativa.portal.tenantId";

export function PortalClientProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<ClientUserLink[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [branding, setBranding] = useState<PortalTenantBranding | null>(null);
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(
    () => localStorage.getItem(LS_PORTAL_TENANT),
  );

  const setActiveTenant = useCallback((tenantId: string) => {
    localStorage.setItem(LS_PORTAL_TENANT, tenantId);
    setActiveTenantIdState(tenantId);
  }, []);

  const load = useCallback(async () => {
    // Se ainda estamos carregando auth, não faz nada
    if (authLoading) return;

    if (!user) {
      setLinks([]);
      setProfile(null);
      setBranding(null);
      setPortalEnabled(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await claimPortalLinksForCurrentUser();
      const ls = await listMyClientLinks(user.id);
      setLinks(ls);
      if (ls.length > 0) {
        const { data: ts } = await supabase
          .from("tenants")
          .select("id, name")
          .in("id", ls.map((l) => l.tenantId));
        setTenantNames(Object.fromEntries((ts ?? []).map((t) => [t.id as string, t.name as string])));
      }

      // escolha do tenant ativo
      const effective =
        ls.find((l) => l.tenantId === activeTenantId) ?? ls[0] ?? null;
      
      if (effective) {
        if (effective.tenantId !== activeTenantId) {
          setActiveTenantIdState(effective.tenantId);
          localStorage.setItem(LS_PORTAL_TENANT, effective.tenantId);
        }
        
        void touchPortalLink(effective.id).catch(() => undefined);
        const prof = await getClientProfile(effective.clientId);
        setProfile(prof);
        const b = await getPortalBranding(effective.tenantId, prof?.preferredUnitId ?? null);
        setBranding(b);

        // Verifica se o plano do tenant ativo libera o portal do cliente.
        try {
          const sub = await getSubscriptionByTenant(effective.tenantId);
          // Portal do cliente faz parte de todos os planos, inclusive o gratuito.
          // Só bloqueia se um plano desligar explicitamente a feature.
          if (!sub) {
            setPortalEnabled(true);
          } else {
            const features = await listPlanFeatures([sub.planId]);
            const portalFeature = features.find((f) => f.featureKey === "client_portal");
            setPortalEnabled(portalFeature ? isBooleanFeatureEnabled(portalFeature.value) : true);
          }
        } catch (billingErr) {
          handleError(billingErr, {
            category: "DATABASE",
            context: { source: "PortalClientProvider.portalEnabled" },
            silent: true,
          });
          // Fail-open: não bloqueia o cliente se billing estiver indisponível.
          setPortalEnabled(true);
        }
      } else {
        setProfile(null);
        setBranding(null);
        setPortalEnabled(true);
      }
    } catch (err) {
      handleError(err, {
        category: "DATABASE",
        context: { source: "PortalClientProvider.load" },
        silent: true,
      });
    } finally {
      setLoading(false);
    }
  }, [user, activeTenantId, authLoading]);

  useEffect(() => {
    let ignore = false;
    if (!ignore) void load();
    return () => { ignore = true; };
  }, [load]);

  const value = useMemo<PortalContextValue>(() => {
    const activeLink =
      links.find((l) => l.tenantId === activeTenantId) ?? links[0] ?? null;
    return {
      loading,
      links,
      activeLink,
      branding,
      profile,
      portalEnabled,
      tenantNames,
      setActiveTenant,
      refresh: load,
    };
  }, [loading, links, activeTenantId, branding, profile, portalEnabled, tenantNames, setActiveTenant, load]);

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortalClient() {
  const ctx = useContext(PortalContext);
  if (!ctx)
    throw new Error("usePortalClient deve ser usado dentro de <PortalClientProvider />");
  return ctx;
}
