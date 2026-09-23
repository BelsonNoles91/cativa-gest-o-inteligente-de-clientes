import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { useTenant } from "@/features/tenant/TenantProvider";

export function FeatureGate({
  featureKey,
  children,
}: {
  featureKey: string;
  children: ReactNode;
}) {
  const { loading, hasFeature, plan } = useTenantBilling();
  const { isSuperAdmin } = useTenant();

  // Enquanto o plano ainda não chegou (primeira carga ou troca de tenant),
  // mostramos um loader leve. NUNCA redirecionamos com base em estado parcial,
  // pois isso causa flash de tela e loops de navegação.
  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  // Super admin sempre tem acesso total, mesmo sem plano vinculado ao tenant.
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Sem plano vinculado (tenant novo/sem assinatura) ou feature fora do plano:
  // redireciona para a tela de plano em vez de ficar em spinner infinito.
  if (!plan || !hasFeature(featureKey)) {
    return <Navigate to="/app/meu-plano" replace />;
  }

  return <>{children}</>;
}
