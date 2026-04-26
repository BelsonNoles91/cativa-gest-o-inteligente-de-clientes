/**
 * AppSidebar — navegação principal no desktop.
 * Mobile usa BottomNav. Sidebar colapsa em modo "icon".
 */
import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
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
                {items.map((item) => {
                  const active = isActive(item.to);
                  const locked = Boolean(item.featureKey) && !hasFeature(item.featureKey!);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        tooltip={locked ? `${item.label} · plano necessário` : item.label}
                        isActive={active}
                      >
                        <NavLink
                          to={item.to}
                          end={item.to === "/app"}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                            active
                              ? "bg-primary-soft text-primary"
                              : "text-foreground/75 hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {locked && !collapsed && (
                            <Lock
                              aria-label="Recurso bloqueado pelo plano"
                              className="ml-auto h-3 w-3 text-muted-foreground"
                            />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
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
