/**
 * KpiCard — cartão padrão de KPI.
 *
 * Modo compacto automático: quando a altura da viewport é menor que 800px
 * (ex.: laptops 1366×768), reduz padding, ícone, gaps e tipografia para
 * manter o conteúdo visível sem scroll.
 */
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useShortViewport } from "@/hooks/use-short-viewport";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "brand" | "success" | "warning" | "danger" | "info" | "neutral";
  trendPct?: number;
  /** Força o modo compacto independentemente da altura da tela. */
  compact?: boolean;
}

const toneStyles: Record<NonNullable<Props["tone"]>, string> = {
  brand: "bg-primary-soft text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground dark:text-warning",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-accent-soft text-accent-foreground dark:text-accent-strong",
  neutral: "bg-muted text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  trendPct,
  compact: compactProp,
}: Props) {
  const shortViewport = useShortViewport(800);
  const compact = compactProp ?? shortViewport;

  return (
    <div
      className={cn("surface-card", compact ? "p-3" : "p-4 md:p-5")}
      data-compact={compact || undefined}
    >
      <div className={cn("flex items-center justify-between", compact ? "gap-1.5" : "gap-2")}>
        {Icon && (
          <div
            className={cn(
              "grid place-items-center rounded-lg shrink-0",
              compact ? "h-7 w-7" : "h-9 w-9",
              toneStyles[tone],
            )}
          >
            <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          </div>
        )}
        {typeof trendPct === "number" && (
          <span
            className={cn(
              "rounded-full font-medium",
              compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
              trendPct >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {trendPct >= 0 ? "+" : ""}
            {trendPct}%
          </span>
        )}
      </div>
      <p className={cn("text-muted-foreground", compact ? "mt-2 text-[11px]" : "mt-3 text-xs")}>
        {label}
      </p>
      <p
        className={cn(
          "font-display font-semibold",
          compact ? "text-xl leading-tight" : "text-2xl",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className={cn("text-muted-foreground", compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs")}>
          {hint}
        </p>
      )}
    </div>
  );
}
