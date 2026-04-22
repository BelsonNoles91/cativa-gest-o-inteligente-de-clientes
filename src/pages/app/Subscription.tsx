/**
 * Assinatura — visão enxuta do plano atual com:
 *  - Resumo do plano (nome, preço, ciclo)
 *  - Trial restante / período atual
 *  - Botão "Reativar/Ativar trial" via RPC `start_default_trial`
 *    disponível APENAS para owner / manager (super_admin também).
 *  - Mensagens de erro claras quando a RLS bloqueia (42501) ou quando
 *    não há plano disponível.
 *
 * Esta tela é intencionalmente compacta e focada — complementa
 * `/app/meu-plano` (Billing), que mostra consumo, limites, histórico
 * e funcionalidades. Aqui o foco é o ciclo de vida da assinatura.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Crown,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { activateDefaultTrial } from "@/services/billing/activateTrial";
import { useToast } from "@/hooks/use-toast";
import {
  billingPeriodLabels,
  formatPrice,
  isInGracePeriod,
  subscriptionStatusLabels,
  subscriptionStatusTone,
  trialDaysLeft,
} from "@/domain/billing";

export default function Subscription() {
  const { currentTenant, currentRole, isSuperAdmin } = useTenant();
  const { loading, subscription, plan, refresh } = useTenantBilling();
  const { toast } = useToast();
  const [isActing, setIsActing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManage = useMemo(
    () => isSuperAdmin || currentRole === "owner" || currentRole === "manager",
    [isSuperAdmin, currentRole],
  );

  const trialLeft = subscription ? trialDaysLeft(subscription) : null;
  const inGrace = subscription && plan ? isInGracePeriod(subscription, plan) : false;

  const handleActivateOrReactivate = async () => {
    if (!currentTenant) return;
    setErrorMessage(null);
    setIsActing(true);
    try {
      const result = await activateDefaultTrial(currentTenant.id);
      await refresh();
      toast({
        title: result.alreadyExisted
          ? "Assinatura já existente"
          : "Trial ativado",
        description: result.alreadyExisted
          ? `Sua assinatura no plano ${result.plan.name} já estava registrada.`
          : `Plano ${result.plan.name} iniciado com sucesso.`,
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Erro desconhecido.";
      // Mensagens claras para casos típicos de RLS / configuração.
      let friendly = raw;
      if (/permission|permissão|42501|policy|RLS/i.test(raw)) {
        friendly =
          "Acesso negado pelas regras de segurança. Apenas owner ou manager podem ativar a assinatura deste tenant.";
      } else if (/Nenhum plano/i.test(raw)) {
        friendly =
          "Nenhum plano padrão foi configurado. Peça ao suporte para publicar um plano marcado como padrão.";
      }
      setErrorMessage(friendly);
      toast({
        title: "Não foi possível processar",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setIsActing(false);
    }
  };

  if (loading) {
    return <SubscriptionSkeleton />;
  }

  return (
    <div className="space-y-4" data-testid="subscription-page">
      <PageHeader
        title="Assinatura"
        description="Resumo do seu plano, status e ações de assinatura."
        icon={<CreditCard className="h-5 w-5" />}
        actions={
          subscription ? (
            <StatusBadge tone={subscriptionStatusTone[subscription.status]}>
              {subscriptionStatusLabels[subscription.status]}
            </StatusBadge>
          ) : null
        }
      />

      {/* Aviso quando não há permissão para gerenciar */}
      {!canManage && (
        <div
          className="surface-card flex items-start gap-3 border border-warning/40 bg-warning/10 p-4"
          data-testid="subscription-no-permission"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 text-warning-foreground" />
          <div className="text-xs leading-relaxed text-warning-foreground">
            Você está vendo esta tela em modo somente leitura. Para alterar o
            plano ou ativar a assinatura, peça ao owner ou manager do tenant.
          </div>
        </div>
      )}

      {/* Sem assinatura: oferece ativação */}
      {!subscription || !plan ? (
        <div className="surface-card space-y-4 p-6" data-testid="subscription-empty">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-display text-lg font-semibold">
                Nenhuma assinatura ativa
              </h2>
              <p className="text-sm text-muted-foreground">
                Ative o trial padrão para liberar todos os módulos e começar
                a operar agora mesmo.
              </p>
            </div>
          </div>

          {errorMessage && (
            <ErrorBlock message={errorMessage} onDismiss={() => setErrorMessage(null)} />
          )}

          <div>
            <Button
              type="button"
              onClick={handleActivateOrReactivate}
              disabled={!canManage || isActing}
              data-testid="subscription-activate-trial"
              data-critical-action="activate-trial"
            >
              {isActing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ativando…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Ativar trial padrão
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Resumo do plano */}
          <section className="surface-card p-5 lg:col-span-2" data-testid="subscription-summary">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Plano atual
                </p>
                <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
                  <Crown className="h-5 w-5 text-primary" /> {plan.name}
                </h2>
                {plan.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-semibold" data-testid="subscription-price">
                  {formatPrice(plan.priceCents, plan.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {billingPeriodLabels[plan.billingPeriod]}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat
                label="Status"
                value={subscriptionStatusLabels[subscription.status]}
              />
              <Stat
                label="Início do período"
                value={formatDate(subscription.currentPeriodStart)}
              />
              <Stat
                label="Próxima renovação"
                value={
                  subscription.currentPeriodEnd
                    ? formatDate(subscription.currentPeriodEnd)
                    : "—"
                }
              />
            </div>

            {/* Trial countdown */}
            {subscription.status === "trialing" && trialLeft !== null && (
              <div
                className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4"
                data-testid="subscription-trial-countdown"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {trialLeft > 0
                      ? `Trial restante: ${trialLeft} ${trialLeft === 1 ? "dia" : "dias"}`
                      : "Trial expirado"}
                  </div>
                  {subscription.trialEndsAt && (
                    <span className="text-xs text-muted-foreground">
                      até {formatDate(subscription.trialEndsAt)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Grace period warning */}
            {inGrace && (
              <div
                className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-4"
                data-testid="subscription-grace-warning"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground" />
                  <div className="text-xs leading-relaxed text-warning-foreground">
                    Sua assinatura está em período de tolerância. Regularize em
                    até {plan.gracePeriodDays} dias para evitar suspensão.
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Ações */}
          <aside className="surface-card space-y-4 p-5" data-testid="subscription-actions">
            <h3 className="font-display text-base font-semibold">Ações</h3>

            {errorMessage && (
              <ErrorBlock message={errorMessage} onDismiss={() => setErrorMessage(null)} />
            )}

            {(subscription.status === "canceled" ||
              subscription.status === "suspended") && (
              <Button
                type="button"
                onClick={handleActivateOrReactivate}
                disabled={!canManage || isActing}
                className="w-full"
                data-testid="subscription-reactivate"
                data-critical-action="reactivate-subscription"
              >
                {isActing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reativando…
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Reativar assinatura
                  </>
                )}
              </Button>
            )}

            {subscription.status === "overdue" && (
              <Button
                type="button"
                onClick={handleActivateOrReactivate}
                disabled={!canManage || isActing}
                className="w-full"
                data-testid="subscription-regularize"
                data-critical-action="regularize-subscription"
              >
                {isActing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando…
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Tentar regularizar
                  </>
                )}
              </Button>
            )}

            {(subscription.status === "active" ||
              subscription.status === "trialing") && (
              <div className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-xs text-success-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Sua assinatura está em dia. Não há ações pendentes.
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Para mudar de plano, alterar limites ou cancelar, fale com o suporte.
              A integração com pagamentos será conectada em breve.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function ErrorBlock({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
      data-testid="subscription-error"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1 text-xs leading-relaxed text-destructive">
        {message}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[11px] font-medium text-destructive underline-offset-2 hover:underline"
      >
        Fechar
      </button>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
