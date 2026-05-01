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

      <div className="grid gap-6 md:gap-10">
        {modules.map((module, idx) => (
          <div 
            key={idx} 
            className="group relative bg-white rounded-[3rem] border border-border/30 p-8 md:p-14 transition-all duration-700 hover:border-accent/40 hover:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.08)] overflow-hidden"
          >
            {/* Background Identifier - Editorial Detail */}
            <div className="absolute -top-6 -right-6 text-[12rem] font-display font-bold text-primary-dark/[0.03] select-none pointer-events-none transition-all duration-1000 group-hover:text-accent/[0.08] group-hover:scale-110">
              {module.id}
            </div>
            
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center relative z-10">
              <div className="lg:col-span-1">
                <div className="w-20 h-20 rounded-[2.5rem] bg-[#FAF7F9] flex items-center justify-center text-primary-dark transition-all duration-700 group-hover:bg-accent group-hover:text-white group-hover:scale-110 group-hover:rotate-6 border border-border/10">
                  <module.icon className="h-10 w-10" />
                </div>
              </div>
              
              <div className="lg:col-span-5">
                <div className="flex items-center gap-3 mb-6">
                   <span className="text-xs font-bold text-accent tracking-[0.3em] uppercase opacity-60">Módulo {module.id}</span>
                   <div className="h-px w-8 bg-accent/20" />
                </div>
                <h3 className="text-4xl md:text-5xl font-display font-bold text-primary-dark mb-6 group-hover:text-accent transition-colors tracking-tighter">
                  {module.title}
                </h3>
                <p className="text-muted-foreground text-xl font-light leading-relaxed max-w-lg">
                  {module.desc}
                </p>
              </div>
              
              <div className="lg:col-span-6">
                <div className="bg-[#FAF7F9]/80 backdrop-blur-sm p-10 md:p-12 rounded-[2.5rem] border border-border/40 group-hover:border-accent/30 transition-all duration-700 relative overflow-hidden group/benefit">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-accent/10 group-hover:bg-accent transition-all duration-700" />
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center border border-border/20 shrink-0 shadow-sm transition-transform duration-500 group-hover/benefit:scale-110">
                       <CheckCircle2 className="h-6 w-6 text-accent" />
                    </div>
                    <div className="space-y-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-accent/80">Vantagem Competitiva</p>
                      <p className="text-primary-dark font-medium leading-[1.4] italic text-2xl tracking-tight">
                        "{module.benefit}"
                      </p>
                    </div>
                  </div>
                  
                  {/* Subtle decorative element */}
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-700" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PremiumSection>
  );
}
