/**
 * KpiCard — cartão padrão de KPI.
 */
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "brand" | "success" | "warning" | "danger" | "info" | "neutral";
  trendPct?: number;
}

const toneStyles: Record<NonNullable<Props["tone"]>, string> = {
  brand: "bg-primary-soft text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-accent-soft text-accent-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function KpiCard({ label, value, hint, icon: Icon, tone = "brand", trendPct }: Props) {
  return (
    <div className="surface-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        {Icon && (
          <div className={cn("grid h-9 w-9 place-items-center rounded-lg", toneStyles[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        {typeof trendPct === "number" && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              trendPct >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {trendPct >= 0 ? "+" : ""}
            {trendPct}%
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
