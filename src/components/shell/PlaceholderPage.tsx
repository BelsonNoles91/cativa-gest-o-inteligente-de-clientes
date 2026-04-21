/**
 * Placeholder padronizado para páginas em construção (Etapa 1).
 * Substitua nas etapas seguintes pelos fluxos reais.
 */
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function PlaceholderPage({
  title,
  description,
  icon,
  emptyTitle = "Em construção",
  emptyDescription = "Esta tela receberá o fluxo completo nas próximas etapas. Layout, navegação e tokens já estão prontos.",
}: PlaceholderPageProps) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        actions={<StatusBadge tone="brand">Etapa 1 · Estrutura</StatusBadge>}
      />
      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    </>
  );
}
