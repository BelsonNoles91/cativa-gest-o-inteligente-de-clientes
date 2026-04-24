/**
 * Billing — visão do OWNER do tenant sobre seu próprio plano, limites e consumo.
 *
 * NÃO é módulo fiscal. É a tela "Meu plano" do SaaS.
 */
import { Loader2, CreditCard, Sparkles, AlertTriangle, Calendar, History, Layers3 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PlanCard } from "@/features/billing/PlanCard";
import { UsageBar } from "@/features/billing/UsageBar";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import {
  eventLabels,
  formatPrice,
  isInGracePeriod,
  subscriptionStatusLabels,
  subscriptionStatusTone,
  trialDaysLeft,
} from "@/domain/billing";

export default function Billing() {
  const { loading, subscription, plan, allPlans, features, flags, usage, limits, events } = useTenantBilling();

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription || !plan) {
    return (
      <>
        <PageHeader title="Meu plano" description="Você ainda não tem assinatura associada. Fale com o suporte." icon={<CreditCard className="h-5 w-5" />} />
        <div className="surface-card p-6 text-sm text-muted-foreground">Assinatura não encontrada.</div>
      </>
    );
  }

  const trialLeft = trialDaysLeft(subscription);
  const inGrace = isInGracePeriod(subscription, plan);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meu plano"
        description="Veja seu plano atual, limites, consumo e funcionalidades."
        icon={<CreditCard className="h-5 w-5" />}
        actions={
          <StatusBadge tone={subscriptionStatusTone[subscription.status]}>
            {subscriptionStatusLabels[subscription.status]}
          </StatusBadge>
        }
      />

      {(subscription.status === "trialing" && trialLeft !== null && trialLeft <= 7) || inGrace ? (
        <div className="surface-card flex items-start gap-3 border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground" />
          <div className="text-xs leading-relaxed text-warning-foreground">
            {inGrace
              ? `Sua assinatura está em período de tolerância. Regularize em até ${plan.gracePeriodDays} dias.`
              : `Seu trial termina em ${trialLeft} ${trialLeft === 1 ? "dia" : "dias"}.`}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="surface-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Consumo atual
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <UsageBar label="Unidades" used={usage.unitsCount} limit={limits?.maxUnits ?? null} />
              <UsageBar label="Profissionais ativos" used={usage.professionalsCount} limit={limits?.maxProfessionals ?? null} />
              <UsageBar label="Clientes ativos" used={usage.activeClientsCount} limit={limits?.maxActiveClients ?? null} />
              <UsageBar label="Armazenamento" used={usage.storageMb} limit={limits?.maxStorageMb ?? null} suffix=" MB" />
              <UsageBar label="Agendamentos (30d)" used={usage.appointmentsLast30d} limit={null} />
            </div>
          </div>

          <div className="surface-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <Layers3 className="h-4 w-4 text-primary" /> Limites efetivos
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Unidades" value={formatLimit(limits?.maxUnits ?? null)} />
              <Detail label="Profissionais" value={formatLimit(limits?.maxProfessionals ?? null)} />
              <Detail label="Clientes ativos" value={formatLimit(limits?.maxActiveClients ?? null)} />
              <Detail label="Armazenamento" value={formatLimit(limits?.maxStorageMb ?? null, " MB")} />
            </dl>
          </div>

          <div className="surface-card p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Detalhes da assinatura</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Início do período" value={formatDate(subscription.currentPeriodStart)} />
              <Detail label="Fim do período" value={subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "—"} />
              <Detail label="Trial até" value={subscription.trialEndsAt ? formatDate(subscription.trialEndsAt) : "—"} />
              <Detail
                label="Desconto"
                value={subscription.discountCents > 0 ? `${formatPrice(subscription.discountCents)} ${subscription.discountReason ? `· ${subscription.discountReason}` : ""}` : "—"}
              />
            </dl>
          </div>

          {events.length > 0 && (
            <div className="surface-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                <History className="h-4 w-4 text-primary" /> Histórico recente
              </h2>
              <ul className="space-y-2 text-sm">
                {events.slice(0, 8).map((event) => (
                  <li key={event.id} className="rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{eventLabels[event.eventType]}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                    </div>
                    {event.notes && <p className="mt-1 text-xs text-muted-foreground">{event.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {flags.length > 0 && (
            <div className="surface-card p-5">
              <h2 className="mb-3 font-display text-lg font-semibold">Funcionalidades habilitadas</h2>
              <ul className="space-y-1.5 text-sm">
                {flags.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                    <span>{f.label}</span>
                    <StatusBadge tone={f.value === true ? "success" : "neutral"}>
                      {f.value === true ? "ativa" : "inativa"}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <PlanCard plan={plan} features={features} highlight />
          {allPlans.filter((item) => item.status !== "archived" && item.id !== plan.id).length > 0 && (
            <div className="surface-card space-y-3 p-5">
              <h2 className="font-display text-lg font-semibold">Outros planos disponíveis</h2>
              <div className="space-y-3">
                {allPlans
                  .filter((item) => item.status !== "archived" && item.id !== plan.id)
                  .map((item) => (
                    <div key={item.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.description ?? "Sem descrição"}</p>
                        </div>
                        <span className="text-sm font-semibold">{formatPrice(item.priceCents, item.currency)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          <p className="px-1 text-xs text-muted-foreground">
            Para mudar de plano, fale com o suporte. A integração com pagamento será adicionada em breve.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Calendar className="h-3 w-3" /> {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatLimit(value: number | null, suffix = ""): string {
  return value === null ? "Ilimitado" : `${value.toLocaleString("pt-BR")}${suffix}`;
}
