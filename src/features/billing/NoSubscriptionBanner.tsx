/**
 * Banner exibido quando o tenant atual não possui assinatura.
 *
 * Comportamento por papel:
 * - Owner/Manager → "Escolha um plano" (CTA para /app/assinatura)
 * - Frontdesk/Professional → "Aguardando ativação do gestor" (sem CTA)
 *
 * Variantes:
 * - "panel"  → versão completa (Dashboard, etc.)
 * - "sidebar"→ versão compacta para o rodapé do sidebar
 */
import { Sparkles, Rocket, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface NoSubscriptionBannerProps {
  variant?: "panel" | "sidebar";
  className?: string;
}

export function NoSubscriptionBanner({
  variant = "panel",
  className,
}: NoSubscriptionBannerProps) {
  const { currentTenant, isSuperAdmin, currentRole } = useTenant();
  const { loading, subscription } = useTenantBilling();

  // Não exibir enquanto carrega, se já existe assinatura ou se é Super Admin
  if (loading || subscription || !currentTenant || isSuperAdmin) return null;

  const canManagePlan = currentRole === "owner" || currentRole === "manager";

  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "rounded-xl border border-warning/30 bg-warning-soft/60 p-3",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          {canManagePlan ? (
            <Sparkles className="h-3.5 w-3.5 text-warning-foreground" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <p className="text-xs font-semibold text-warning-foreground">
            {canManagePlan ? "Sem assinatura" : "Aguardando ativação"}
          </p>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {canManagePlan
            ? "Escolha um plano para liberar todos os módulos."
            : "Seu gestor ainda não ativou um plano."}
        </p>
        {canManagePlan && (
          <Button
            size="sm"
            className="mt-2 h-8 w-full rounded-lg text-xs"
            asChild
          >
            <Link to="/app/assinatura">
              <Rocket className="mr-1.5 h-3 w-3" /> Ver planos
            </Link>
          </Button>
        )}
      </div>
    );
  }

  // Variante "panel"
  if (!canManagePlan) {
    return (
      <div
        className={cn(
          "surface-card flex flex-wrap items-center gap-4 border-border/40 bg-muted/30 p-4 md:p-5",
          className,
        )}
      >
        <div className="flex min-w-0 w-full flex-1 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold">Aguardando ativação</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              O responsável pela equipe ainda não ativou um plano. Entre em contato
              com seu gestor para liberar o acesso completo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-card flex flex-wrap items-center justify-between gap-4 border-warning/30 bg-warning-soft/40 p-4 md:p-5",
        className,
      )}
    >
      <div className="flex min-w-0 w-full flex-1 items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning text-warning-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold">Sem assinatura ativa</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sua conta ainda não possui um plano vinculado. Escolha um plano para
            destravar agenda, clientes, pacotes e relatórios.
          </p>
        </div>
      </div>
      <Button
        className="w-full rounded-xl bg-gradient-brand sm:w-auto md:shrink-0"
        asChild
      >
        <Link to="/app/assinatura">
          <Rocket className="mr-2 h-4 w-4" /> Escolher um plano
        </Link>
      </Button>
    </div>
  );
}
