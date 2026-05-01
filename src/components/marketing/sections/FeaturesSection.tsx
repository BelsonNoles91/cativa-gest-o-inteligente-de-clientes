import { PremiumSection, PremiumGrid } from "../layout/PremiumSection";
import { Check, Layers, Zap, Heart, ShieldCheck, BarChart3, Users2, Sparkles } from "lucide-react";

const features = [
  {
    title: "CRM focado em Retenção",
    description: "Centralize histórico, preferências, protocolos e status de retorno em um só lugar para agir na hora certa.",
    icon: Users2,
    color: "bg-accent/10 text-accent",
  },
  {
    title: "Agenda Operacional Real",
    description: "Visualize a rotina por profissional e unidade, reagende com agilidade e reduza conflitos de horários.",
    icon: Layers,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Central de Confirmação",
    description: "Trabalhe com filas, templates e rotinas claras de contato, mantendo o processo seguro e previsível.",
    icon: Zap,
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    title: "Pacotes e Protocolos",
    description: "Acompanhe jornadas de tratamento, consumo de sessões e oportunidades de retorno com clareza.",
    icon: Sparkles,
    color: "bg-rose-100 text-rose-600",
  },
  {
    title: "Portal do Cliente",
    description: "Dê autonomia para agendar, confirmar e acompanhar informações de forma profissional.",
    icon: Heart,
    color: "bg-amber-100 text-amber-600",
  },
  {
    title: "Indicadores Decisivos",
    description: "Saiba quem voltou, quem não voltou, onde estão os gargalos e o que fazer para melhorar o faturamento.",
    icon: BarChart3,
    color: "bg-indigo-100 text-indigo-600",
  },
];

export function FeaturesSection() {
  return (
    <PremiumSection variant="light" padding="lg" id="features">
      <div className="flex flex-col lg:flex-row gap-20 items-end mb-32">
        <div className="max-w-2xl">
          <div className="inline-block px-4 py-1.5 rounded-full bg-secondary/50 text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-8">
            Funcionalidades Core
          </div>
          <h2 className="text-5xl md:text-7xl font-display font-bold text-primary-dark leading-[0.95] tracking-tight">
            Uma plataforma pensada para <br />
            <span className="text-accent italic serif font-normal">transformar rotina em resultado.</span>
          </h2>
        </div>
        <p className="text-xl text-muted-foreground/80 max-w-md pb-4 font-light leading-relaxed">
          A Cativa organiza o que normalmente fica espalhado entre agenda, mensagens e decisões improvisadas.
        </p>
      </div>

      <PremiumGrid cols="3" gap="lg">
        {features.map((feature, idx) => (
          <div key={idx} className="group relative">
             <div className="mb-10 relative inline-block">
                <div className={`w-20 h-20 rounded-[2rem] ${feature.color} flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                   <feature.icon className="h-10 w-10" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border border-border/10 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-0 group-hover:scale-100">
                   <Sparkles className="h-4 w-4 text-accent" />
                </div>
             </div>
             <h3 className="text-2xl font-display font-bold text-primary-dark mb-6 group-hover:text-accent transition-colors">
               {feature.title}
             </h3>
             <p className="text-muted-foreground leading-relaxed font-light text-lg">
               {feature.description}
             </p>
             <div className="mt-8 h-px w-0 bg-accent transition-all duration-700 group-hover:w-full" />
          </div>
        ))}
      </PremiumGrid>

      {/* Feature Highlight Box - Elevated Editorial Style */}
      <div className="mt-40 bg-[#1A0F16] rounded-[2.5rem] md:rounded-[4rem] overflow-hidden relative shadow-2xl">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(168,76,134,0.15),transparent_50%)]" />
         <div className="grid lg:grid-cols-2 gap-0 relative z-10">
            <div className="p-16 md:p-24 flex flex-col justify-center">
               <div className="inline-block px-4 py-1.5 rounded-full bg-accent/20 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-12 border border-accent/20 w-fit">
                 Visão Estratégica
               </div>
               <h3 className="text-white text-4xl md:text-7xl font-display font-bold leading-[0.9] tracking-tighter mb-10">
                 O problema não é só agenda. <br />
                 <span className="text-accent italic font-normal serif">É falta de inteligência sobre a jornada.</span>
               </h3>
               <div className="space-y-10">
                  {[
                    "Aumente o faturamento através da retenção ativa",
                    "Reduza no-shows com rotinas de confirmação",
                    "Acompanhe o Índice Cativa de saúde do negócio"
                  ].map((text, i) => (
                    <div key={i} className="flex items-center gap-6 group">
                       <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center group-hover:border-accent group-hover:bg-accent transition-all duration-500 shrink-0">
                          <Check className="h-5 w-5 text-white" />
                       </div>
                       <span className="text-white/80 text-2xl font-light tracking-tight group-hover:text-white transition-colors">{text}</span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="bg-[#2A1523] h-full min-h-[500px] relative overflow-hidden flex items-center justify-center border-l border-white/5">
               <div className="w-[120%] aspect-square bg-[radial-gradient(circle,rgba(168,76,134,0.1)_0%,transparent_70%)] absolute top-[-20%] right-[-20%]" />
               
               {/* Abstract Dashboard Component */}
               <div className="relative z-10 w-[85%] aspect-[4/3] bg-white/5 backdrop-blur-2xl rounded-[3rem] border border-white/10 p-12 flex flex-col justify-between shadow-2xl transform rotate-2">
                  <div className="flex justify-between items-start">
                     <div className="space-y-3">
                        <div className="h-4 w-32 bg-white/20 rounded-full" />
                        <div className="h-2 w-20 bg-white/10 rounded-full" />
                     </div>
                     <div className="w-14 h-14 rounded-2xl bg-accent/30 flex items-center justify-center border border-accent/40 shadow-[0_0_30px_rgba(168,76,134,0.3)]">
                        <BarChart3 className="h-6 w-6 text-white" />
                     </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center gap-10">
                     <div className="space-y-6">
                        <div className="flex justify-between items-end">
                           <div className="h-3 w-1/4 bg-white/10 rounded-full" />
                           <span className="text-accent font-display text-4xl font-bold">82%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-accent w-4/5 shadow-[0_0_20px_rgba(168,76,134,0.5)]" />
                        </div>
                     </div>
                     <div className="space-y-6">
                        <div className="flex justify-between items-end">
                           <div className="h-3 w-1/3 bg-white/10 rounded-full" />
                           <span className="text-white font-display text-4xl font-bold">R$ 42k</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-white/30 w-3/5" />
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-6">
                     <div className="h-24 flex-1 bg-white/5 rounded-3xl border border-white/5 p-6 flex flex-col justify-between">
                        <div className="h-2 w-1/2 bg-white/10 rounded-full" />
                        <div className="h-6 w-3/4 bg-accent/20 rounded" />
                     </div>
                     <div className="h-24 flex-1 bg-white/5 rounded-3xl border border-white/5 p-6 flex flex-col justify-between">
                        <div className="h-2 w-1/2 bg-white/10 rounded-full" />
                        <div className="h-6 w-3/4 bg-white/10 rounded" />
                     </div>
                  </div>
               </div>
               
               {/* Decorative dots grid */}
               <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>
         </div>
      </div>
    </PremiumSection>
  );
}
