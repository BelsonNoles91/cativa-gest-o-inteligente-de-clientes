import { Link, useNavigate, useLocation } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import React, { useState, useEffect } from "react";

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
 * Agora com suporte a estados de carregamento, acessibilidade aprimorada e
 * navegação via teclado.
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
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setIsLoading(false);
  }, [location.pathname]);

  const handleNavigation = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (locked || isLoading) {
      e.preventDefault();
      return;
    }

    // Previne cliques duplos e navegação desnecessária
    if (isActive && to !== "#") {
      return;
    }

    // Se for um evento de teclado, verifica se é Enter ou Espaço
    if ("key" in e && e.key !== "Enter" && e.key !== " ") {
      return;
    }

    if ("preventDefault" in e) {
      e.preventDefault();
    }

    setIsLoading(true);
    
    // Pequeno atraso para feedback visual (opcional, mas bom para UX)
    // No uso real, o isLoading será resetado quando a rota mudar (unmount do componente)
    // ou podemos usar useLocation para limpar se o componente persistir.
    navigate(to);
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={tooltip || (locked ? `${label} · plano necessário` : label)}
        isActive={isActive}
        disabled={isLoading || locked}
        className={cn(
          "group h-10 w-full transition-all duration-200 relative",
          isActive && "bg-primary/10 text-primary font-semibold",
          isLoading && "opacity-70 cursor-wait",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
        )}
      >
        <Link
          to={locked ? "#" : to}
          onClick={handleNavigation}
          onKeyDown={handleNavigation}
          className={cn(
            "flex w-full items-center gap-3 px-2 py-1.5 focus:outline-none",
            locked && "cursor-not-allowed"
          )}
          aria-current={isActive ? "page" : undefined}
          aria-disabled={locked || isLoading}
          role="menuitem"
          tabIndex={0}
          data-testid={`sidebar-nav-item-${label.toLowerCase().replace(/\s+/g, "-")}`}
          data-active={isActive}
          data-loading={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : (
            <Icon 
              className={cn(
                "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} 
            />
          )}
          
          <span className={cn(
            "truncate flex-1 transition-colors",
            isLoading && "text-primary/70"
          )}>
            {label}
          </span>
          
          {locked && !collapsed && (
            <Lock
              aria-hidden="true"
              className="ml-auto h-3 w-3 text-muted-foreground/60"
            />
          )}
          
          {isLoading && !collapsed && (
            <span className="sr-only">Carregando...</span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

