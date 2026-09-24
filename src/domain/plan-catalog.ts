/**
 * Catálogo único de funções que podem ser ligadas/desligadas por plano.
 * As chaves são as mesmas verificadas por `hasFeature()` no app.
 * O super admin liga/desliga cada uma em cada plano; a landing lê daqui.
 */
export interface PlanFeatureDef {
  key: string;
  label: string;
  description: string;
}

export const PLAN_FEATURE_CATALOG: PlanFeatureDef[] = [
  { key: "online_scheduling", label: "Link de agendamento online", description: "Página própria com link e QR code para o cliente marcar sozinho." },
  { key: "client_portal", label: "Portal do cliente", description: "Cliente vê histórico, remarca e cancela." },
  { key: "confirmation_center", label: "Central de confirmação", description: "Fila de confirmações por WhatsApp manual." },
  { key: "packages_memberships", label: "Pacotes e assinaturas", description: "Venda de pacotes, combos e planos de assinatura." },
  { key: "analytics", label: "Indicadores e Índice Cativa", description: "Painel de desempenho e retenção." },
  { key: "advanced_reports", label: "Relatórios avançados", description: "Relatórios detalhados de faturamento e equipe." },
  { key: "custom_logo", label: "Marca própria (logo e cores)", description: "Personalização visual do estabelecimento." },
  { key: "multi_unit", label: "Várias unidades", description: "Mais de uma unidade com visão consolidada." },
];

export function isFeatureOn(features: Record<string, unknown> | null | undefined, key: string): boolean {
  const v = features?.[key];
  return v === true || v === "true";
}

export function formatLimit(value: number | null | undefined, singular: string, plural: string): string {
  if (value === null || value === undefined) return `${plural} ilimitados`;
  return `Até ${value} ${value === 1 ? singular : plural}`;
}
