/**
 * Banner exibido quando o tenant atual não possui assinatura.
 * Oferece ação rápida para ativar um trial padrão.
 *
 * Variantes:
 * - "panel"  → versão completa (Dashboard, etc.)
 * - "sidebar"→ versão compacta para o rodapé do sidebar
 */
import { useState } from "react";
import { Sparkles, Rocket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { activateDefaultTrial } from "@/services/billing/activateTrial";
import { cn } from "@/lib/utils";

interface NoSubscriptionBannerProps {
  variant?: "panel" | "sidebar";
  className?: string;
}

export function NoSubscriptionBanner({
  variant = "panel",
  className,
}: NoSubscriptionBannerProps) {
  const { currentTenant } = useTenant();
  const { loading, subscription, refresh } = useTenantBilling();
  const { toast } = useToast();
  const [activating, setActivating] = useState(false);

  // Não exibir enquanto carrega ou se já existe assinatura
  if (loading || subscription || !currentTenant) return null;

  async function handleActivate() {
    if (!currentTenant) return;
    setActivating(true);
    try {
      const result = await activateDefaultTrial(currentTenant.id);
      toast({
        title: result.alreadyExisted
          ? "Assinatura já estava ativa"
          : "Trial ativado com sucesso",
        description: result.alreadyExisted
          ? `${result.plan.name} já está vinculado a ${currentTenant.name}.`
          : `Você ganhou ${result.plan.trialDays} dias do plano ${result.plan.name}.`,
      });
      await refresh();
    } catch (error) {
      toast({
        title: "Não foi possível ativar o trial",
        description:
          error instanceof Error ? error.message : "Erro inesperado ao iniciar o trial.",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  }

  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "rounded-xl border border-warning/30 bg-warning-soft/60 p-3",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-warning-foreground" />
          <p className="text-xs font-semibold text-warning-foreground">Sem assinatura</p>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Ative um trial padrão para liberar todos os módulos.
        </p>
        <Button
          size="sm"
          className="mt-2 h-8 w-full rounded-lg text-xs"
          onClick={handleActivate}
          disabled={activating}
        >
          {activating ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Ativando…
            </>
          ) : (
            <>
              <Rocket className="mr-1.5 h-3 w-3" /> Ativar trial
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-card flex flex-col gap-3 border-warning/30 bg-warning-soft/40 p-4 md:flex-row md:items-center md:justify-between md:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning text-warning-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold">Sem assinatura ativa</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Este tenant ainda não possui um plano vinculado. Ative o trial padrão para
            destravar agenda, clientes, pacotes e relatórios sem cartão.
          </p>
        </div>
      </div>
      <Button
        className="rounded-xl bg-gradient-brand md:shrink-0"
        onClick={handleActivate}
        disabled={activating}
      >
        {activating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ativando trial…
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-4 w-4" /> Ativar trial padrão
          </>
        )}
      </Button>
    </div>
  );
}
