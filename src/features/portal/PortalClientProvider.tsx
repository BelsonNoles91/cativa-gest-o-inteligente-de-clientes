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
      console.log("[PortalClientProvider] No user found, clearing context");
      setLinks([]);
      setProfile(null);
      setBranding(null);
      setPortalEnabled(true);
      setLoading(false);
      return;
    }
    
    console.log("[PortalClientProvider] Requesting load for user:", user.id);
    setLoading(true);
    try {
      await claimPortalLinksForCurrentUser();
      const ls = await listMyClientLinks(user.id);
      setLinks(ls);

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
          if (!sub) {
            setPortalEnabled(false);
          } else {
            const features = await listPlanFeatures([sub.planId]);
            const portalFeature = features.find((f) => f.featureKey === "client_portal");
            setPortalEnabled(isBooleanFeatureEnabled(portalFeature?.value));
          }
        } catch {
          // Em caso de erro de leitura, não bloqueia o cliente — falha aberto
          // para evitar lockout caso a tabela de billing fique indisponível.
          setPortalEnabled(true);
        }
      } else {
        setProfile(null);
        setBranding(null);
        setPortalEnabled(true);
      }
    } finally {
      setLoading(false);
    }
  }, [user, activeTenantId, authLoading]);

  useEffect(() => {
    void load();
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
      setActiveTenant,
      refresh: load,
    };
  }, [loading, links, activeTenantId, branding, profile, portalEnabled, setActiveTenant, load]);

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortalClient() {
  const ctx = useContext(PortalContext);
  if (!ctx)
    throw new Error("usePortalClient deve ser usado dentro de <PortalClientProvider />");
  return ctx;
}
