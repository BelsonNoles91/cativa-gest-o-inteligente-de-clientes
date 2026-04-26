/**
 * PlanCard — exibe um plano (público ou privado) com features incluídas.
 */
import { Check, Star, Archive } from "lucide-react";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { billingPeriodLabels, formatPrice, planStatusLabels, type Plan, type PlanFeature } from "@/domain/billing";
import { cn } from "@/lib/utils";

interface Props {
  plan: Plan;
  features: PlanFeature[];
  highlight?: boolean;
}

export function PlanCard({ plan, features, highlight }: Props) {
  return (
    <div
      className={cn(
        "surface-card relative flex flex-col gap-4 p-5",
        highlight && "ring-2 ring-primary",
        plan.status === "archived" && "opacity-60",
      )}
    >
      {plan.isDefault && (
        <span className="absolute -top-2 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          <Star className="h-3 w-3" /> Recomendado
        </span>
      )}
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
          {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
        </div>
        <StatusBadge tone={plan.status === "public" ? "success" : plan.status === "archived" ? "neutral" : "info"}>
          {plan.status === "archived" ? <><Archive className="mr-1 h-3 w-3" />{planStatusLabels[plan.status]}</> : planStatusLabels[plan.status]}
        </StatusBadge>
      </header>

      <div>
        <p className="font-display text-3xl font-semibold">{formatPrice(plan.priceCents, plan.currency)}</p>
        <p className="text-xs text-muted-foreground">{billingPeriodLabels[plan.billingPeriod]} · trial {plan.trialDays}d · grace {plan.gracePeriodDays}d</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <Limit label="Unidades" value={plan.maxUnits} />
        <Limit label="Profissionais" value={plan.maxProfessionals} />
        <Limit label="Atendimentos/mês" value={plan.maxAppointmentsMonth} />
        <Limit label="Clientes ativos" value={plan.maxActiveClients} />
        <Limit label="Armazenamento" value={plan.maxStorageMb} suffix=" MB" />
      </dl>

      {features.length > 0 && (
        <ul className="space-y-1.5 border-t border-border/60 pt-3 text-xs">
          {features.map((f) => {
            const enabled = f.value === true || f.value === "true" || (typeof f.value === "number" && f.value > 0);
            return (
              <li key={f.id} className={cn("flex items-center gap-2", !enabled && "opacity-50")}>
                <Check className={cn("h-3.5 w-3.5 shrink-0", enabled ? "text-success" : "text-muted-foreground")} />
                <span>{f.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Limit({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value === null ? "Ilimitado" : `${value}${suffix ?? ""}`}</dd>
    </div>
  );
}
