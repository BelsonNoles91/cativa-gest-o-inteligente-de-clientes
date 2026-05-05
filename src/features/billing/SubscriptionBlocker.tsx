import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTenantBilling } from "./useTenantBilling";
import { useTenant } from "@/features/tenant/TenantProvider";
import { Sparkles, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function SubscriptionBlocker({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { currentTenant, isSuperAdmin, currentRole } = useTenant();
  const { loading, subscription } = useTenantBilling();

  if (loading) return <>{children}</>;
  
  // Se for super admin ou não houver tenant (ex: erro), não bloqueia.
  if (isSuperAdmin || !currentTenant) return <>{children}</>;

  // Se tem assinatura ativa ou trial, tudo liberado.
  if (subscription) return <>{children}</>;

  // As únicas rotas permitidas quando não tem plano:
  const allowedRoutes = ["/app/meu-plano", "/app/assinatura"];
  if (allowedRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  // --- Diferenciação por papel ---
  const canManagePlan = currentRole === "owner" || currentRole === "manager";

  if (!canManagePlan) {
    // Funcionários (frontdesk, professional) veem mensagem gentil
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Clock className="h-8 w-8" />
        </div>
        <h2 className="mt-6 font-display text-2xl font-bold md:text-3xl">Aguardando ativação</h2>
        <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base leading-relaxed">
          O responsável por <strong>{currentTenant.name}</strong> ainda não ativou um plano para a equipe.
          Entre em contato com seu gestor para liberar o acesso ao sistema.
        </p>
      </div>
    );
  }

  // Gestores (owner, manager) veem o bloqueio com ação
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-warning-soft text-warning">
        <Lock className="h-8 w-8" />
      </div>
      <h2 className="mt-6 font-display text-2xl font-bold md:text-3xl">Acesso bloqueado</h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base leading-relaxed">
        Escolha um plano para liberar os módulos do sistema para <strong>{currentTenant.name}</strong>.
      </p>
      
      <div className="mt-8">
        <Button 
          size="lg" 
          className="rounded-xl bg-gradient-brand text-primary-foreground shadow-md hover:opacity-90"
          asChild
        >
          <Link to="/app/assinatura">
            <Sparkles className="mr-2 h-5 w-5" />
            Escolher um Plano
          </Link>
        </Button>
      </div>
    </div>
  );
}
