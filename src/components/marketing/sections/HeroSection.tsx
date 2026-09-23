import { Link } from "react-router-dom";
import { ArrowRight, Star, Clock, Calendar, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumSection } from "../layout/PremiumSection";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const mockupY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const mockupRotate = useTransform(scrollYProgress, [0, 1], [0, 2]);

  return (
    <PremiumSection
      variant="soft"
      padding="none"
      className="pt-20 pb-12 md:pt-40 md:pb-40 overflow-hidden md:overflow-visible min-h-screen flex items-center"
      containerSize="xl"
    >
      <div ref={containerRef} className="absolute inset-0 pointer-events-none" />
      
      {/* Elementos Visuais de Fundo */}
      <div className="absolute top-0 right-0 w-[70%] h-full bg-[#F3EBF0] -skew-x-6 transform origin-top-right -z-10 translate-x-20 opacity-50 md:opacity-100" />
      <div className="absolute top-1/4 left-10 w-1 h-32 bg-accent/20 hidden lg:block" />
      <div className="absolute top-[10%] right-[5%] text-[12rem] font-display font-bold text-primary/5 select-none pointer-events-none hidden xl:block leading-none">
        CATIVA
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-24 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 px-4 md:px-0 text-center"
        >
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-secondary shadow-sm mb-6 md:mb-8 group cursor-default"
          >
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Gestão Inteligente para Estética e Beleza</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-display text-[2.5rem] sm:text-6xl md:text-7xl xl:text-[7rem] leading-[0.95] tracking-tight text-primary-dark mb-8 relative"
          >
            <span className="relative z-10">O sistema que faz <br className="hidden sm:block" />
            <span className="relative inline-block">
              seu cliente voltar
              <motion.svg 
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1, delay: 1 }}
                className="absolute -bottom-1 sm:-bottom-2 left-0 w-full h-2 sm:h-3 text-accent/30 -z-10" viewBox="0 0 300 12" fill="none"
              >
                <path d="M1 10.5C50 4 150 1 299 10.5" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
              </motion.svg>
            </span>
            {" "}— através de <br className="hidden sm:block" />
            uma <span className="italic font-normal serif text-accent-strong">gestão inteligente.</span></span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto mb-10 font-light"
          >
            A Cativa centraliza agenda, clientes, confirmações, protocolos e indicadores para clínicas e salões que querem reduzir faltas, melhorar o rebooking e crescer com mais previsibilidade.
          </motion.p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-10">
            <div className="flex flex-col gap-3 w-full sm:w-auto">
              <Button asChild size="lg" variant="premium" className="group h-16 px-10 w-full sm:w-[300px] text-lg rounded-2xl" aria-label="Começar agora gratuitamente">
                <Link to="/onboarding" className="flex items-center justify-center gap-2">
                  Começar agora grátis
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <p className="text-[11px] text-muted-foreground font-medium text-center px-4 leading-tight">
                Crie sua conta em 30 segundos <br className="hidden sm:block" /> e organize sua agenda hoje.
              </p>
            </div>
            
            <div className="flex flex-col gap-3 w-full sm:w-auto">
              <Button asChild variant="outline" size="lg" className="h-16 px-10 rounded-2xl w-full sm:w-[300px] text-lg font-bold" aria-label="Ver planos e preços">
                <Link to="/planos">Ver planos e preços</Link>
              </Button>
              <p className="text-[11px] text-muted-foreground font-medium text-center px-4 leading-tight">
                Opções para profissionais <br className="hidden sm:block" /> individuais até grandes clínicas.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-10 px-2">
             <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <img key={i} src={`https://i.pravatar.cc/100?u=${i}`} alt="usuário" className="w-6 h-6 rounded-full border-2 border-white object-cover" />
                ))}
             </div>
              <p className="text-[10px] font-medium text-muted-foreground tracking-tight">
                <span className="text-primary-dark font-bold">Plano grátis vitalício</span>. Sem necessidade de cartão. <br />
                Sua gestão profissional começa aqui, sem custos iniciais.
              </p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-12">
            {["Sem API de WhatsApp", "Mobile-first", "Foco em Retenção"].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary-dark/70">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          style={{ y: mockupY, rotate: mockupRotate }}
          className="relative perspective-1000 px-4 md:px-0 z-0 pt-12 md:pt-20"
        >
          <div className="relative z-20 group">
             {/* Janela Principal do Aplicativo */}
             <motion.div 
               whileHover={{ rotateX: 2, rotateY: -1, y: -5 }}
               className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(75,36,61,0.2)] border border-white/50 p-2 md:p-3 transition-all duration-700"
             >
                <div className="bg-[#FAF7F9] rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-border/20 aspect-[16/11] md:aspect-[16/10] relative group/mockup">
                   {/* Interface do Sistema - Header Simulado com Logo */}
                   <div className="h-12 md:h-14 border-b border-border/40 bg-white/80 backdrop-blur-md px-4 md:px-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Logo size="sm" className="scale-75 origin-left" />
                        </div>
                        <div className="h-4 w-px bg-border/40 mx-1 hidden sm:block" />
                        <div className="hidden sm:flex gap-4">
                          <div className="h-2 w-12 bg-primary-dark/10 rounded-full" />
                          <div className="h-2 w-12 bg-primary-dark/5 rounded-full" />
                        </div>
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
                      {/* Título da Página no Mockup */}
                      <div className="flex justify-between items-end mb-6">
                        <div>
                          <h2 className="text-xs md:text-sm font-bold text-primary-dark uppercase tracking-tight">Índice Cativa</h2>
                          <p className="text-[8px] md:text-[10px] text-muted-foreground">Sua saúde de retenção hoje.</p>
                        </div>
                        <div className="flex gap-2">
                           <div className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-bold text-primary-dark">Hoje</div>
                           <div className="px-2 py-1 rounded-md bg-accent text-[8px] font-bold text-primary-dark shadow-sm">Nova Agenda</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
                         {[
                           { label: "Receita", val: "R$ 12.4k", icon: TrendingUp, color: "text-emerald-700 bg-emerald-500/10", trend: "+12%" },
                           { label: "Agendas", val: "142", icon: Calendar, color: "text-blue-500 bg-blue-500/10", trend: "+5%" },
                           { label: "Clientes", val: "24", icon: Users, color: "text-accent bg-accent/10", trend: "+8%" }
                         ].map((stat, i) => (
                           <motion.div 
                             initial={{ opacity: 0, y: 10 }}
                             whileInView={{ opacity: 1, y: 0 }}
                             transition={{ delay: 0.5 + (i * 0.1) }}
                             key={i} className="bg-white rounded-xl md:rounded-2xl border border-border/40 p-3 md:p-5 shadow-sm hover:shadow-md transition-shadow"
                           >
                              <div className="flex items-center justify-between mb-2">
                                 <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                                 <div className={cn("w-5 h-5 md:w-6 md:h-6 rounded-lg flex items-center justify-center", stat.color)}>
                                    <stat.icon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                 </div>
                              </div>
                              <div className="flex items-baseline gap-1">
                                <div className="text-sm md:text-xl font-display font-bold text-primary-dark">{stat.val}</div>
                                <span className="text-[7px] md:text-[8px] font-bold text-emerald-700">{stat.trend}</span>
                              </div>
                           </motion.div>
                         ))}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 }}
                          className="md:col-span-3 bg-white rounded-[1.5rem] md:rounded-[2rem] border border-border/40 p-4 md:p-6 shadow-sm relative overflow-hidden"
                        >
                           <div className="flex justify-between items-center mb-4 md:mb-6">
                              <div className="flex items-center gap-2">
                                 <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent animate-pulse" />
                                 <span className="text-[9px] md:text-xs font-bold text-primary-dark uppercase tracking-widest">Próximos Atendimentos</span>
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 md:h-8 px-2 md:px-3 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-accent">Agenda Completa</Button>
                           </div>
                           <div className="space-y-3 md:space-y-4">
                              {[
                                { time: "09:00", name: "Ana Paula", service: "Limpeza de Pele", status: "Confirmado", avatar: "A" },
                                { time: "10:30", name: "Beatriz Silva", service: "Peeling Diamante", status: "Confirmado", avatar: "B" },
                                { time: "13:00", name: "Carla Souza", service: "Avaliação", status: "Pendente", avatar: "C" }
                              ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl hover:bg-secondary/10 transition-colors">
                                   <div className="text-[10px] md:text-xs font-bold text-muted-foreground w-10 md:w-12">{item.time}</div>
                                   <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-accent/5 border border-accent/10 flex items-center justify-center text-[10px] font-bold text-accent">
                                      {item.avatar}
                                   </div>
                                   <div className="flex-1">
                                      <div className="text-xs md:text-sm font-bold text-primary-dark">{item.name}</div>
                                      <div className="text-[8px] md:text-[10px] text-muted-foreground">{item.service}</div>
                                   </div>
                                   <div className={cn(
                                     "text-[7px] md:text-[8px] font-black uppercase tracking-widest px-1.5 md:px-2 py-0.5 md:py-1 rounded-full border",
                                     item.status === 'Confirmado' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                   )}>
                                     {item.status}
                                   </div>
                                </div>
                              ))}
                           </div>
                        </motion.div>

                        <div className="md:col-span-2 space-y-4 md:space-y-6">
                           <div className="bg-white rounded-2xl border border-border/40 p-4 shadow-sm">
                             <h3 className="text-[9px] md:text-xs font-bold text-primary-dark mb-4 uppercase tracking-widest">Atalhos</h3>
                             <div className="grid grid-cols-2 gap-2">
                               <div className="aspect-square rounded-xl bg-secondary/20 flex flex-col items-center justify-center gap-1 group/btn cursor-pointer">
                                  <Users className="h-4 w-4 text-primary-dark group-hover/btn:scale-110 transition-transform" />
                                  <span className="text-[8px] font-bold text-primary-dark">Clientes</span>
                               </div>
                               <div className="aspect-square rounded-xl bg-accent/10 flex flex-col items-center justify-center gap-1 group/btn cursor-pointer">
                                  <TrendingUp className="h-4 w-4 text-accent group-hover/btn:scale-110 transition-transform" />
                                  <span className="text-[8px] font-bold text-accent">Relatórios</span>
                               </div>
                             </div>
                           </div>
                           <div className="bg-primary-dark text-white rounded-2xl p-4 shadow-xl relative overflow-hidden group/card">
                             <div className="absolute top-0 right-0 w-20 h-20 bg-accent/20 blur-2xl rounded-full translate-x-10 -translate-y-10 group-hover/card:scale-150 transition-transform duration-700" />
                             <p className="text-[8px] font-bold uppercase tracking-widest opacity-60 mb-2">Dica do dia</p>
                             <p className="text-[10px] md:text-xs font-medium leading-relaxed">Confirme as agendas de amanhã agora para reduzir faltas.</p>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>
             </motion.div>

             {/* Badge Flutuante de Estatística */}
             <motion.div 
               initial={{ opacity: 0, x: 20, rotate: 10 }}
               whileInView={{ opacity: 1, x: 0, rotate: 3 }}
               transition={{ duration: 1, delay: 1 }}
               className="absolute -top-12 -right-4 md:-right-8 bg-white/95 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] shadow-xl p-4 md:p-8 border border-white/50 max-w-[180px] md:max-w-[260px] hidden sm:block z-30"
             >
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
                   <motion.div 
                     initial={{ width: 0 }}
                     whileInView={{ width: "94%" }}
                     transition={{ duration: 1.5, delay: 1.5 }}
                     className="h-full bg-accent" 
                   />
                </div>
                <p className="text-[9px] md:text-[11px] text-muted-foreground leading-relaxed font-light">"A Cativa reduziu nossas faltas em 40% no primeiro mês."</p>
             </motion.div>
          </div>

          {/* Brilho de Fundo Decoraivo */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-accent/5 blur-[100px] rounded-full -z-10" />
        </motion.div>
      </div>
    </PremiumSection>
  );
}
