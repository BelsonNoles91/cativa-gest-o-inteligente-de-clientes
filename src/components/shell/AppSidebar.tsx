/**
 * AppSidebar — navegação principal no desktop.
 * Mobile usa BottomNav. Sidebar colapsa em modo "icon".
 */
import { useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarNavItem } from "./SidebarNavItem";
import { navItems } from "@/config/navigation";
import { Logo } from "@/components/brand/Logo";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { canAccess } from "@/domain/roles";
import { subscriptionStatusLabels } from "@/domain/billing";
import { NoSubscriptionBanner } from "@/features/billing/NoSubscriptionBanner";
import { cn } from "@/lib/utils";

const groupLabels: Record<string, string> = {
  operacao: "Operação",
  gestao: "Gestão",
  sistema: "Sistema",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { currentRole } = useTenant();
  const { loading, plan, subscription, hasFeature } = useTenantBilling();

  const groups = useMemo(() => ["operacao", "gestao", "sistema"] as const, []);
  
  const isActive = useCallback((to: string) =>
    to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(to), [location.pathname]);

  const canPreviewLockedFeatures = useMemo(() =>
    currentRole === "owner" || currentRole === "manager" || currentRole === "super_admin", [currentRole]);

  const renderedGroups = useMemo(() => {
    return groups.map((g) => {
      const items = navItems.filter(
        (i) =>
          i.group === g &&
          canAccess(currentRole, i.roles) &&
          (!i.featureKey || hasFeature(i.featureKey) || canPreviewLockedFeatures),
      );
      if (items.length === 0) return null;
      return { g, items };
    }).filter(Boolean) as { g: "operacao" | "gestao" | "sistema"; items: typeof navItems }[];
  }, [groups, currentRole, hasFeature, canPreviewLockedFeatures]);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/70">
      <SidebarHeader className="px-3 py-4">
        <Logo showWordmark={!collapsed} size={collapsed ? "sm" : "md"} />
      </SidebarHeader>

      <SidebarContent className="px-2">
        {renderedGroups.map(({ g, items }) => (
          <SidebarGroup key={g}>
            {!collapsed && <SidebarGroupLabel>{groupLabels[g]}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarNavItem
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    isActive={isActive(item.to)}
                    locked={Boolean(item.featureKey) && !hasFeature(item.featureKey!)}
                    collapsed={collapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        {!collapsed && (
          <>
            {!loading && !subscription ? (
              <NoSubscriptionBanner variant="sidebar" />
            ) : (
              <div className="rounded-xl border border-border/70 bg-gradient-soft p-3">
                <p className="text-xs font-medium text-primary">
                  {loading ? "Carregando plano…" : plan?.name ?? "Sem plano"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {subscription
                    ? subscriptionStatusLabels[subscription.status]
                    : "Sem assinatura"}
                </p>
              </div>
            )}
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
