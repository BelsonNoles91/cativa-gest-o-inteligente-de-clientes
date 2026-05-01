import { PremiumSection, PremiumGrid } from "../layout/PremiumSection";
import { Users, Calendar, Settings, Shield, Globe, BarChart, Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const modules = [
  {
    title: "CRM de clientes",
    desc: "Tenha uma visão completa de cada cliente com cadastro, histórico, preferências, fotos e timeline em um só lugar.",
    benefit: "Quanto melhor sua equipe entende o cliente, melhor ela atende, acompanha e estimula o retorno.",
    icon: Users,
    id: "01"
  },
  {
    title: "Agenda inteligente",
    desc: "Visualize horários, profissionais, unidades, encaixes e disponibilidade com muito mais controle.",
    benefit: "Uma agenda bem operada reduz perdas, melhora a ocupação e torna a recepção mais eficiente.",
    icon: Calendar,
    id: "02"
  },
  {
    title: "Serviços e Protocolos",
    desc: "Cadastre serviços, durações, valores, pacotes, memberships e regras de uso padronizadas.",
    benefit: "Isso permite padronização, previsibilidade e melhor acompanhamento da jornada de cada cliente.",
    icon: Settings,
    id: "03"
  },
  {
    title: "Central de confirmação",
    desc: "Use filas de confirmação, templates, registros de tentativa e histórico organizado.",
    benefit: "Menos no-show, mais controle sobre a agenda e mais eficiência para a recepção.",
    icon: Shield,
    id: "04"
  },
  {
    title: "Portal do cliente",
    desc: "O cliente pode agendar, confirmar e acompanhar sua relação com o negócio de forma moderna.",
    benefit: "Você reduz atrito operacional e melhora a percepção de profissionalismo da sua marca.",
    icon: Globe,
    id: "05"
  },
  {
    title: "Analytics e indicadores",
    desc: "Acompanhe retenção, rebooking, no-show, ocupação e valor futuro agendado.",
    benefit: "Negócios que decidem com dados crescem com mais consistência.",
    icon: BarChart,
    id: "06"
  },
  {
    title: "Índice Cativa",
    desc: "Um indicador proprietário que consolida retenção, recorrência e ocupação.",
    benefit: "Você deixa de olhar apenas volume e passa a enxergar qualidade de operação.",
    icon: Activity,
    id: "07"
  }
];

export function ModulesSection() {
  return (
    <PremiumSection variant="light" padding="lg" id="modulos">
      <div className="max-w-4xl mb-24">
        <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8">
          Módulos do Sistema
        </div>
        <h2 className="text-5xl md:text-7xl font-display font-bold text-primary-dark leading-[0.95] tracking-tight mb-8">
          Tudo o que sua operação precisa, <br />
          <span className="text-accent italic serif font-normal">em um único sistema.</span>
        </h2>
        <p className="text-xl text-muted-foreground/80 font-light leading-relaxed max-w-2xl">
          Cada módulo da Cativa foi desenhado para resolver um problema real do dia a dia e, ao mesmo tempo, fortalecer a retenção e a eficiência do negócio.
        </p>
      </div>

      <div className="space-y-4">
        {modules.map((module, idx) => (
          <div 
            key={idx} 
            className="group relative bg-white border border-border/40 p-10 md:p-12 transition-all duration-500 hover:border-accent/40 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 text-8xl font-display font-bold text-primary-dark/5 select-none transition-all duration-700 group-hover:text-accent/10 group-hover:-translate-y-2">
              {module.id}
            </div>
            
            <div className="grid lg:grid-cols-12 gap-12 items-center relative z-10">
              <div className="lg:col-span-1">
                <div className="w-16 h-16 rounded-2xl bg-[#FAF7F9] flex items-center justify-center text-primary-dark transition-all duration-500 group-hover:bg-accent group-hover:text-white">
                  <module.icon className="h-8 w-8" />
                </div>
              </div>
              
              <div className="lg:col-span-5">
                <h3 className="text-3xl font-display font-bold text-primary-dark mb-4 group-hover:text-accent transition-colors">
                  {module.title}
                </h3>
                <p className="text-muted-foreground text-lg font-light leading-relaxed">
                  {module.desc}
                </p>
              </div>
              
              <div className="lg:col-span-6 bg-[#FAF7F9] p-8 md:p-10 border-l-4 border-accent/20 group-hover:border-accent transition-all duration-500">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 text-accent shrink-0 mt-1" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-2">Por que isso importa:</p>
                    <p className="text-primary-dark font-medium leading-relaxed italic text-lg">
                      "{module.benefit}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PremiumSection>
  );
}
