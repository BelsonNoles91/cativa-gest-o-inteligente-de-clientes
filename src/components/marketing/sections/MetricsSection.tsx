import { PremiumSection } from "../layout/PremiumSection";
import { TrendingUp, Users, CalendarX, Clock, UserPlus, DollarSign, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const metrics = [
  {
    id: "fidelidade",
    title: "Fidelidade de clientes",
    desc: "Entenda quantos clientes estão voltando e onde a recorrência está falhando.",
    icon: Users,
    detail: "Crescimento médio de 24% na retenção em 3 meses."
  },
  {
    id: "retorno",
    title: "Taxa de Retorno",
    desc: "Saiba se seus atendimentos estão gerando novas visitas de forma imediata.",
    icon: TrendingUp,
    detail: "Aumento de 15% no agendamento da próxima visita."
  },
  {
    id: "faltas",
    title: "Faltas e Cancelamentos",
    desc: "Identifique perdas silenciosas e aja com antecedência para evitar prejuízos.",
    icon: CalendarX,
    detail: "Redução de até 40% nos no-shows no primeiro mês."
  },
  {
    id: "ocupacao",
    title: "Ocupação da Agenda",
    desc: "Veja com clareza onde há horários livres e como melhorar o uso da sua equipe.",
    icon: Clock,
    detail: "Otimização de 30% no uso dos espaços físicos."
  },
  {
    id: "novos",
    title: "Novos vs Recorrentes",
    desc: "Equilibre novos clientes e fidelização para um crescimento sustentável.",
    icon: UserPlus,
    detail: "Visão clara do custo de aquisição por cliente."
  },
  {
    id: "receita",
    title: "Previsão de Receita",
    desc: "Tenha uma noção concreta do faturamento esperado para as próximas semanas.",
    icon: DollarSign,
    detail: "Previsibilidade financeira com 95% de precisão."
  },
];

export function MetricsSection() {
  const [activeMetric, setActiveMetric] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveMetric((prev) => (prev + 1) % metrics.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PremiumSection variant="soft" padding="lg" id="metricas">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32 px-4 md:px-0">
            <div className="inline-block px-4 py-1.5 rounded-full bg-primary-dark/5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-dark mb-8">
              Visão Gerencial
            </div>
            <h2 className="text-4xl md:text-7xl font-display font-bold text-primary-dark leading-[0.95] tracking-tight mb-8">
              Os números que você <br />
              <span className="text-accent italic serif font-normal">precisa enxergar.</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground/80 font-light leading-relaxed mb-10 md:mb-12">
              A Cativa ajuda seu negócio a acompanhar indicadores que impactam diretamente a saúde da agenda e a previsibilidade de receita.
            </p>
            
            {/* Tour Dinâmico das Métricas */}
            <div className="p-8 md:p-10 bg-primary-dark rounded-[2.5rem] md:rounded-[3rem] text-white shadow-xl relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeMetric}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5 }}
                  className="relative z-10"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                      {(() => {
                        const Icon = metrics[activeMetric].icon;
                        return <Icon className="h-4 w-4 text-accent" />;
                      })()}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Resultado Real</span>
                  </div>
                  <p className="text-xl md:text-2xl font-display font-bold mb-4 italic serif">
                    "{metrics[activeMetric].detail}"
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/20" />
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{metrics[activeMetric].title}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
              
              {/* Dots Progress */}
              <div className="flex gap-2 mt-8 justify-center">
                {metrics.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveMetric(i)}
                    className={cn(
                      "h-1 transition-all duration-500 rounded-full",
                      activeMetric === i ? "w-8 bg-accent" : "w-2 bg-white/20 hover:bg-white/40"
                    )} 
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 px-4 md:px-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {metrics.map((metric, idx) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                key={idx} 
                onClick={() => setActiveMetric(idx)}
                className={cn(
                  "group p-8 md:p-10 bg-white border rounded-[2rem] md:rounded-[2.5rem] transition-all duration-500 cursor-pointer",
                  activeMetric === idx ? "border-accent shadow-xl ring-4 ring-accent/5" : "border-border/20 hover:border-accent/40 hover:shadow-lg"
                )}
              >
                <motion.div 
                  whileHover={{ rotate: 5, scale: 1.1 }}
                  className={cn(
                    "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-6 md:mb-8 transition-transform border",
                    activeMetric === idx ? "bg-accent text-white border-accent" : "bg-[#FAF7F9] text-primary-dark border-border/10"
                  )}
                >
                  {(() => {
                    const Icon = metric.icon;
                    return <Icon className="h-5 w-5 md:h-6 md:w-6" />;
                  })()}
                </motion.div>
                <h4 className="text-lg md:text-xl font-bold text-primary-dark mb-4 tracking-tight group-hover:text-accent transition-colors">
                  {metric.title}
                </h4>
                <p className="text-muted-foreground leading-relaxed font-light text-sm md:text-base">
                  {metric.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PremiumSection>
  );
}
