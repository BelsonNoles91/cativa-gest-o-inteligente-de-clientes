import { PremiumSection } from "../layout/PremiumSection";
import { TrendingUp, Users, CalendarX, Clock, UserPlus, DollarSign, Activity } from "lucide-react";

const metrics = [
  {
    title: "Fidelidade de clientes",
    desc: "Entenda quantos clientes estão voltando e onde a recorrência está falhando.",
    icon: Users
  },
  {
    title: "Taxa de Retorno",
    desc: "Saiba se seus atendimentos estão gerando novas visitas de forma imediata.",
    icon: TrendingUp
  },
  {
    title: "Faltas e Cancelamentos",
    desc: "Identifique perdas silenciosas e aja com antecedência para evitar prejuízos.",
    icon: CalendarX
  },
  {
    title: "Ocupação da Agenda",
    desc: "Veja com clareza onde há horários livres e como melhorar o uso da sua equipe.",
    icon: Clock
  },
  {
    title: "Novos vs Recorrentes",
    desc: "Equilibre novos clientes e fidelização para um crescimento sustentável.",
    icon: UserPlus
  },
  {
    title: "Previsão de Receita",
    desc: "Tenha uma noção concreta do faturamento esperado para as próximas semanas.",
    icon: DollarSign
  },
  {
    title: "Índice Cativa",
    desc: "Uma visão completa da saúde da sua marca em um único indicador exclusivo.",
    icon: Activity
  }
];

export function MetricsSection() {
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
            <div className="p-8 md:p-10 bg-primary-dark rounded-[2.5rem] md:rounded-[3rem] text-white shadow-xl">
              <p className="text-lg md:text-xl font-light leading-relaxed italic opacity-80 mb-6 md:mb-8">
                "Quando você mede o que realmente importa, fica muito mais fácil evoluir a operação com consistência."
              </p>
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/20" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Centro de Inteligência</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 px-4 md:px-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {metrics.map((metric, idx) => (
              <div key={idx} className="group p-8 md:p-10 bg-white border border-border/20 rounded-[2rem] md:rounded-[2.5rem] transition-all duration-500 hover:border-accent/40 hover:shadow-xl">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#FAF7F9] flex items-center justify-center text-primary-dark mb-6 md:mb-8 transition-transform group-hover:scale-110 group-hover:rotate-3 border border-border/10">
                  <metric.icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <h4 className="text-lg md:text-xl font-bold text-primary-dark mb-4 tracking-tight group-hover:text-accent transition-colors">
                  {metric.title}
                </h4>
                <p className="text-muted-foreground leading-relaxed font-light text-sm md:text-base">
                  {metric.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PremiumSection>
  );
}
