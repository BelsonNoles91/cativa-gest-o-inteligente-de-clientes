/**
 * BottomNav — navegação inferior mobile.
 * Mostra apenas itens com showInBottomNav=true e respeita roles.
 */
import { NavLink } from "@/components/NavLink";
import { navItems } from "@/config/navigation";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { canAccess } from "@/domain/roles";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { currentRole } = useTenant();
  const { hasFeature } = useTenantBilling();
  const items = navItems
    .filter(
      (i) =>
        i.showInBottomNav &&
        canAccess(currentRole, i.roles) &&
        (!i.featureKey || hasFeature(i.featureKey)),
    )
    .slice(0, 5);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md pb-safe md:hidden"
    >
      <ul className="grid grid-cols-4 px-1 pt-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/app"}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-medium",
                "text-muted-foreground hover:text-foreground transition-colors",
              )}
              activeClassName="text-primary"
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
