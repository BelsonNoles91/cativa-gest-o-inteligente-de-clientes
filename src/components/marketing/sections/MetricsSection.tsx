import { PremiumSection, PremiumGrid } from "../layout/PremiumSection";
import { TrendingUp, Users, CalendarX, Clock, UserPlus, DollarSign, Activity } from "lucide-react";

const metrics = [
  {
    title: "Retenção de clientes",
    desc: "Entenda quantos clientes estão voltando e onde a recorrência está falhando.",
    icon: Users
  },
  {
    title: "Rebooking",
    desc: "Saiba se seus atendimentos estão realmente gerando continuidade imediata.",
    icon: TrendingUp
  },
  {
    title: "No-show e cancelamentos",
    desc: "Identifique perdas silenciosas e aja com mais antecedência para evitar prejuízos.",
    icon: CalendarX
  },
  {
    title: "Ocupação da agenda",
    desc: "Veja com clareza onde há ociosidade e como melhorar o uso da sua equipe.",
    icon: Clock
  },
  {
    title: "Novos vs Recorrentes",
    desc: "Equilibre aquisição e retenção com inteligência para um crescimento sustentável.",
    icon: UserPlus
  },
  {
    title: "Valor futuro agendado",
    desc: "Tenha uma noção concreta da previsibilidade de faturamento para as próximas semanas.",
    icon: DollarSign
  },
  {
    title: "Índice Cativa",
    desc: "Uma visão consolidada da saúde operacional e comercial em um único indicador.",
    icon: Activity
  }
];

export function MetricsSection() {
  return (
    <PremiumSection variant="soft" padding="lg" id="metricas">
      <div className="grid lg:grid-cols-12 gap-20">
        <div className="lg:col-span-5">
          <div className="sticky top-32">
            <div className="inline-block px-4 py-1.5 rounded-full bg-primary-dark/5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-dark mb-8">
              Visão Gerencial
            </div>
            <h2 className="text-5xl md:text-7xl font-display font-bold text-primary-dark leading-[0.95] tracking-tight mb-8">
              Os números que você <br />
              <span className="text-accent italic serif font-normal">precisa enxergar.</span>
            </h2>
            <p className="text-xl text-muted-foreground/80 font-light leading-relaxed mb-12">
              A Cativa ajuda seu negócio a acompanhar indicadores que impactam diretamente a saúde da agenda e a previsibilidade de receita.
            </p>
            <div className="p-8 bg-primary-dark rounded-[2.5rem] text-white">
              <p className="text-lg font-light leading-relaxed italic opacity-80 mb-6">
                "Quando você mede o que realmente importa, fica muito mais fácil evoluir a operação com consistência."
              </p>
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/20" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Intelligence Center</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="grid sm:grid-cols-2 gap-4">
            {metrics.map((metric, idx) => (
              <div key={idx} className="group p-10 bg-white border border-border/20 rounded-[2.5rem] transition-all duration-500 hover:border-accent/40 hover:shadow-xl hover:shadow-primary/5">
                <div className="w-14 h-14 rounded-2xl bg-[#FAF7F9] flex items-center justify-center text-primary-dark mb-8 transition-transform group-hover:scale-110 group-hover:rotate-3">
                  <metric.icon className="h-6 w-6" />
                </div>
                <h4 className="text-xl font-bold text-primary-dark mb-4 tracking-tight group-hover:text-accent transition-colors">
                  {metric.title}
                </h4>
                <p className="text-muted-foreground leading-relaxed font-light">
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
