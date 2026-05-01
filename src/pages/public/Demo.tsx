import { PremiumSection } from "@/components/marketing/layout/PremiumSection";
import { PremiumHeader } from "@/components/marketing/layout/PremiumHeader";
import { PremiumFooter } from "@/components/marketing/layout/PremiumFooter";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle2, ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/feedback/StatusBadge";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <PremiumHeader />
      
      <main className="pt-20">
        <PremiumSection variant="soft" padding="lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8">
                Demonstração ao Vivo
              </div>
              <h1 className="text-4xl md:text-7xl font-display font-bold text-primary-dark leading-[0.95] tracking-tight mb-8">
                Veja a Cativa <br />
                <span className="text-accent italic serif font-normal">em ação hoje mesmo.</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground/80 font-light leading-relaxed mb-10 max-w-xl">
                Agende uma conversa rápida de 15 minutos com um de nossos especialistas para ver como a Cativa pode transformar a gestão da sua clínica ou salão.
              </p>
              
              <div className="space-y-6 mb-12">
                {[
                  "Tour completo pelas funcionalidades",
                  "Configuração personalizada para o seu fluxo",
                  "Tire todas as suas dúvidas em tempo real",
                  "Condições especiais para o primeiro mês"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group">
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent transition-all duration-300">
                      <CheckCircle2 className="h-4 w-4 text-accent group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-primary-dark font-medium">{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" variant="premium" className="h-16 px-10 rounded-full text-lg shadow-xl shadow-accent/20">
                  <Link to="/onboarding" className="flex items-center gap-2">
                    Começar Teste Grátis
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-16 px-10 rounded-full text-lg border-primary-dark/20">
                  <a href="#video-demo" className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Ver Vídeo de 2min
                  </a>
                </Button>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-white rounded-[2.5rem] border border-border/40 p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-accent" />
              <div className="mb-10 text-center">
                <h3 className="text-2xl font-display font-bold text-primary-dark mb-2">Escolha um horário</h3>
                <p className="text-sm text-muted-foreground font-light">Selecione o melhor momento para sua demonstração</p>
              </div>

              {/* Calendário Simulado */}
              <div className="grid grid-cols-7 gap-2 mb-10">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
                  <div key={i} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-2">{day}</div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => {
                  const day = i + 1;
                  const isAvailable = day > 10 && day < 25;
                  const isSelected = day === 15;
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all",
                        isSelected ? "bg-accent text-white shadow-lg" : 
                        isAvailable ? "hover:bg-accent/10 cursor-pointer text-primary-dark" : "text-muted-foreground/30"
                      )}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FAF7F9] border border-border/20">
                  <Calendar className="h-5 w-5 text-accent" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-primary-dark">Sexta-feira, 15 de Maio</p>
                    <p className="text-[10px] text-muted-foreground">Dia selecionado</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FAF7F9] border border-border/20">
                  <Clock className="h-5 w-5 text-accent" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-primary-dark">09:30 — 10:00 (15 min)</p>
                    <p className="text-[10px] text-muted-foreground">Horário de Brasília</p>
                  </div>
                </div>
              </div>

              <Button className="w-full h-14 mt-10 rounded-2xl bg-primary-dark text-white font-bold tracking-tight hover:scale-[1.02] transition-transform">
                Confirmar Agendamento
              </Button>
            </motion.div>
          </div>
        </PremiumSection>

        {/* Vídeo Demo Section */}
        <PremiumSection id="video-demo" variant="light" padding="lg">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <StatusBadge tone="brand">Vídeo Tour</StatusBadge>
              <h2 className="text-3xl md:text-5xl font-display font-bold text-primary-dark mt-4">
                Quer apenas ver como é? <br />
                <span className="text-accent italic serif font-normal">Dê o play abaixo.</span>
              </h2>
            </div>
            
            <div className="aspect-video bg-[#1A0F16] rounded-[2.5rem] md:rounded-[4rem] shadow-2xl relative overflow-hidden group border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="w-20 h-20 md:w-32 md:h-32 rounded-full bg-accent/90 flex items-center justify-center text-white shadow-2xl transition-all duration-500 group-hover:scale-110 group-hover:bg-accent group-hover:shadow-[0_0_40px_rgba(168,76,134,0.5)]">
                  <Play className="h-8 w-8 md:h-12 md:h-12 fill-current ml-1" />
                </button>
              </div>
              <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
                <div className="space-y-2">
                  <p className="text-white font-display text-xl md:text-3xl font-bold">Tour da Plataforma</p>
                  <p className="text-white/60 text-xs md:text-sm font-light tracking-wide uppercase">Cativa v2.0 · Estética e Beleza</p>
                </div>
                <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold">
                  02:14
                </div>
              </div>
            </div>
          </div>
        </PremiumSection>
      </main>
      
      <PremiumFooter />
    </div>
  );
}
