import { useState, useEffect } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export function PlansSection() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const { data, error } = await supabase
          .from("plans")
          .select("*")
          .eq("status", "public")
          .order("display_order", { ascending: true });

        if (error) throw error;
        
        // Remove duplicados por nome e filtra o Enterprise
        const uniquePlans = data?.reduce((acc: any[], current) => {
          const x = acc.find(item => item.name === current.name);
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, []);

        const filteredPlans = (uniquePlans || []).filter((p: any) => 
          p.code !== 'enterprise' && p.name.toLowerCase() !== 'enterprise'
        );
        setPlans(filteredPlans);
      } catch (err) {
        console.error("Erro ao buscar planos:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  if (loading) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10 max-w-7xl mx-auto px-4 md:px-0">
      {plans.map((plan, i) => {
        // Marcamos como destaque o plano intermediário ou o que tiver maior ordem
        const isHighlight = plan.code === 'pro' || plan.code === 'entrepreneur' || plan.name === 'Empreendedor';
        const price = plan.price_cents / 100;
        
        // Benefícios claros e em português para cada plano
        const defaultFeatures: Record<string, string[]> = {
          free: ["Agenda básica", "Até 50 clientes", "1 profissional", "Gestão de horários"],
          starter: ["Agenda básica", "Até 50 clientes", "1 profissional", "Gestão de horários"],
          pro: ["Clientes ilimitados", "Agendas sem limites", "Até 2 profissionais", "Relatórios de vendas", "Acompanhamento de fidelidade"],
          entrepreneur: ["Clientes ilimitados", "Agendas sem limites", "Até 2 profissionais", "Relatórios de vendas", "Acompanhamento de fidelidade"],
          studio: ["Tudo ilimitado", "Várias unidades", "Relatórios inteligentes", "Gestão de equipe", "Atendimento exclusivo"],
        };

        // Forçar uso dos benefícios padronizados para evitar termos técnicos do banco
        const features = defaultFeatures[plan.code as keyof typeof defaultFeatures] || ["Consulte nossa equipe"];

        return (
          <div key={plan.id} className={cn(
            "group relative p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border transition-all duration-700 flex flex-col h-full",
            isHighlight 
              ? "bg-[#1A0F16] text-white border-accent/30 shadow-[0_40px_100px_-20px_rgba(168,76,134,0.3)] md:scale-105 z-10" 
              : "bg-white text-primary-dark border-border/40 hover:border-accent/20 hover:shadow-xl"
          )}>
            {isHighlight && (
              <div className="absolute top-0 right-0 p-8">
                <Star className="h-6 w-6 text-accent fill-accent animate-pulse" />
              </div>
            )}
            
            <p className={cn("text-[10px] font-bold uppercase tracking-[0.3em] mb-6", isHighlight ? "text-accent" : "text-muted-foreground")}>
              {plan.name === 'Studio' ? 'Estúdio' : plan.name}
            </p>
            
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-xl font-bold opacity-60">R$</span>
              <span className="text-6xl md:text-7xl font-display font-bold tracking-tighter">
                {plan.code === 'free' ? "Grátis" : 
                 plan.code === 'pro' || plan.code === 'entrepreneur' ? "47,90" : "87,90"}
              </span>
              {plan.code !== 'free' && <span className="text-sm font-bold opacity-60">/mês</span>}
            </div>
            
            <p className={cn("text-lg font-light mb-10 leading-relaxed min-h-[60px]", isHighlight ? "text-white/70" : "text-muted-foreground")}>
              {plan.description || "A solução ideal para organizar sua rotina."}
            </p>
            
            <div className="space-y-6 mb-12 flex-grow">
               {features.slice(0, 5).map((feat, idx) => (
                 <div key={idx} className="flex items-start gap-4">
                    <CheckCircle2 className={cn("h-5 w-5 shrink-0 mt-0.5", isHighlight ? "text-accent" : "text-primary-dark")} />
                    <span className="font-light tracking-tight text-base">{feat}</span>
                 </div>
               ))}
            </div>

            <div className="flex flex-col gap-4 mt-auto">
              <Button asChild className={cn(
                "w-full h-16 rounded-full text-lg font-bold transition-all relative overflow-hidden group/btn shadow-lg",
                isHighlight 
                  ? "bg-accent text-white hover:bg-white hover:text-primary-dark border-none" 
                  : "bg-primary-dark text-white hover:bg-accent border-none"
              )}>
                <Link to="/onboarding">
                  <span className="relative z-10">{price === 0 ? "Começar agora" : "Escolher este plano"}</span>
                  <div className="absolute inset-0 bg-white translate-y-full transition-transform duration-500 group-hover/btn:translate-y-0" />
                </Link>
              </Button>
              
              <Button asChild variant="ghost" className={cn(
                "w-full h-12 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                isHighlight ? "text-white/60 hover:text-white" : "text-primary-dark/60 hover:text-primary-dark"
              )}>
                <Link to="/demo">Ver demonstração</Link>
              </Button>
            </div>
            
            {plan.trial_days > 0 && (
              <p className={cn("text-center mt-6 text-[9px] font-bold uppercase tracking-widest opacity-40")}>
                {plan.trial_days} dias para testar sem compromisso
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
