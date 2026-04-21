/**
 * PageHeader — cabeçalho padrão de página interna.
 * Mantém consistência visual em todas as telas do app.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-soft text-primary shadow-xs">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground md:text-[15px]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
