import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumSection } from "../layout/PremiumSection";

export function HeroSection() {
  return (
    <PremiumSection
      variant="soft"
      padding="none"
      className="pt-32 pb-16 md:pt-48 md:pb-32 overflow-visible"
    >
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[#E9D7E2]/20 -skew-x-12 transform origin-top-right -z-10" />
      <div className="absolute -top-24 left-1/4 w-64 h-64 bg-accent/10 blur-[100px] rounded-full -z-10" />

      <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
        {/* Content */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-secondary shadow-sm mb-6 animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Sistema Premium para Beleza</span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.05] tracking-tight text-primary-dark mb-6 animate-fade-in delay-100">
            A gestão que faz seu <br /> 
            <span className="text-accent italic">cliente voltar</span>.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mb-10 animate-fade-in delay-200">
            Mais do que uma agenda. Uma plataforma inteligente de <span className="text-primary-dark font-semibold">retenção e crescimento</span> desenhada para clínicas e salões que buscam excelência operacional.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-10 w-full sm:w-auto animate-fade-in delay-300">
            <Button asChild size="lg" className="h-16 px-8 rounded-full bg-primary-dark text-lg shadow-xl shadow-primary/20 group">
              <Link to="/onboarding">
                Agendar demonstração
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-16 px-8 rounded-full text-lg border-2 border-transparent hover:border-secondary transition-all group">
              <Link to="#video" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Play className="h-4 w-4 fill-current" />
                </div>
                Ver como funciona
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-6 animate-fade-in delay-500">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-secondary flex items-center justify-center text-[10px] font-bold overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
                </div>
              ))}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => <Star key={s} className="h-3.5 w-3.5 fill-accent text-accent" />)}
                <span className="ml-1 text-sm font-bold text-primary-dark">4.9/5</span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">+200 estabelecimentos no Brasil</p>
            </div>
          </div>
        </div>

        {/* Visual / Mockup */}
        <div className="lg:col-span-6 xl:col-span-5 relative mt-12 lg:mt-0 animate-scale-in">
          <div className="relative z-10 p-2 md:p-4 rounded-[40px] bg-white shadow-2xl border border-border/40 overflow-hidden">
             {/* Mockup do sistema simplificado */}
             <div className="aspect-[4/3] bg-[#FAF7F9] rounded-[32px] overflow-hidden border border-border/20 flex flex-col">
                <div className="h-14 border-b border-border/40 bg-white/50 px-6 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/20" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/20" />
                    <div className="w-3 h-3 rounded-full bg-green-400/20" />
                  </div>
                  <div className="h-6 w-32 bg-secondary/30 rounded-full" />
                  <div className="w-8 h-8 rounded-full bg-primary/10" />
                </div>
                <div className="flex-1 p-6 flex gap-4">
                  <div className="w-1/4 space-y-3">
                    <div className="h-8 w-full bg-primary-soft rounded-lg" />
                    <div className="h-8 w-full bg-secondary/10 rounded-lg" />
                    <div className="h-8 w-full bg-secondary/10 rounded-lg" />
                    <div className="h-8 w-full bg-secondary/10 rounded-lg" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-24 bg-white rounded-2xl border border-border/40 p-4 shadow-sm">
                        <div className="h-2 w-1/2 bg-muted rounded mb-2" />
                        <div className="h-6 w-3/4 bg-primary-dark rounded" />
                      </div>
                      <div className="h-24 bg-white rounded-2xl border border-border/40 p-4 shadow-sm">
                        <div className="h-2 w-1/2 bg-muted rounded mb-2" />
                        <div className="h-6 w-3/4 bg-accent rounded" />
                      </div>
                    </div>
                    <div className="h-48 bg-white rounded-2xl border border-border/40 p-4 shadow-sm">
                       <div className="flex items-center justify-between mb-4">
                         <div className="h-4 w-1/3 bg-muted rounded" />
                         <div className="h-4 w-8 bg-success-soft rounded" />
                       </div>
                       <div className="space-y-3">
                         {[1,2,3].map(i => (
                           <div key={i} className="flex gap-3 items-center">
                             <div className="w-8 h-8 rounded-full bg-secondary/30" />
                             <div className="flex-1 space-y-1">
                               <div className="h-3 w-1/2 bg-muted rounded" />
                               <div className="h-2 w-1/3 bg-muted/50 rounded" />
                             </div>
                             <div className="w-12 h-4 bg-primary-soft rounded" />
                           </div>
                         ))}
                       </div>
                    </div>
                  </div>
                </div>
             </div>
          </div>

          {/* Floating UI Elements */}
          <div className="absolute -top-6 -right-6 md:-right-12 bg-white rounded-2xl shadow-xl p-4 border border-border/40 animate-bounce duration-[3000ms] flex items-center gap-3 z-20">
            <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No-show reduzido</p>
              <p className="text-lg font-display font-bold text-primary-dark">-42% em 30 dias</p>
            </div>
          </div>

          <div className="absolute -bottom-10 -left-6 md:-left-12 bg-primary-dark rounded-2xl shadow-xl p-5 border border-white/10 animate-pulse duration-[4000ms] z-20 max-w-[200px]">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Índice Cativa</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-display font-bold text-white leading-none">88</span>
              <span className="text-xs text-success font-bold mb-1">+12% ↑</span>
            </div>
            <p className="text-[10px] text-white/50 mt-2">Sua retenção de clientes está acima da média do setor.</p>
          </div>
        </div>
      </div>
    </PremiumSection>
  );
}
