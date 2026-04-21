/**
 * CativaIndexCard — cartão hero do Índice Cativa.
 */
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { indexLabel, type CativaIndexBreakdown } from "@/domain/analytics";

interface Props {
  breakdown: CativaIndexBreakdown;
  scope: string;
}

export function CativaIndexCard({ breakdown, scope }: Props) {
  const { label, tone } = indexLabel(breakdown.score);
  const bottlenecks = breakdown.components.filter((c) => c.isBottleneck);
  const strengths = breakdown.components.filter((c) => c.isStrength);

  return (
    <section className="surface-card overflow-hidden">
      <div className="bg-gradient-brand p-5 text-primary-foreground md:p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
          <Sparkles className="h-3.5 w-3.5" /> Índice Cativa · {scope}
        </div>
        <div className="mt-2 flex items-end gap-3">
          <span className="font-display text-5xl font-semibold leading-none">{breakdown.score}</span>
          <span className="pb-1 text-sm opacity-85">/ 100</span>
          <StatusBadge tone={tone} className="ml-2 mb-1">
            {label}
          </StatusBadge>
        </div>
        <p className="mt-2 text-sm opacity-90">
          Score proprietário que combina retenção, rebooking, confirmação, ocupação,
          recuperação de no-show, adesão à janela ideal, completude do CRM e valor futuro.
        </p>
      </div>

      <div className="space-y-4 p-5 md:p-6">
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Composição
          </h4>
          <ul className="space-y-2.5">
            {breakdown.components.map((c) => (
              <li key={c.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {c.label}{" "}
                    <span className="text-muted-foreground">· peso {c.weight}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.valuePct.toFixed(1)}%
                  </span>
                </div>
                <Progress value={c.valuePct} className="h-1.5" />
              </li>
            ))}
          </ul>
        </div>

        {bottlenecks.length > 0 && (
          <div className="rounded-lg bg-warning/10 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warning-foreground">
              <TrendingDown className="h-3.5 w-3.5" /> Principais gargalos
            </p>
            <ul className="space-y-0.5 text-xs text-warning-foreground/90">
              {bottlenecks.map((b) => (
                <li key={b.key}>
                  • {b.label} — {b.valuePct.toFixed(0)}% (peso {b.weight})
                </li>
              ))}
            </ul>
          </div>
        )}

        {strengths.length > 0 && (
          <div className="rounded-lg bg-success/10 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-success">
              <TrendingUp className="h-3.5 w-3.5" /> Pontos fortes
            </p>
            <ul className="space-y-0.5 text-xs text-success/90">
              {strengths.map((s) => (
                <li key={s.key}>
                  • {s.label} — {s.valuePct.toFixed(0)}%
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
