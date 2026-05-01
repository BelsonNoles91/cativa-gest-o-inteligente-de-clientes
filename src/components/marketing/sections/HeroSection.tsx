import { Link } from "react-router-dom";
import { ArrowRight, Star, Play, MousePointer2 } from "lucide-react";
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

          <h1 className="font-display text-6xl md:text-8xl xl:text-[7.5rem] leading-[0.9] tracking-[-0.03em] text-primary-dark mb-10 animate-fade-in delay-100">
            Design que <br />
            <span className="relative inline-block">
              converte
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-accent/30 -z-10" viewBox="0 0 300 12" fill="none">
                <path d="M1 10.5C50 4 150 1 299 10.5" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
              </svg>
            </span>
            <br />
            em <span className="italic font-normal serif">lealdade</span>.
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground/80 leading-relaxed max-w-xl mb-12 animate-fade-in delay-200 font-light">
            A Cativa não é apenas uma agenda. É a <span className="text-primary-dark font-medium">arquitetura operacional</span> das clínicas e estúdios mais desejados do país.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 mb-16 animate-fade-in delay-300">
            <Button asChild size="lg" className="h-18 px-10 rounded-none bg-primary-dark text-lg shadow-2xl shadow-primary/20 group relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Link to="/onboarding">
                <span className="relative z-10 flex items-center gap-2">
                  Agendar Demonstração
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-accent translate-y-full transition-transform group-hover:translate-y-0" />
              </Link>
            </Button>
            
            <button className="flex items-center gap-4 group px-4 py-2 transition-all hover:translate-x-1">
              <div className="w-14 h-14 rounded-full border border-primary/10 flex items-center justify-center text-primary-dark group-hover:bg-primary-dark group-hover:text-white transition-all duration-500">
                <Play className="h-5 w-5 fill-current ml-1" />
              </div>
              <span className="font-bold text-sm uppercase tracking-widest text-primary-dark/60 group-hover:text-primary-dark">Assistir Filme</span>
            </button>
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
        <div className="relative animate-scale-in delay-200">
          <div className="relative z-20 group">
             {/* Main App Window - Skewed/Perspective */}
             <div className="bg-white rounded-[2rem] shadow-[0_50px_100px_-20px_rgba(75,36,61,0.25)] border border-white p-4 transition-transform duration-700 group-hover:rotate-1">
                <div className="bg-[#FAF7F9] rounded-[1.5rem] overflow-hidden border border-border/20 aspect-[16/10]">
                   {/* App UI Simulation */}
                   <div className="h-16 border-b border-border/40 bg-white/80 backdrop-blur px-8 flex items-center justify-between">
                      <div className="flex gap-4">
                        <div className="h-3 w-20 bg-secondary/40 rounded-full" />
                        <div className="h-3 w-16 bg-secondary/20 rounded-full" />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/5 border border-primary/10" />
                   </div>
                   <div className="p-10">
                      <div className="grid grid-cols-3 gap-8 mb-10">
                         {[1,2,3].map(i => (
                           <div key={i} className="h-32 bg-white rounded-2xl border border-border/40 p-6 shadow-sm">
                              <div className="h-2 w-1/2 bg-muted/40 rounded mb-4" />
                              <div className="h-8 w-3/4 bg-primary-dark/10 rounded" />
                           </div>
                         ))}
                      </div>
                      <div className="h-64 bg-white rounded-3xl border border-border/40 p-8 shadow-sm relative overflow-hidden">
                         <div className="flex justify-between items-center mb-8">
                            <div className="h-4 w-1/4 bg-muted/40 rounded" />
                            <div className="h-6 w-20 bg-accent/10 rounded-full" />
                         </div>
                         <div className="space-y-6">
                            {[1,2,3].map(i => (
                              <div key={i} className="flex items-center gap-6">
                                 <div className="w-12 h-12 rounded-full bg-secondary/30" />
                                 <div className="flex-1 space-y-2">
                                    <div className="h-3 w-1/3 bg-muted/30 rounded" />
                                    <div className="h-2 w-1/4 bg-muted/10 rounded" />
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Floating Mobile App */}
             <div className="absolute -bottom-16 -left-12 w-64 aspect-[9/19] bg-primary-dark rounded-[3rem] p-3 shadow-2xl border-[6px] border-[#2A1523] transform -rotate-6 transition-transform duration-1000 group-hover:-rotate-2 group-hover:translate-y-4 hidden md:block z-30">
                <div className="w-full h-full bg-[#FAF7F9] rounded-[2.2rem] overflow-hidden p-6 relative">
                   <div className="w-1/2 h-1 bg-primary/10 rounded-full mx-auto mb-8" />
                   <div className="h-4 w-3/4 bg-primary-dark/20 rounded-full mb-10" />
                   <div className="space-y-4">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-16 bg-white rounded-2xl shadow-sm border border-primary/5" />
                      ))}
                   </div>
                   <div className="absolute bottom-10 left-6 right-6 h-12 bg-accent rounded-2xl flex items-center justify-center">
                      <div className="w-8 h-1 bg-white/40 rounded-full" />
                   </div>
                </div>
             </div>

             {/* Abstract Floating Stats Card */}
             <div className="absolute -top-10 -right-10 bg-white rounded-3xl shadow-2xl p-8 border border-border/40 max-w-[240px] transform rotate-3 transition-transform duration-1000 group-hover:rotate-6 z-40 hidden xl:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Eficiência de Retenção</p>
                <div className="flex items-baseline gap-3 mb-4">
                   <span className="text-5xl font-display font-bold text-primary-dark tracking-tighter">94%</span>
                   <span className="text-xs font-bold text-success">+6.2%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary/30 rounded-full overflow-hidden">
                   <div className="w-[94%] h-full bg-accent" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed italic">"Desde que implementamos a Cativa, a taxa de retorno cresceu exponencialmente."</p>
             </div>
          </div>

          {/* Background Decorative Blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-accent/10 blur-[120px] rounded-full -z-10" />
          
          {/* Mouse Cursor Interaction Hint */}
          <div className="absolute bottom-0 right-[20%] animate-bounce hidden lg:block z-50">
             <div className="bg-primary-dark text-white rounded-full p-4 shadow-xl">
                <MousePointer2 className="h-6 w-6" />
             </div>
          </div>
        </div>
      </div>
    </PremiumSection>
  );
}
