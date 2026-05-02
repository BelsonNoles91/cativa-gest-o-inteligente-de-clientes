import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  locked?: boolean;
  collapsed?: boolean;
  tooltip?: string;
}

/**
 * SidebarNavItem — Componente padronizado para itens do menu lateral.
 * Garante área de clique completa, acessibilidade e estados visuais consistentes.
 */
export function SidebarNavItem({
  to,
  label,
  icon: Icon,
  isActive,
  locked,
  collapsed,
  tooltip,
}: SidebarNavItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={tooltip || (locked ? `${label} · plano necessário` : label)}
        isActive={isActive}
        className={cn(
          "group h-10 w-full transition-all duration-200",
          isActive && "bg-primary/10 text-primary font-semibold"
        )}
      >
        <Link
          to={to}
          className="flex w-full items-center gap-3 px-2 py-1.5"
          data-testid={`sidebar-nav-item-${label.toLowerCase().replace(/\s+/g, "-")}`}
          data-active={isActive}
        >
          <Icon 
            className={cn(
              "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )} 
          />
          <span className="truncate flex-1">{label}</span>
          
          {locked && !collapsed && (
            <Lock
              aria-label="Recurso bloqueado pelo plano"
              className="ml-auto h-3 w-3 text-muted-foreground/60"
            />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
