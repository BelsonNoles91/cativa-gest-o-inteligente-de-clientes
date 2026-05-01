import { Link } from "react-router-dom";
import { ArrowRight, Star, Clock, Calendar, Users, TrendingUp, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumSection } from "../layout/PremiumSection";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <PremiumSection
      variant="soft"
      padding="none"
      className="pt-24 pb-16 md:pt-40 md:pb-40 overflow-hidden md:overflow-visible min-h-[90vh] flex items-center"
      containerSize="xl"
    >
      {/* Elementos Visuais de Fundo */}
      <div className="absolute top-0 right-0 w-[70%] h-full bg-[#F3EBF0] -skew-x-6 transform origin-top-right -z-10 translate-x-20 opacity-50 md:opacity-100" />
      <div className="absolute top-1/4 left-10 w-1 h-32 bg-accent/20 hidden lg:block" />
      <div className="absolute top-[10%] right-[5%] text-[12rem] font-display font-bold text-primary/5 select-none pointer-events-none hidden xl:block leading-none">
        CATIVA
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-24 items-center">
        {/* Lado do Conteúdo */}
        <div className="relative z-10 px-4 md:px-0 text-center lg:text-left">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white border border-secondary shadow-sm mb-8 animate-fade-in group cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Gestão Inteligente para Estética e Beleza</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl xl:text-[7rem] leading-[0.9] tracking-tight text-primary-dark mb-8 animate-fade-in delay-100 relative">
            <span className="relative z-10">A inteligência <br className="hidden sm:block" />
            <span className="relative inline-block">
              que fideliza
              <svg className="absolute -bottom-1 sm:-bottom-2 left-0 w-full h-2 sm:h-3 text-accent/30 -z-10" viewBox="0 0 300 12" fill="none">
                <path d="M1 10.5C50 4 150 1 299 10.5" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
              </svg>
            </span>
            <br className="hidden sm:block" />
            {" "}e faz <span className="italic font-normal serif text-accent">prosperar.</span></span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground/80 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-10 animate-fade-in delay-200 font-light">
            A Cativa centraliza clientes, agendamentos, confirmações e relatórios em um único sistema pensado para quem quer crescer com organização e <span className="text-primary-dark font-medium">fazer o cliente voltar sempre.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-4 mb-6 animate-fade-in delay-300">
            <Button asChild size="lg" className="h-16 px-10 rounded-full bg-primary-dark text-lg shadow-2xl shadow-primary/20 group relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Link to="/demo">
                <span className="relative z-10 flex items-center gap-2">
                  Ver demonstração gratuita
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-accent translate-y-full transition-transform group-hover:translate-y-0" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="lg" className="h-16 px-10 rounded-full border-primary-dark/20 text-lg hover:bg-accent hover:text-white hover:border-accent transition-all">
              <Link to="/onboarding">Começar teste de 14 dias</Link>
            </Button>
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-2 mb-10 animate-fade-in delay-350 px-2">
             <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-secondary flex items-center justify-center overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?u=${i}`} alt="usuário" className="w-full h-full object-cover" />
                  </div>
                ))}
             </div>
             <p className="text-[10px] font-medium text-muted-foreground tracking-tight">
               <span className="text-primary-dark font-bold">14 dias grátis</span>. Sem necessidade de cartão.
             </p>
          </div>

          <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-3 mb-12 animate-fade-in delay-400">
            {["Tudo em um só lugar", "Funciona no celular", "Fácil de usar"].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary-dark/40">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Lado Visual - Painel de Demonstração */}
        <div className="relative animate-scale-in delay-200 perspective-1000 px-4 md:px-0">
          <div className="relative z-20 group">
             {/* Janela Principal do Aplicativo */}
             <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(75,36,61,0.2)] border border-white/50 p-2 md:p-3 transition-all duration-1000 group-hover:rotate-x-2 group-hover:rotate-y-[-1deg] group-hover:translate-y-[-5px]">
                <div className="bg-[#FAF7F9] rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-border/20 aspect-[16/11] md:aspect-[16/10] relative group/mockup">
                   {/* Interface do Sistema */}
                   <div className="h-12 md:h-14 border-b border-border/40 bg-white/80 backdrop-blur-md px-4 md:px-6 flex items-center justify-between">
                      <div className="flex gap-2 md:gap-3">
                        <div className="h-2 w-12 md:w-16 bg-primary-dark/10 rounded-full" />
                        <div className="h-2 w-8 md:w-12 bg-primary-dark/5 rounded-full" />
                      </div>
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                          <Clock className="h-3 w-3 text-accent" />
                        </div>
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-accent/10 border border-accent/20 overflow-hidden">
                           <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" alt="Usuário" className="w-full h-full object-cover" />
                        </div>
                      </div>
                   </div>
                   
                   <div className="p-4 md:p-8">
                      <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
                         {[
                           { label: "Receita", val: "R$ 12.4k", icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10" },
                           { label: "Agendas", val: "142", icon: Calendar, color: "text-blue-500 bg-blue-500/10" },
                           { label: "Clientes", val: "24", icon: Users, color: "text-accent bg-accent/10" }
                         ].map((stat, i) => (
                           <div key={i} className="bg-white rounded-xl md:rounded-2xl border border-border/40 p-3 md:p-5 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                 <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                                 <div className={cn("w-5 h-5 md:w-6 md:h-6 rounded-lg flex items-center justify-center", stat.color)}>
                                    <stat.icon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                 </div>
                              </div>
                              <div className="text-sm md:text-xl font-display font-bold text-primary-dark">{stat.val}</div>
                           </div>
                         ))}
                      </div>
                      
                      <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-border/40 p-4 md:p-6 shadow-sm relative overflow-hidden">
                         <div className="flex justify-between items-center mb-4 md:mb-6">
                            <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent animate-pulse" />
                               <span className="text-[9px] md:text-xs font-bold text-primary-dark uppercase tracking-widest">Agenda de Hoje</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 md:h-8 px-2 md:px-3 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-accent">Ver tudo</Button>
                         </div>
                         <div className="space-y-3 md:space-y-4">
                            {[
                              { time: "09:00", name: "Ana Paula", service: "Procedimento", status: "Confirmado" },
                              { time: "10:30", name: "Beatriz Silva", service: "Avaliação", status: "Em espera" }
                            ].map((item, i) => (
                              <div key={i} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl hover:bg-secondary/10">
                                 <div className="text-[10px] md:text-xs font-bold text-muted-foreground w-10 md:w-12">{item.time}</div>
                                 <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-secondary/30 flex items-center justify-center text-[10px] font-bold text-primary-dark/40">
                                    {item.name.charAt(0)}
                                 </div>
                                 <div className="flex-1">
                                    <div className="text-xs md:text-sm font-bold text-primary-dark">{item.name}</div>
                                    <div className="text-[8px] md:text-[10px] text-muted-foreground">{item.service}</div>
                                 </div>
                                 <div className={cn(
                                   "text-[7px] md:text-[8px] font-black uppercase tracking-widest px-1.5 md:px-2 py-0.5 md:py-1 rounded-full border",
                                   item.status === 'Confirmado' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                 )}>
                                   {item.status}
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Badge Flutuante de Estatística */}
             <div className="absolute -top-12 -right-4 md:-right-8 bg-white/95 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] shadow-xl p-4 md:p-8 border border-white/50 max-w-[180px] md:max-w-[260px] transform rotate-3 hidden sm:block z-40">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-emerald-600" />
                  </div>
                  <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Desempenho</p>
                </div>
                <div className="flex items-baseline gap-1 md:gap-2 mb-3 md:mb-4">
                   <span className="text-3xl md:text-5xl font-display font-bold text-primary-dark tracking-tighter">94%</span>
                   <span className="text-[8px] md:text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 md:px-2 py-0.5 rounded-full">+6%</span>
                </div>
                <div className="w-full h-1 bg-secondary/20 rounded-full overflow-hidden mb-4 md:mb-6">
                   <div className="w-[94%] h-full bg-accent" />
                </div>
                <p className="text-[9px] md:text-[11px] text-muted-foreground/80 leading-relaxed font-light">"A Cativa reduziu nossas faltas em 40% no primeiro mês."</p>
             </div>
          </div>

          {/* Brilho de Fundo Decoraivo */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-accent/5 blur-[100px] rounded-full -z-10" />
        </div>
      </div>
    </PremiumSection>
  );
}
