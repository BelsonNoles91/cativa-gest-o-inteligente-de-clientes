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
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, HelpCircle, Loader2, Sparkles, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PremiumHeader } from "@/components/marketing/layout/PremiumHeader";
import { PremiumFooter } from "@/components/marketing/layout/PremiumFooter";
import { listPlans, listPlanFeatures } from "@/repositories/billing";
import {
  billingPeriodLabels,
  formatPrice,
  type Plan,
  type PlanBillingPeriod,
  type PlanFeature,
} from "@/domain/billing";
import { cn } from "@/lib/utils";
import { handleError } from "@/lib/error-handler";

// ---------------------------------------------------------------------------
// FAQ institucional
// ---------------------------------------------------------------------------
const FAQ = [
  {
    q: "O Cativa possui plano gratuito?",
    a: "O plano Começo oferece 30 dias grátis; os planos Solo, Equipe e Rede incluem 14 dias de avaliação, sem cartão. Ao fim do período, você decide se assina e seus dados permanecem preservados.",
  },
  {
    q: "Preciso de cartão de crédito para começar?",
    a: "Não para o plano gratuito ou para o período de testes dos planos pagos. Você só insere os dados de pagamento quando decidir assinar um plano premium.",
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
// Fallback curado da linha atual (migration 0030) caso a leitura do catálogo falhe.
// ---------------------------------------------------------------------------
const FALLBACK_PLANS: Array<{
  name: string;
  description: string;
  priceCents: number;
  billingPeriod: PlanBillingPeriod;
  trialDays: number;
  features: string[];
  highlight?: boolean;
}> = [
  {
    name: "Começo",
    description:
      "Para sair do papel e organizar a agenda hoje mesmo. Grátis por 30 dias: depois você escolhe um plano pago ou a conta fica só para consulta — nada é apagado.",
    priceCents: 0,
    billingPeriod: "monthly",
    trialDays: 30,
    features: [
      "1 profissional e 1 unidade",
      "Até 30 agendamentos por mês",
      "Agenda completa e fácil de usar",
      "Página de agendamento com link e QR code",
      "Portal do cliente: histórico, remarcação e cancelamento",
      "Confirmação de horário por WhatsApp",
      "Avisos e lembretes no celular",
    ],
  },
  {
    name: "Solo",
    description:
      "Para o profissional autônomo que quer agenda cheia e zero bagunça: manicure, lash designer, barbeiro, tatuador.",
    priceCents: 5790,
    billingPeriod: "monthly",
    trialDays: 14,
    features: [
      "Tudo do plano Começo",
      "Clientes e agendamentos ilimitados",
      "Espaço do Cliente com entrada por Google/Apple",
      "Lista de espera: preencha horários vagos na hora",
      "Pacotes e combos do seu atendimento",
      "Relatórios essenciais do seu negócio",
    ],
  },
  {
    name: "Equipe",
    description:
      "Para salões e clínicas que querem crescer: retenção, metas e inteligência trabalhando pelo seu negócio todos os dias.",
    priceCents: 9790,
    billingPeriod: "monthly",
    trialDays: 14,
    highlight: true,
    features: [
      "Tudo do plano Solo",
      "Até 6 profissionais na mesma agenda",
      "Resumo inteligente com IA do seu dia",
      "Reativação automática de clientes com cupom",
      "Valor de cada cliente e previsão de faturamento",
      "Metas, ranking e comissões da equipe",
      "Portal do profissional com a agenda dele",
      "Índice Cativa: o termômetro da retenção",
    ],
  },
  {
    name: "Rede",
    description:
      "Para quem tem filiais ou quer escalar: todas as unidades em uma visão consolidada, com a sua marca em tudo.",
    priceCents: 24790,
    billingPeriod: "monthly",
    trialDays: 14,
    features: [
      "Tudo do plano Equipe",
      "Profissionais ilimitados",
      "Várias unidades com visão consolidada",
      "Marca própria: suas cores e seu logo",
      "Importação assistida de clientes e agenda",
      "Atendimento prioritário",
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
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<PlanBillingPeriod>("monthly");

  const loadData = useCallback(async () => {
    setLoading(true);
    
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

      setError(false);
      setPlans(
        publicPlans.map((p) => ({
          ...p,
          featureList: (byPlan.get(p.id) ?? []).sort((a, b) => a.displayOrder - b.displayOrder),
        })),
      );
    } catch (err) {
      // A página já renderiza um estado inline com opção de nova tentativa.
      // Evita um segundo toast técnico e redundante sobre o mesmo erro.
      handleError(err, { category: "DATABASE", silent: true });
      setError(true);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // periodicidades disponíveis para o toggle (excluímos "custom")
  const availablePeriods = useMemo<PlanBillingPeriod[]>(() => {
    if (!plans || plans.length === 0) return ["monthly"];
    const set = new Set<PlanBillingPeriod>();
    plans.forEach((p) => {
      if (p.billingPeriod !== "custom") set.add(p.billingPeriod);
    });
    return Array.from(set);
  }, [plans]);

  // Plans filtrados pela periodicidade ativa + planos "custom" (enterprise/sob consulta)
  const visiblePlans = useMemo(() => {
    if (!plans) return null;
    if (plans.length === 0) return [];
    
    // Mostra planos do período selecionado OU planos com período "custom"
    return plans.filter((p) => p.billingPeriod === period || p.billingPeriod === "custom");
  }, [plans, period]);

  return (
    <div className="min-h-screen bg-background">
      <PremiumHeader />

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
              Comece com 30 dias grátis no Começo ou teste os planos premium por 14 dias. Sem cartão.
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
        {error ? (
          <>
            <PricingConnectionStatus error loading={loading} onRetry={loadData} />
            <FallbackGrid />
          </>
        ) : loading ? (
          <>
            <PricingConnectionStatus loading onRetry={loadData} />
            <div className="invisible pointer-events-none" aria-hidden="true">
              <FallbackGrid />
            </div>
          </>
        ) : visiblePlans && visiblePlans.length > 0 ? (
          <PricingGrid plans={visiblePlans} />
        ) : (
          <FallbackGrid />
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Precisa de algo customizado para múltiplas unidades?{" "}
          <a
            href="mailto:contato@cativa.app"
            className="inline-block max-w-full whitespace-normal break-words align-middle text-primary underline underline-offset-4 hover:text-primary-dark [overflow-wrap:anywhere]"
          >
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
        <div className="rounded-3xl bg-gradient-brand p-6 text-center text-primary-foreground shadow-lg sm:p-10 md:p-16">
          <h2 className="font-display text-3xl md:text-4xl">
            Comece em minutos. Cresça com clareza.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Crie seu negócio na Cativa, importe seus dados e veja o Índice Cativa em poucos dias.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-auto min-h-12 w-full max-w-full whitespace-normal break-words rounded-xl bg-background px-4 py-3 text-center text-foreground hover:bg-background/90 sm:w-auto sm:px-6"
            >
              <Link to="/onboarding">
                Começar agora grátis <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <PremiumFooter />
    </div>
  );
}

function PricingConnectionStatus({
  error = false,
  loading,
  onRetry,
}: {
  error?: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      aria-busy={loading}
      className={cn(
        "mx-auto flex min-h-56 max-w-md flex-col items-center justify-center rounded-2xl border p-8 text-center",
        error
          ? "border-danger/20 bg-danger/5 animate-in zoom-in-95 duration-300"
          : "border-border/70 bg-card text-muted-foreground",
      )}
    >
      <h3 className={cn("text-lg font-semibold", error && "text-danger")}>
        {error ? "Falha na conexão" : "Carregando planos"}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {error
          ? "Não conseguimos carregar os planos em tempo real. Tente novamente ou use nossos valores base abaixo."
          : "Estamos buscando os planos vigentes. Os valores base ficam disponíveis se a conexão falhar."}
      </p>
      <Button
        variant="outline"
        onClick={onRetry}
        disabled={loading}
        className="mt-6 min-w-48 gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        {loading && !error ? "Carregando…" : "Tentar novamente"}
      </Button>
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
        "mx-auto mt-10 grid grid-cols-1 gap-6",
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
    <div className="mx-auto mt-10 grid grid-cols-1 max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
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
          trialDays={p.trialDays}
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
  const isCustom = period === "custom";
  const isFree = priceCents === 0 && !isCustom;
  const periodLabel =
    period === "monthly" ? "/mês"
    : period === "quarterly" ? "/trimestre"
    : period === "semiannual" ? "/semestre"
    : period === "annual" ? "/ano"
    : "";

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-[2rem] border bg-card p-6 shadow-sm transition-all duration-300 md:p-8",
        "hover:shadow-lg hover:-translate-y-1 group",
        highlight ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "border-border/60",
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-md animate-fade-in">
            <Sparkles className="h-3.5 w-3.5" /> Mais escolhido
          </span>
        </span>
      )}
      <h3 className="font-display text-xl">{name}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}

      <div className="mt-5 flex items-end gap-1">
        {isFree ? (
          <span className="font-display text-4xl">Grátis</span>
        ) : isCustom ? (
          <span className="font-display text-4xl">Sob consulta</span>
        ) : (
          <>
            <span className="font-display text-4xl">{formatPrice(priceCents, currency)}</span>
            <span className="pb-1.5 text-sm text-muted-foreground">{periodLabel}</span>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {isCustom
          ? "Preço sob consulta"
          : isFree
            ? trialDays > 0
              ? `Grátis por ${trialDays} dias · sem cartão`
              : "Plano gratuito · sem cartão"
            : trialDays > 0
              ? `Trial de ${trialDays} dias · sem cartão`
              : "Sem período de teste"}
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
          "mt-8 h-12 w-full rounded-2xl tap-feedback font-semibold text-base",
          highlight
            ? "bg-gradient-brand text-primary-foreground shadow-sm hover:brightness-110"
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
