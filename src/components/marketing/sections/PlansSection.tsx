import { useState, useEffect } from "react";
import { CheckCircle2, Star, TrendingUp, Calendar, Users, BarChart3, Clock, MapPin } from "lucide-react";
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
        
        // Filter out redundant names/codes if they exist (based on common Supabase patterns)
        const uniquePlans = data?.reduce((acc: any[], current) => {
          const x = acc.find(item => item.name === current.name);
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, []);

        const filteredPlans = (uniquePlans || []).filter((p: any) => p.code !== 'enterprise');
        setPlans(filteredPlans);
      } catch (err) {
        console.error("Error fetching plans:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  if (loading) return null;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
      {plans.map((plan, i) => {
        const isHighlight = plan.code === 'pro' || plan.code === 'studio' || plan.name === 'Studio';
        const price = plan.price_cents / 100;
        
        // Define specific features based on plan code if the JSON features are empty
        const defaultFeatures = {
          free: ["Até 50 clientes", "25 agendamentos/mês", "1 profissional", "Gestão básica"],
          starter: ["Até 50 clientes", "25 agendamentos/mês", "1 profissional", "Gestão básica"],
          pro: ["Clientes ilimitados", "Agendamentos ilimitados", "Até 2 profissionais", "Relatórios avançados", "Suporte prioritário"],
          entrepreneur: ["Clientes ilimitados", "Agendamentos ilimitados", "Até 2 profissionais", "Relatórios avançados", "Suporte prioritário"],
          studio: ["Tudo ilimitado", "Multi-unidades", "BI & Analytics", "Gestão de equipe", "Suporte VIP"],
          enterprise: ["Soluções customizadas", "Integração via API", "Gerente de conta", "SLA garantido"]
        };

        const features = plan.features && Object.keys(plan.features).length > 0 
          ? Object.entries(plan.features).map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val}`)
          : (defaultFeatures[plan.code as keyof typeof defaultFeatures] || ["Consulte nossa equipe"]);

        return (
          <div key={plan.id} className={cn(
            "group relative p-10 md:p-12 rounded-[3.5rem] border transition-all duration-700 hover:-translate-y-4 overflow-hidden",
            isHighlight 
              ? "bg-[#1A0F16] text-white border-accent/30 shadow-[0_40px_100px_-20px_rgba(168,76,134,0.3)] scale-105 z-10" 
              : "bg-white text-primary-dark border-border/40"
          )}>
            {isHighlight && (
              <div className="absolute top-0 right-0 p-8">
                <Star className="h-6 w-6 text-accent fill-accent animate-pulse" />
              </div>
            )}
            
            <p className={cn("text-xs font-bold uppercase tracking-[0.3em] mb-6", isHighlight ? "text-accent" : "text-muted-foreground")}>
              {plan.name}
            </p>
            
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-xl font-bold opacity-60">R$</span>
              <span className="text-7xl font-display font-bold tracking-tighter">
                {price === 0 ? "Grátis" : Math.floor(price)}
              </span>
              {price > 0 && <span className="text-sm font-bold opacity-60">/mês</span>}
            </div>
            
            <p className={cn("text-lg font-light mb-10 leading-relaxed min-h-[60px]", isHighlight ? "text-white/70" : "text-muted-foreground")}>
              {plan.description || "O plano ideal para sua fase de crescimento."}
            </p>
            
            <div className="space-y-6 mb-12">
               {features.slice(0, 5).map((feat, idx) => (
                 <div key={idx} className="flex items-center gap-4">
                    <CheckCircle2 className={cn("h-5 w-5 shrink-0", isHighlight ? "text-accent" : "text-primary-dark")} />
                    <span className="font-light tracking-tight">{feat}</span>
                 </div>
               ))}
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild className={cn(
                "w-full h-16 rounded-full text-lg font-bold transition-all relative overflow-hidden group/btn shadow-lg",
                isHighlight 
                  ? "bg-accent text-white hover:bg-white hover:text-primary-dark" 
                  : "bg-primary-dark text-white hover:bg-accent"
              )}>
                <Link to="/onboarding">
                  <span className="relative z-10">{price === 0 ? "Começar Agora" : "Selecionar Plano"}</span>
                  <div className="absolute inset-0 bg-white translate-y-full transition-transform duration-500 group-hover/btn:translate-y-0" />
                </Link>
              </Button>
              
              <Button asChild variant="ghost" className={cn(
                "w-full h-12 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                isHighlight ? "text-white/60 hover:text-white" : "text-primary-dark/60 hover:text-primary-dark"
              )}>
                <Link to="/demo">Agendar demonstração</Link>
              </Button>
            </div>
            
            {plan.trial_days > 0 && (
              <p className={cn("text-center mt-6 text-[10px] font-bold uppercase tracking-widest opacity-40")}>
                {plan.trial_days} DIAS DE TESTE GRÁTIS
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
