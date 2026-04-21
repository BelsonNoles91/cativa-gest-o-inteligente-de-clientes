/**
 * Página pública de planos.
 */
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Essencial",
    price: "R$ 89",
    description: "Para profissionais autônomos começando a organizar agenda e clientes.",
    features: ["1 unidade", "Até 2 profissionais", "Agenda + Clientes", "Confirmação manual", "Suporte por e-mail"],
    cta: "Começar trial",
    highlight: false,
  },
  {
    name: "Studio",
    price: "R$ 189",
    description: "O queridinho dos salões e clínicas. Operação completa para a recepção.",
    features: ["1 unidade", "Profissionais ilimitados", "Pacotes & Protocolos", "Lista de espera", "Analytics essenciais"],
    cta: "Mais escolhido",
    highlight: true,
  },
  {
    name: "Rede",
    price: "R$ 349",
    description: "Para múltiplas unidades, papéis avançados e visão consolidada.",
    features: ["Multi-unidade", "Papéis avançados", "Memberships", "Analytics completo", "Suporte prioritário"],
    cta: "Falar com vendas",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Button asChild variant="ghost"><Link to="/auth/login">Entrar</Link></Button>
        </div>
      </header>

      <section className="container py-14 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <StatusBadge tone="brand">Planos & Preços</StatusBadge>
          <h1 className="mt-4 font-display text-4xl md:text-5xl">Escolha o plano que combina com seu momento</h1>
          <p className="mt-3 text-muted-foreground">Trial de 14 dias em todos os planos. Sem cartão de crédito.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-card p-6 shadow-sm transition-all md:p-7",
                plan.highlight ? "border-primary shadow-md ring-1 ring-primary/30" : "border-border/70",
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-gradient-brand px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm">
                  Mais escolhido
                </span>
              )}
              <h3 className="font-display text-xl">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-5 flex items-end gap-1">
                <span className="font-display text-4xl">{plan.price}</span>
                <span className="pb-1.5 text-sm text-muted-foreground">/mês</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success">
                      <Check className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={cn(
                  "mt-7 h-11 w-full rounded-xl",
                  plan.highlight ? "bg-gradient-brand text-primary-foreground" : "bg-foreground text-background hover:bg-foreground/90",
                )}
              >
                <Link to="/onboarding">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
