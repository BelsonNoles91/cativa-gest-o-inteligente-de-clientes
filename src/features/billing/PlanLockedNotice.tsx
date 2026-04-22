import { Lock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * PlanLockedNotice — bloco padrão exibido quando uma feature está
 * indisponível no plano atual. Mantém a hierarquia visual do app
 * (surface-card + gradiente suave) e oferece um CTA para upgrade.
 */
export function PlanLockedNotice({
  title = "Recurso disponível em planos superiores",
  description = "Faça upgrade do plano para liberar este recurso e continuar de onde parou.",
  ctaTo = "/app/meu-plano",
  ctaLabel = "Ver planos",
}: {
  title?: string;
  description?: string;
  ctaTo?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="surface-card relative overflow-hidden p-6 md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-soft opacity-70"
      />
      <div className="relative flex flex-col items-center text-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary shadow-inner">
          <Lock className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Button asChild className="rounded-xl bg-gradient-brand">
          <Link to={ctaTo}>
            <Sparkles className="mr-2 h-4 w-4" />
            {ctaLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}
