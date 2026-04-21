/**
 * NextBestActions — bloco de ações recomendadas com base no estado do negócio.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import type { NextBestAction } from "@/domain/analytics";

const impactTone = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

const impactLabel = {
  high: "Alto impacto",
  medium: "Médio",
  low: "Baixo",
} as const;

export function NextBestActions({ actions }: { actions: NextBestAction[] }) {
  return (
    <section className="surface-card p-5 md:p-6">
      <header className="mb-4 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent-foreground">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Next Best Action</h2>
          <p className="text-xs text-muted-foreground">
            Recomendações acionáveis com base nas métricas atuais
          </p>
        </div>
      </header>

      {actions.length === 0 ? (
        <div className="rounded-lg bg-success/10 p-4 text-sm text-success">
          🎉 Nenhuma ação urgente recomendada no momento. Continue assim!
        </div>
      ) : (
        <ul className="space-y-2.5">
          {actions.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 md:flex-row md:items-center md:gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <StatusBadge tone={impactTone[a.impact]} className="text-[10px]">
                    {impactLabel[a.impact]}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to={a.ctaTo}>
                  {a.ctaLabel} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
