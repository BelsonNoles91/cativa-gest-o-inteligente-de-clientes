/**
 * Página pública de planos.
 *
 * Conectada ao SaaS billing real:
 *  - Carrega planos publicados do banco (status = "public")
 *  - Carrega features de cada plano
 *  - Toggle entre cobrança mensal e anual quando há ambos
 *  - Fallback para um conjunto curado caso o banco ainda não esteja semeado
 *
 * Tudo em tokens semânticos do design system.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, HelpCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { listPlans, listPlanFeatures } from "@/repositories/billing";
import {
  billingPeriodLabels,
  formatPrice,
  type Plan,
  type PlanBillingPeriod,
  type PlanFeature,
} from "@/domain/billing";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// FAQ institucional
// ---------------------------------------------------------------------------
const FAQ = [
  {
    q: "Preciso de cartão de crédito para começar?",
    a: "Não. O trial de 14 dias é livre, sem cartão. Você só ativa o plano quando decidir.",
  },
  {
    q: "Posso trocar de plano depois?",
    a: "Sim, a qualquer momento. Upgrades aplicam o novo limite imediatamente; downgrades respeitam o ciclo atual.",
  },
  {
    q: "Vocês integram com WhatsApp?",
    a: "Trabalhamos com WhatsApp manual via wa.me — sem custos de API, sem riscos de bloqueio. A central de confirmação prepara as mensagens, a recepção dispara em 1 clique.",
  },
  {
    q: "Os meus dados são meus?",
    a: "Sempre. A qualquer momento você exporta clientes, serviços, agendamentos e métricas em CSV ou JSON. Não há lock-in.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. A operação foi desenhada mobile-first: a recepção opera tudo no celular ou tablet sem perda de fluidez.",
  },
  {
    q: "Vocês emitem nota fiscal?",
    a: "O Cativa não inclui módulo fiscal. Focamos em retenção, agenda e operação — emissão fiscal continua na sua ferramenta de preferência.",
  },
];

// ---------------------------------------------------------------------------
// Fallback curado (caso o banco ainda não esteja semeado)
// ---------------------------------------------------------------------------
const FALLBACK_PLANS: Array<{
  name: string;
  description: string;
  priceCents: number;
  billingPeriod: PlanBillingPeriod;
  features: string[];
  highlight?: boolean;
}> = [
  {
    name: "Apoio",
    description: "Ideal para quem está começando agora.",
    priceCents: 0,
    billingPeriod: "monthly",
    features: [
      "1 unidade",
      "1 profissional",
      "Até 25 atendimentos/mês",
      "Até 50 clientes ativos",
      "100 MB de armazenamento",
    ],
  },
  {
    name: "Empreendedor",
    description: "Para o profissional que quer crescer com controle.",
    priceCents: 4490,
    billingPeriod: "monthly",
    features: [
      "1 unidade",
      "Até 2 profissionais",
      "Até 300 atendimentos/mês",
      "Até 500 clientes ativos",
      "500 MB de armazenamento",
      "Agendamento online",
      "Logo personalizada",
    ],
    highlight: true,
  },
  {
    name: "Studio",
    description: "Gestão completa sem limites de escala.",
    priceCents: 9490,
    billingPeriod: "monthly",
    features: [
      "Unidades ilimitadas",
      "Profissionais ilimitados",
      "Atendimentos ilimitados",
      "Até 2.000 clientes ativos",
      "5 GB de armazenamento",
      "Agendamento online",
      "Logo personalizada",
      "Relatórios avançados",
    ],
  },
];

interface PlanWithFeatures extends Plan {
  featureList: PlanFeature[];
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function Pricing() {
  const [plans, setPlans] = useState<PlanWithFeatures[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PlanBillingPeriod>("monthly");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await listPlans();
        const publicPlans = all.filter((p) => p.status === "public");
        const ids = publicPlans.map((p) => p.id);
        const features = ids.length ? await listPlanFeatures(ids) : [];
        const byPlan = new Map<string, PlanFeature[]>();
        features.forEach((f) => {
          const arr = byPlan.get(f.planId) ?? [];
          arr.push(f);
          byPlan.set(f.planId, arr);
        });
        if (mounted) {
          setPlans(
            publicPlans.map((p) => ({
              ...p,
              featureList: (byPlan.get(p.id) ?? []).sort((a, b) => a.displayOrder - b.displayOrder),
            })),
          );
        }
      } catch {
        if (mounted) setPlans([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // periodicidades disponíveis (monthly + qualquer outra encontrada)
  const availablePeriods = useMemo<PlanBillingPeriod[]>(() => {
    if (!plans || plans.length === 0) return ["monthly"];
    const set = new Set<PlanBillingPeriod>();
    plans.forEach((p) => set.add(p.billingPeriod));
    return Array.from(set);
  }, [plans]);

  // Plans filtrados pela periodicidade ativa
  const visiblePlans = useMemo(() => {
    if (!plans) return null;
    if (plans.length === 0) return [];
    const filtered = plans.filter((p) => p.billingPeriod === period);
    return filtered.length > 0 ? filtered : plans.filter((p) => p.billingPeriod === "monthly");
  }, [plans, period]);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-soft" aria-hidden />
        <div className="container relative py-14 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <StatusBadge tone="brand">Planos & Preços</StatusBadge>
            <h1 className="mt-4 font-display text-4xl md:text-5xl">
              Simples como precisa ser. Robusto como o seu negócio merece.
            </h1>
            <p className="mt-3 text-muted-foreground">
              Trial de 14 dias em todos os planos. Sem cartão de crédito. Cancele quando quiser.
            </p>

            {availablePeriods.length > 1 && (
              <div className="mt-6 inline-flex rounded-2xl border border-border/70 bg-card p-1 shadow-xs">
                {availablePeriods.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm transition-colors",
                      period === p
                        ? "bg-gradient-brand text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {billingPeriodLabels[p]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="container pb-16 md:pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando planos…
          </div>
        ) : visiblePlans && visiblePlans.length > 0 ? (
          <PricingGrid plans={visiblePlans} />
        ) : (
          <FallbackGrid />
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Precisa de algo customizado para múltiplas unidades?{" "}
          <a href={`mailto:contato@cativa.app`} className="text-primary underline-offset-4 hover:underline">
            Fale com a gente
          </a>
          .
        </p>
      </section>

      {/* COMPARATIVO INSTITUCIONAL */}
      <section className="border-y border-border/60 bg-gradient-soft py-16 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <StatusBadge tone="brand">Em todos os planos</StatusBadge>
            <h2 className="mt-4 font-display text-3xl md:text-4xl">O que vem incluso</h2>
          </div>
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 md:grid-cols-2">
            {[
              "Agenda inteligente com buffers e bloqueios",
              "CRM com timeline, fotos e preferências",
              "Central de confirmação semiassistida (wa.me)",
              "Portal do cliente para reduzir ligações",
              "Analytics com Índice Cativa",
              "Importação e exportação CSV/JSON",
              "Multi-papel (owner, manager, frontdesk, professional)",
              "Atualizações contínuas sem custo extra",
            ].map((it) => (
              <div key={it} className="flex items-start gap-2 rounded-xl border border-border/60 bg-card p-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{it}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <StatusBadge tone="brand">FAQ</StatusBadge>
          <h2 className="mt-4 font-display text-3xl md:text-4xl">Perguntas frequentes</h2>
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl gap-3 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="surface-card p-5">
              <p className="flex items-start gap-2 font-semibold">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {f.q}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20 md:pb-28">
        <div className="rounded-3xl bg-gradient-brand p-10 text-center text-primary-foreground shadow-lg md:p-16">
          <h2 className="font-display text-3xl md:text-4xl">
            Comece em minutos. Cresça com clareza.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Crie seu negócio na Cativa, importe seus dados e veja o Índice Cativa em poucos dias.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-xl bg-background px-6 text-foreground hover:bg-background/90">
              <Link to="/onboarding">
                Começar trial grátis <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grids
// ---------------------------------------------------------------------------
function PricingGrid({ plans }: { plans: PlanWithFeatures[] }) {
  return (
    <div
      className={cn(
        "mx-auto mt-10 grid gap-6",
        plans.length === 1 && "max-w-md",
        plans.length === 2 && "md:grid-cols-2 max-w-3xl",
        plans.length === 3 && "md:grid-cols-3 max-w-6xl",
        plans.length >= 4 && "md:grid-cols-2 lg:grid-cols-4 max-w-7xl",
      )}
    >
      {plans.map((p) => (
        <PlanCard
          key={p.id}
          name={p.name}
          description={p.description ?? ""}
          priceCents={p.priceCents}
          currency={p.currency}
          period={p.billingPeriod}
          features={p.featureList.map((f) => f.label)}
          highlight={p.isDefault}
          trialDays={p.trialDays}
        />
      ))}
    </div>
  );
}

function FallbackGrid() {
  return (
    <div className="mx-auto mt-10 grid max-w-6xl gap-6 md:grid-cols-3">
      {FALLBACK_PLANS.map((p) => (
        <PlanCard
          key={p.name}
          name={p.name}
          description={p.description}
          priceCents={p.priceCents}
          currency="BRL"
          period={p.billingPeriod}
          features={p.features}
          highlight={p.highlight}
          trialDays={14}
        />
      ))}
    </div>
  );
}

interface PlanCardProps {
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  period: PlanBillingPeriod;
  features: string[];
  highlight?: boolean;
  trialDays: number;
}

function PlanCard({
  name,
  description,
  priceCents,
  currency,
  period,
  features,
  highlight,
  trialDays,
}: PlanCardProps) {
  const isFree = priceCents === 0;
  const periodLabel =
    period === "monthly" ? "/mês"
    : period === "quarterly" ? "/trimestre"
    : period === "semiannual" ? "/semestre"
    : period === "annual" ? "/ano"
    : "";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border bg-card p-6 shadow-sm transition-all md:p-7",
        highlight ? "border-primary shadow-md ring-1 ring-primary/30" : "border-border/70",
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm">
          <Sparkles className="h-3 w-3" /> Mais escolhido
        </span>
      )}
      <h3 className="font-display text-xl">{name}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}

      <div className="mt-5 flex items-end gap-1">
        {isFree ? (
          <span className="font-display text-4xl">Grátis</span>
        ) : (
          <>
            <span className="font-display text-4xl">{formatPrice(priceCents, currency)}</span>
            <span className="pb-1.5 text-sm text-muted-foreground">{periodLabel}</span>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Trial de {trialDays} dias · sem cartão
      </p>

      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success">
              <Check className="h-3 w-3" />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        asChild
        className={cn(
          "mt-7 h-11 w-full rounded-xl",
          highlight
            ? "bg-gradient-brand text-primary-foreground"
            : "bg-foreground text-background hover:bg-foreground/90",
        )}
      >
        <Link to="/onboarding">
          Começar agora <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
