import { PremiumSection, PremiumGrid } from "../layout/PremiumSection";
import { Check, Layers, Zap, Heart, ShieldCheck, BarChart3, Users2, Sparkles } from "lucide-react";

const features = [
  {
    title: "Agenda de Alta Performance",
    description: "Visualização editorial, arraste e solte inteligente e bloqueio antecipado de conflitos.",
    icon: Layers,
    color: "bg-accent/10 text-accent",
  },
  {
    title: "Conversão em 1 Toque",
    description: "Confirmações automáticas via WhatsApp que reduzem o no-show em até 85%.",
    icon: Zap,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Inteligência de Retenção",
    description: "O sistema detecta clientes 'em risco' e sugere ações de reativação automáticas.",
    icon: Heart,
    color: "bg-rose-100 text-rose-600",
  },
  {
    title: "Isolamento Multi-Tenant",
    description: "Arquitetura de segurança bancária para garantir a privacidade total dos seus dados.",
    icon: ShieldCheck,
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    title: "BI & Dashboards Reais",
    description: "Relatórios gerenciais que mostram o lucro real, não apenas o faturamento bruto.",
    icon: BarChart3,
    color: "bg-amber-100 text-amber-600",
  },
  {
    title: "Gestão de Colaboradores",
    description: "Cálculo de comissões, metas e performance individual em uma única tela.",
    icon: Users2,
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
            Pare de perder dinheiro <br />
            <span className="text-accent italic serif font-normal">com buracos na agenda.</span>
          </h2>
        </div>
        <p className="text-xl text-muted-foreground/80 max-w-md pb-4 font-light leading-relaxed">
          Projetado para eliminar a fadiga operacional da recepção e focar no que realmente importa: a experiência do cliente.
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

      {/* Feature Highlight Box */}
      <div className="mt-40 bg-[#1A0F16] rounded-[4rem] overflow-hidden relative">
         <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/10 to-transparent" />
         <div className="grid lg:grid-cols-2 gap-0">
            <div className="p-16 md:p-24 relative z-10">
               <h3 className="text-white text-4xl md:text-6xl font-display font-bold leading-tight mb-10">
                 A única agenda que <br />
                 <span className="text-accent italic font-normal serif">trabalha enquanto você atende.</span>
               </h3>
               <div className="space-y-8">
                  {[
                    "Previsão de cancelamento baseada em comportamento",
                    "Ajuste dinâmico de tempo por profissional",
                    "Integração direta com estoque de produtos"
                  ].map((text, i) => (
                    <div key={i} className="flex items-center gap-6 group">
                       <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center group-hover:border-accent group-hover:bg-accent transition-all duration-500">
                          <Check className="h-4 w-4 text-white" />
                       </div>
                       <span className="text-white/80 text-xl font-light">{text}</span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="bg-[#2A1523] h-full min-h-[400px] relative overflow-hidden flex items-center justify-center">
               <div className="w-[80%] aspect-square bg-gradient-to-br from-accent/20 to-primary/20 rounded-full blur-[100px] absolute" />
               <div className="relative z-10 w-[80%] h-[70%] bg-white/5 backdrop-blur-3xl rounded-3xl border border-white/10 p-10 flex flex-col justify-between">
                  <div className="flex justify-between">
                     <div className="h-4 w-24 bg-white/20 rounded-full" />
                     <div className="h-10 w-10 rounded-full bg-accent/40" />
                  </div>
                  <div className="space-y-4">
                     <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-accent w-3/4 animate-pulse" />
                     </div>
                     <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-white/20 w-1/2" />
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="h-20 flex-1 bg-white/5 rounded-2xl border border-white/5" />
                     <div className="h-20 flex-1 bg-white/5 rounded-2xl border border-white/5" />
                  </div>
               </div>
            </div>
         </div>
      </div>
    </PremiumSection>
  );
}
