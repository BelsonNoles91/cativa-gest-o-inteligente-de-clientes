import { Link } from "react-router-dom";
import { ArrowRight, Star, Play, MousePointer2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumSection } from "../layout/PremiumSection";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <PremiumSection
      variant="soft"
      padding="none"
      className="pt-24 pb-20 md:pt-40 md:pb-40 overflow-visible min-h-[90vh] flex items-center"
      containerSize="xl"
    >
      {/* Editorial Background Elements */}
      <div className="absolute top-0 right-0 w-[60%] h-full bg-[#F3EBF0] -skew-x-6 transform origin-top-right -z-10 translate-x-20" />
      <div className="absolute top-1/4 left-10 w-1 h-32 bg-accent/20 hidden lg:block" />
      <div className="absolute top-[10%] right-[5%] text-[12rem] font-display font-bold text-primary/5 select-none pointer-events-none hidden xl:block leading-none">
        CATIVA
      </div>

      <div className="grid lg:grid-cols-2 gap-16 xl:gap-24 items-center">
        {/* Content Side */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white border border-secondary shadow-sm mb-10 animate-fade-in group cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">SaaS Premium para Gestão de Beleza</span>
          </div>

          <h1 className="font-display text-5xl sm:text-7xl md:text-8xl xl:text-[7.5rem] leading-[0.9] tracking-[-0.03em] text-primary-dark mb-10 animate-fade-in delay-100">
            Transforme sua <br className="hidden sm:block" />
            <span className="relative inline-block">
              agenda
              <svg className="absolute -bottom-1 sm:-bottom-2 left-0 w-full h-2 sm:h-3 text-accent/30 -z-10" viewBox="0 0 300 12" fill="none">
                <path d="M1 10.5C50 4 150 1 299 10.5" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
              </svg>
            </span>
            <br className="hidden sm:block" />
            {" "}em <span className="italic font-normal serif text-accent">retenção.</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground/80 leading-relaxed max-w-xl mb-12 animate-fade-in delay-200 font-light">
            A Cativa centraliza clientes, agendamentos, confirmações, protocolos e indicadores em um único sistema pensado para clínicas de estética, salões e negócios de beleza que querem crescer com organização e <span className="text-primary-dark font-medium">fazer o cliente voltar.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 mb-8 animate-fade-in delay-300">
            <Button asChild size="lg" className="h-18 px-10 rounded-none bg-primary-dark text-lg shadow-2xl shadow-primary/20 group relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Link to="/onboarding">
                <span className="relative z-10 flex items-center gap-2">
                  Agendar demonstração
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-accent translate-y-full transition-transform group-hover:translate-y-0" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="lg" className="h-18 px-10 rounded-none border-primary-dark/20 text-lg hover:bg-primary-dark hover:text-white transition-all">
              <Link to="/onboarding">Começar teste</Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 mb-16 animate-fade-in delay-400">
            {["Sem depender de API de WhatsApp", "Mobile-first", "Personalizável para o seu negócio"].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary-dark/40">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                {item}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-12 animate-fade-in delay-500 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-700">
            <div className="flex flex-col gap-1">
               <div className="flex items-center gap-0.5 mb-1">
                 {[1,2,3,4,5].map(i => <Star key={i} className="h-3 w-3 fill-accent text-accent" />)}
               </div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-primary-dark">Excelência Operacional</p>
            </div>
            <div className="h-8 w-px bg-primary/10" />
            <div className="flex flex-col gap-1">
               <p className="text-xl font-display font-bold text-primary-dark leading-none">200+</p>
               <p className="text-[10px] font-bold uppercase tracking-widest text-primary-dark">Marcas Ativas</p>
            </div>
          </div>
        </div>

        {/* Visual Side - Editorial Mockup */}
        <div className="relative animate-scale-in delay-200 perspective-1000">
          <div className="relative z-20 group">
             {/* Main App Window - Skewed/Perspective */}
             <div className="bg-white rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(75,36,61,0.25)] border border-white/50 p-3 transition-all duration-1000 group-hover:rotate-x-2 group-hover:rotate-y-[-2deg] group-hover:translate-y-[-10px]">
                <div className="bg-[#FAF7F9] rounded-[2rem] overflow-hidden border border-border/20 aspect-[16/10] relative">
                   {/* App UI Simulation */}
                   <div className="h-14 border-b border-border/40 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between">
                      <div className="flex gap-3">
                        <div className="h-2 w-16 bg-primary-dark/10 rounded-full" />
                        <div className="h-2 w-12 bg-primary-dark/5 rounded-full" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20" />
                   </div>
                   <div className="p-8">
                      <div className="grid grid-cols-3 gap-6 mb-8">
                         {[1,2,3].map(i => (
                           <div key={i} className="h-28 bg-white rounded-2xl border border-border/40 p-5 shadow-sm">
                              <div className="h-1.5 w-1/2 bg-muted/40 rounded mb-3" />
                              <div className="h-6 w-3/4 bg-primary-dark/5 rounded" />
                           </div>
                         ))}
                      </div>
                      <div className="h-56 bg-white rounded-[2rem] border border-border/40 p-6 shadow-sm relative overflow-hidden">
                         <div className="flex justify-between items-center mb-6">
                            <div className="h-3 w-1/4 bg-muted/40 rounded" />
                            <div className="h-5 w-16 bg-accent/10 rounded-full" />
                         </div>
                         <div className="space-y-5">
                            {[1,2,3].map(i => (
                              <div key={i} className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-full bg-secondary/30" />
                                 <div className="flex-1 space-y-1.5">
                                    <div className="h-2.5 w-1/3 bg-muted/30 rounded" />
                                    <div className="h-1.5 w-1/4 bg-muted/10 rounded" />
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                   
                   {/* Overlay Glow */}
                   <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 via-transparent to-white/20 pointer-events-none" />
                </div>
             </div>

             {/* Floating Mobile App */}
             <div className="absolute -bottom-12 -left-12 w-60 aspect-[9/19] bg-[#1A0F16] rounded-[3rem] p-3 shadow-2xl border-[4px] border-[#2A1523] transform -rotate-6 transition-all duration-1000 group-hover:-rotate-3 group-hover:translate-y-6 hidden md:block z-30">
                <div className="w-full h-full bg-[#FAF7F9] rounded-[2.2rem] overflow-hidden p-5 relative">
                   <div className="w-10 h-1 bg-primary/10 rounded-full mx-auto mb-6" />
                   <div className="h-3 w-3/4 bg-primary-dark/10 rounded-full mb-8" />
                   <div className="space-y-3">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="h-14 bg-white rounded-xl shadow-sm border border-primary/5" />
                      ))}
                   </div>
                   <div className="absolute bottom-8 left-5 right-5 h-10 bg-accent rounded-xl flex items-center justify-center">
                      <div className="w-6 h-0.5 bg-white/40 rounded-full" />
                   </div>
                </div>
             </div>

             {/* Abstract Floating Stats Card */}
             <div className="absolute -top-12 -right-8 bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] p-8 border border-white/50 max-w-[260px] transform rotate-3 transition-all duration-1000 group-hover:rotate-1 group-hover:scale-105 z-40 hidden xl:block">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Otimização</p>
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                   <span className="text-5xl font-display font-bold text-primary-dark tracking-tighter">94%</span>
                   <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">+6.2%</span>
                </div>
                <div className="w-full h-1 bg-secondary/20 rounded-full overflow-hidden mb-6">
                   <div className="w-[94%] h-full bg-accent" />
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed font-light">"A Cativa reduziu nossa taxa de faltas em 40% no primeiro mês de uso."</p>
             </div>
          </div>

          {/* Background Decorative Blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-accent/5 blur-[120px] rounded-full -z-10" />
          
          {/* Interaction Visual Hint */}
          <div className="absolute -bottom-8 right-[15%] animate-bounce hidden lg:block z-50">
             <div className="bg-primary-dark text-white rounded-full p-4 shadow-2xl border border-white/20">
                <MousePointer2 className="h-5 w-5" />
             </div>
          </div>
        </div>
      </div>
    </PremiumSection>
  );
}
