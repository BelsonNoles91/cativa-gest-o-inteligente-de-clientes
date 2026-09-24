/**
 * UsageBar — barra de consumo vs limite. Mostra alerta visual quando >= 80%.
 */
import { Progress } from "@/components/ui/progress";
import { isUsageBlocked, isUsageWarning, usagePct } from "@/domain/billing";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  used: number;
  limit: number | null;
  suffix?: string;
}

export function UsageBar({ label, used, limit, suffix }: Props) {
  const pct = usagePct(used, limit);
  const blocked = isUsageBlocked(used, limit);
  const warn = isUsageWarning(used, limit);
  const value = pct === null ? 0 : Math.round(pct * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "tabular-nums",
            blocked ? "text-destructive font-semibold" : warn ? "text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {used.toLocaleString("pt-BR")}
          {suffix ?? ""} {limit !== null && <>· {limit.toLocaleString("pt-BR")}{suffix ?? ""}</>}
        </span>
      </div>
      <Progress
        value={value}
        className={cn("h-1.5", blocked && "[&>div]:bg-destructive", warn && !blocked && "[&>div]:bg-warning")}
      />
      {limit === null && <p className="text-xs text-muted-foreground">Sem limite no seu plano</p>}
    </div>
  );
}
