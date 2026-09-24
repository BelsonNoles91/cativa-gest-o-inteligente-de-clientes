import { SignupLink } from "@/features/system/SignupLink";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, RefreshCcw, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";
import { PLAN_FEATURE_CATALOG, formatLimit, isFeatureOn } from "@/domain/plan-catalog";

type PublicPlan = Database["public"]["Tables"]["plans"]["Row"];

type Meta = {
  show_on_landing?: boolean;
  highlight?: boolean;
  badge?: string;
  cta_label?: string;
  cta_sub?: string;
  landing_bullets?: string[];
};

function planBullets(plan: PublicPlan): string[] {
  const meta = (plan.metadata ?? {}) as Meta;
  const features = (plan.features ?? {}) as Record<string, unknown>;
  const custom = (meta.landing_bullets ?? []).filter(Boolean);
  // Quando o plano tem texto próprio de vitrine, ele manda na apresentação.
  if (custom.length > 0) return custom;
  return [
    formatLimit(plan.max_professionals, "profissional", "profissionais"),
    formatLimit(plan.max_active_clients, "cliente", "clientes"),
    formatLimit(plan.max_appointments_month, "agendamento/mês", "agendamentos/mês"),
    ...PLAN_FEATURE_CATALOG.filter((f) => isFeatureOn(features, f.key)).map((f) => f.label),
  ];
}

const TRUST_ITEMS = [
  { icon: BadgeCheck, text: "2 meses grátis no pagamento anual" },
  { icon: RefreshCcw, text: "Troque de plano quando quiser" },
  { icon: XCircle, text: "Sem taxa de adesão e sem fidelidade" },
  { icon: ShieldCheck, text: "Seus dados protegidos e sempre seus" },
];

export function PlansSection() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchPlans() {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("status", "public")
        .order("display_order", { ascending: true });
      if (!active) return;
      if (error) console.error("Erro ao buscar planos:", error);
      setPlans((data ?? []).filter((p) => ((p.metadata ?? {}) as Meta).show_on_landing === true));
      setLoading(false);
    }
    void fetchPlans();
    // Atualiza sozinho quando o super admin salva um plano.
    const channel = supabase
      .channel("landing-plans")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => void fetchPlans())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  if (loading || plans.length === 0) return null;

  return (
    <div>
      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 max-w-7xl mx-auto px-4 md:px-0", plans.length >= 3 && "lg:grid-cols-3", plans.length >= 4 && "xl:grid-cols-4")}>
        {plans.map((plan, i) => {
          const meta = (plan.metadata ?? {}) as Meta;
          const isHighlight = meta.highlight === true;
          const isFree = plan.price_cents === 0;
          const price = (plan.price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const features = planBullets(plan);

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              key={plan.id}
              className={cn(
                "group relative p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border transition-all duration-700 flex flex-col h-full",
                isHighlight
                  ? "bg-[#1A0F16] text-white border-accent/30 shadow-[0_40px_100px_-20px_rgba(168,76,134,0.3)] md:scale-105 z-10"
                  : "bg-white text-primary-dark border-border/40 hover:border-accent/20 hover:shadow-xl",
              )}
            >
              {isHighlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-lg">
                    <Sparkles className="h-3.5 w-3.5" />
                    {meta.badge ?? "Mais escolhido"}
                  </span>
                </div>
              )}

              <div className="flex flex-col h-full">
                <p className={cn("text-[10px] font-bold uppercase tracking-[0.3em] mb-6", isHighlight ? "text-accent" : "text-muted-foreground")}>
                  {plan.name}
                </p>

                <div className="flex flex-wrap items-baseline gap-x-1 mb-2">
                  {!isFree && <span className="text-xl font-bold opacity-60">R$</span>}
                  <span className="text-4xl md:text-5xl font-display font-bold tracking-tighter">{isFree ? "Grátis" : price}</span>
                  {!isFree && <span className="text-sm font-bold opacity-60">/mês</span>}
                </div>
                <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-8", isHighlight ? "text-accent" : "text-accent-strong")}>
                  {isFree && plan.trial_days > 0
                    ? `Grátis por ${plan.trial_days} dias — depois você decide`
                    : "2 meses grátis no plano anual"}
                </p>

                <div className="min-h-[80px] mb-8">
                  <p className={cn("text-lg font-light leading-relaxed", isHighlight ? "text-white/70" : "text-muted-foreground")}>
                    {plan.description || "A solução ideal para organizar sua rotina."}
                  </p>
                </div>

                <div className="flex-grow space-y-4 mb-12">
                  {features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-4">
                      <CheckCircle2 className={cn("h-5 w-5 shrink-0 mt-0.5", isHighlight ? "text-accent" : "text-primary-dark")} />
                      <span className="font-light tracking-tight text-base">{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-8 border-t border-border/10 flex flex-col gap-4">
                  <Button asChild variant={isHighlight ? "premium" : "default"} className="w-full h-14 md:h-16 rounded-2xl text-base md:text-lg font-bold group/btn px-4">
                    <SignupLink className="flex items-center justify-center gap-2 text-center leading-tight">
                      {meta.cta_label ?? (isFree ? "Começar agora" : "Escolher este plano")}
                      <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover/btn:translate-x-1" />
                    </SignupLink>
                  </Button>
                  <p className="text-center mt-2 text-[9px] font-bold uppercase tracking-widest opacity-80">
                    {meta.cta_sub ??
                      (plan.trial_days > 0
                        ? isFree
                          ? `Grátis por ${plan.trial_days} dias`
                          : `Experimente por ${plan.trial_days} dias`
                        : "Cancele quando quiser")}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Linha de confiança: reforça a decisão logo abaixo dos planos */}
      <div className="max-w-5xl mx-auto mt-14 md:mt-20 px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {TRUST_ITEMS.map((item) => (
            <div key={item.text} className="flex items-center gap-3 rounded-2xl bg-white/70 border border-border/40 px-4 py-4">
              <item.icon className="h-5 w-5 shrink-0 text-accent-strong" />
              <span className="text-xs md:text-sm font-semibold text-primary-dark leading-snug">{item.text}</span>
            </div>
          ))}
        </div>
        <p className="text-center mt-8 text-sm text-primary-dark/70 font-light">
          Ficou na dúvida? Comece pelo <span className="font-bold text-primary-dark">Começo</span>, grátis por 30 dias — e suba de plano quando o seu negócio pedir.
        </p>
      </div>
    </div>
  );
}
