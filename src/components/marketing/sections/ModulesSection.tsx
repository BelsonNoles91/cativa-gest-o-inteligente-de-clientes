import { PremiumSection } from "../layout/PremiumSection";
import { Users, Calendar, Settings, Shield, Globe, BarChart, Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const modules = [
  {
    title: "Gestão de Clientes",
    desc: "Tenha uma visão completa de cada cliente com cadastro, histórico, fotos e acompanhamento em um só lugar.",
    benefit: "Quanto melhor sua equipe entende o cliente, melhor ela atende e estimula o retorno.",
    icon: Users,
    id: "01"
  },
  {
    title: "Agenda Inteligente",
    desc: "Visualize horários, profissionais, unidades e disponibilidade com muito mais controle.",
    benefit: "Uma agenda bem organizada reduz perdas, melhora a ocupação e torna a recepção mais ágil.",
    icon: Calendar,
    id: "02"
  },
  {
    title: "Serviços e Pacotes",
    desc: "Cadastre serviços, valores, pacotes de tratamento e regras de uso padronizadas.",
    benefit: "Isso permite organização e melhor acompanhamento do tratamento de cada cliente.",
    icon: Settings,
    id: "03"
  },
  {
    title: "Avisos e Confirmações",
    desc: "Use rotinas de confirmação, avisos automáticos e histórico organizado de contatos.",
    benefit: "Menos faltas, mais controle sobre o dia e mais eficiência para a sua recepção.",
    icon: Shield,
    id: "04"
  },
  {
    title: "Portal do Cliente",
    desc: "O cliente pode agendar, confirmar e acompanhar suas informações de forma moderna.",
    benefit: "Você reduz o trabalho manual e melhora o profissionalismo da sua marca.",
    icon: Globe,
    id: "05"
  },
  {
    title: "Relatórios e Índices",
    desc: "Acompanhe fidelidade, novas marcações, faltas, ocupação e previsão de faturamento.",
    benefit: "Negócios que decidem com base em dados reais crescem com muito mais segurança.",
    icon: BarChart,
    id: "06"
  },
  {
    title: "Índice Cativa",
    desc: "Um indicador exclusivo que mede a saúde real da sua operação e marca.",
    benefit: "Você para de olhar apenas o volume e passa a enxergar a qualidade da sua gestão.",
    icon: Activity,
    id: "07"
  }
];

export function ModulesSection() {
  return (
    <PremiumSection variant="light" padding="lg" id="modulos">
      <div className="max-w-4xl mb-16 md:mb-24 px-4 md:px-0">
        <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-6 md:mb-8">
          Módulos do Sistema
        </div>
        <h2 className="text-4xl md:text-7xl font-display font-bold text-primary-dark leading-[0.95] tracking-tight mb-6 md:mb-8">
          Tudo o que sua operação precisa, <br className="hidden md:block" />
          <span className="text-accent italic serif font-normal">em um único sistema.</span>
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground/80 font-light leading-relaxed max-w-2xl">
          Cada parte da Cativa foi desenhada para resolver um problema real do dia a dia e, ao mesmo tempo, fortalecer a fidelidade dos seus clientes.
        </p>
      </div>

      <div className="grid gap-6 md:gap-10 px-4 md:px-0">
        {modules.map((module, idx) => (
          <div 
            key={idx} 
            className="group relative bg-white rounded-[2rem] md:rounded-[3rem] border border-border/30 p-6 md:p-14 transition-all duration-700 hover:border-accent/40 hover:shadow-xl overflow-hidden"
          >
            {/* Identificador de Fundo */}
            <div className="absolute -top-6 -right-6 text-[8rem] md:text-[12rem] font-display font-bold text-primary-dark/[0.03] select-none pointer-events-none transition-all duration-1000 group-hover:text-accent/[0.08] group-hover:scale-110">
              {module.id}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 lg:gap-20 items-center relative z-10">
              <div className="lg:col-span-1">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2.5rem] bg-[#FAF7F9] flex items-center justify-center text-primary-dark transition-all duration-700 group-hover:bg-accent group-hover:text-white group-hover:scale-110 group-hover:rotate-6 border border-border/10">
                  <module.icon className="h-8 w-8 md:h-10 md:w-10" />
                </div>
              </div>
              
              <div className="lg:col-span-5">
                <div className="flex items-center gap-3 mb-4 md:mb-6">
                   <span className="text-[10px] font-bold text-accent tracking-[0.3em] uppercase opacity-60">Módulo {module.id}</span>
                   <div className="h-px w-8 bg-accent/20" />
                </div>
                <h3 className="text-3xl md:text-5xl font-display font-bold text-primary-dark mb-4 md:mb-6 group-hover:text-accent transition-colors tracking-tighter">
                  {module.title}
                </h3>
                <p className="text-muted-foreground text-base md:text-xl font-light leading-relaxed max-w-lg">
                  {module.desc}
                </p>
              </div>
              
              <div className="lg:col-span-6">
                <div className="bg-[#FAF7F9]/80 backdrop-blur-sm p-6 md:p-12 rounded-[1.5rem] md:rounded-[2.5rem] border border-border/40 group-hover:border-accent/30 transition-all duration-700 relative overflow-hidden group/benefit">
                  <div className="absolute top-0 left-0 w-1 md:w-1.5 h-full bg-accent/10 group-hover:bg-accent transition-all duration-700" />
                  <div className="flex items-start gap-4 md:gap-6">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white flex items-center justify-center border border-border/20 shrink-0 shadow-sm transition-transform duration-500 group-hover/benefit:scale-110">
                       <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-accent" />
                    </div>
                    <div className="space-y-2 md:space-y-4">
                      <p className="text-[9px] md:text-[11px] font-bold uppercase tracking-[0.25em] text-accent/80">Vantagem Principal</p>
                      <p className="text-primary-dark font-medium leading-[1.3] italic text-xl md:text-2xl tracking-tight">
                        "{module.benefit}"
                      </p>
                    </div>
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
