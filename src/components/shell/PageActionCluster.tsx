import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * SecondaryAction
 * Item compacto para o cluster de ações secundárias.
 * - icon: ícone obrigatório (Lucide ou similar)
 * - label: rótulo curto, exibido em sm: e usado no aria-label/tooltip
 * - loading: substitui o ícone por um spinner e desabilita cliques
 */
export type SecondaryAction = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  tooltip?: string;
};

export interface PageActionClusterProps {
  /** Ações secundárias agrupadas em segmented control */
  secondary?: SecondaryAction[];
  /** Botão principal (CTA) renderizado à direita do cluster */
  primary?: React.ReactNode;
  className?: string;
}

/**
 * PageActionCluster
 *
 * Padroniza o agrupamento de ações no header das páginas:
 * - Cluster compacto (segmented control) para ações secundárias com ícone + label responsivo
 * - CTA primário destacado à direita
 * - Mobile-first: rótulos somem em telas pequenas, mas tooltips e aria-labels permanecem
 * - Suporta estado de loading por ação (ex.: Atualizar)
 */
export function PageActionCluster({ secondary = [], primary, className }: PageActionClusterProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-end gap-2 sm:flex-nowrap",
        className,
      )}
    >
      {secondary.length > 0 ? (
        <div
          role="toolbar"
          aria-label="Ações secundárias"
          className="inline-flex min-w-0 items-center rounded-xl border border-border/70 bg-background/60 p-1 shadow-sm backdrop-blur"
        >
          {secondary.map((action, index) => {
            const Icon = action.icon;
            const isDisabled = action.disabled || action.loading;
            return (
              <React.Fragment key={action.key}>
                {index > 0 ? (
                  <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" />
                ) : null}
                <Tooltip delayDuration={250}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={action.onClick}
                      disabled={isDisabled}
                      aria-label={action.label}
                      className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors data-[disabled]:opacity-60"
                    >
                      {action.loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">{action.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {action.tooltip ?? action.label}
                  </TooltipContent>
                </Tooltip>
              </React.Fragment>
            );
          })}
        </div>
      ) : null}
      {primary ? <div className="flex shrink-0 items-center">{primary}</div> : null}
    </div>
  );
}

/**
 * Helper opcional para CTA primário com visual padronizado.
 */
export function PrimaryAction({ className, ...props }: ButtonProps) {
  return <Button {...props} className={cn("h-9 rounded-xl shadow-sm", className)} />;
}
