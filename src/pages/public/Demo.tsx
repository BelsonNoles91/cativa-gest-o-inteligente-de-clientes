import { PremiumSection } from "@/components/marketing/layout/PremiumSection";
import { PremiumHeader } from "@/components/marketing/layout/PremiumHeader";
import { PremiumFooter } from "@/components/marketing/layout/PremiumFooter";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle2, ArrowRight, Play, Check, Users, TrendingUp, Shield, Settings, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useState } from "react";
import { toast } from "sonner";

export default function DemoPage() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [demoStep, setDemoStep] = useState<'calendar' | 'service' | 'time' | 'confirm'>('calendar');
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'enterprise'>('pro');

  const services = [
    { id: 'limpeza', name: 'Limpeza de Pele', price: 'R$ 120' },
    { id: 'peeling', name: 'Peeling Diamante', price: 'R$ 180' },
    { id: 'massagem', name: 'Massagem Relaxante', price: 'R$ 150' },
  ];

  const times = ['09:00', '09:30', '10:00', '11:00', '14:00', '15:30'];

  const handleDaySelect = (day: number, isAvailable: boolean) => {
    if (!isAvailable) {
      toast.error("Este dia não possui horários disponíveis no momento.");
      return;
    }
    setSelectedDay(day);
    setDemoStep('service');
  };

  const handleServiceSelect = (service: string) => {
    setSelectedService(service);
    setDemoStep('time');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setDemoStep('confirm');
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    toast.success("Demonstração agendada com sucesso!");
    
    setTimeout(() => {
      navigate(`/onboarding?demo_date=2026-05-${selectedDay}&demo_time=${selectedTime}&demo_service=${selectedService}`);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-background">
      <PremiumHeader />
      
      <main className="pt-20">
        <PremiumSection variant="soft" padding="none" className="min-h-[calc(100vh-80px)] flex items-center py-12 md:py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
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
              className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-border/40 p-4 md:p-8 lg:p-12 shadow-2xl relative overflow-hidden min-h-[500px] md:min-h-[600px] flex flex-col justify-center w-full max-w-xl mx-auto"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-accent" />
              
              <AnimatePresence mode="wait">
                {!isConfirmed ? (
                  <motion.div
                    key="calendar-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    {demoStep === 'calendar' && (
                      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <div className="mb-8 md:mb-10 text-center">
                          <h3 className="text-3xl lg:text-4xl font-display font-bold text-primary-dark mb-2">Escolha um dia</h3>
                          <p className="text-sm lg:text-base text-muted-foreground font-light">Selecione uma data disponível para agendar sua demonstração</p>
                        </div>

                        <div className="grid grid-cols-7 gap-2 lg:gap-3 mb-10">
                          {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
                            <div key={i} className="text-center text-[11px] font-bold text-muted-foreground uppercase py-2">{day}</div>
                          ))}
                          {Array.from({ length: 31 }).map((_, i) => {
                            const day = i + 1;
                            const isAvailable = day > 10 && day < 25;
                            const isSelected = day === selectedDay;
                            return (
                              <button 
                                key={i} 
                                onClick={() => handleDaySelect(day, isAvailable)}
                                type="button"
                                aria-label={`Dia ${day}${isSelected ? " - selecionado" : ""}${!isAvailable ? " - indisponível" : ""}`}
                                className={cn(
                                  "aspect-square rounded-xl lg:rounded-2xl flex items-center justify-center text-sm lg:text-base font-medium transition-all focus:outline-none focus:ring-2 focus:ring-accent",
                                  isSelected ? "bg-accent text-white shadow-xl scale-110 z-10" : 
                                  isAvailable ? "hover:bg-accent/10 cursor-pointer text-primary-dark border border-transparent hover:border-accent/20" : "text-muted-foreground/20 cursor-not-allowed"
                                )}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {demoStep === 'service' && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 py-4">
                        <div className="text-center mb-6">
                          <h3 className="text-2xl font-display font-bold text-primary-dark">Qual o serviço?</h3>
                          <button onClick={() => setDemoStep('calendar')} className="text-[10px] text-accent font-bold uppercase tracking-widest mt-1 hover:underline">Voltar para o dia</button>
                        </div>
                        {services.map(s => (
                          <button
                            key={s.id}
                            onClick={() => handleServiceSelect(s.name)}
                            className={cn(
                              "w-full p-4 rounded-2xl border transition-all text-left flex justify-between items-center group",
                              selectedService === s.name ? "border-accent bg-accent/5" : "border-border/40 hover:border-accent/30"
                            )}
                          >
                            <div>
                              <p className="text-sm font-bold text-primary-dark">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground">Especialista disponível</p>
                            </div>
                            <span className="text-sm font-display font-bold text-accent">{s.price}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {demoStep === 'time' && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 py-4">
                        <div className="text-center mb-6">
                          <h3 className="text-2xl font-display font-bold text-primary-dark">Escolha um horário</h3>
                          <button onClick={() => setDemoStep('service')} className="text-[10px] text-accent font-bold uppercase tracking-widest mt-1 hover:underline">Alterar serviço</button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {times.map(t => (
                            <button
                              key={t}
                              onClick={() => handleTimeSelect(t)}
                              className={cn(
                                "py-3 rounded-xl border text-center text-xs font-bold transition-all",
                                selectedTime === t ? "bg-accent text-white border-accent shadow-md" : "border-border/40 hover:border-accent/30 text-primary-dark"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {demoStep === 'confirm' && (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4">
                        <div className="text-center mb-6">
                          <h3 className="text-2xl font-display font-bold text-primary-dark">Quase lá!</h3>
                          <p className="text-xs text-muted-foreground">Confirme os detalhes abaixo</p>
                        </div>
                        <div className="space-y-3">
                          <div className="p-4 rounded-2xl bg-[#FAF7F9] border border-border/20 flex items-center gap-4">
                            <Calendar className="h-5 w-5 text-accent" />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-primary-dark">{selectedDay} de Maio, 2026</p>
                              <p className="text-[10px] text-muted-foreground">Data da demonstração</p>
                            </div>
                          </div>
                          <div className="p-4 rounded-2xl bg-[#FAF7F9] border border-border/20 flex items-center gap-4">
                            <Clock className="h-5 w-5 text-accent" />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-primary-dark">{selectedTime} (15 min)</p>
                              <p className="text-[10px] text-muted-foreground">Horário selecionado</p>
                            </div>
                          </div>
                          <div className="p-4 rounded-2xl bg-[#FAF7F9] border border-border/20 flex items-center gap-4">
                            <Sparkles className="h-5 w-5 text-accent" />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-primary-dark">{selectedService}</p>
                              <p className="text-[10px] text-muted-foreground">Serviço de foco</p>
                            </div>
                          </div>
                        </div>
                        <Button 
                          onClick={handleConfirm}
                          className="w-full h-14 mt-4 rounded-2xl bg-primary-dark text-white font-bold tracking-tight hover:scale-[1.02] transition-transform"
                        >
                          Agendar Demonstração
                        </Button>
                        <button onClick={() => setDemoStep('time')} className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent">Voltar e ajustar</button>
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="success-view"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-12 md:py-16 text-center"
                  >
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-8">
                      <Check className="h-10 w-10 md:h-12 md:w-12 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-display font-bold text-primary-dark mb-4">Agendado!</h3>
                    <p className="text-muted-foreground max-w-xs mx-auto mb-8 leading-relaxed">
                      Sua demonstração foi marcada para o dia <span className="font-bold text-primary-dark">{selectedDay} de Maio às {selectedTime}</span>.
                    </p>
                    <div className="inline-flex items-center gap-2 text-accent text-sm font-bold uppercase tracking-widest animate-pulse">
                      Redirecionando para o onboarding...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
            
            <div className="aspect-video bg-[#1A0F16] rounded-[1.5rem] md:rounded-[4rem] shadow-2xl relative overflow-hidden group border border-white/5">
              {!isPlaying ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button 
                      onClick={() => setIsPlaying(true)}
                      className="w-20 h-20 md:w-32 md:h-32 rounded-full bg-accent/90 flex items-center justify-center text-white shadow-2xl transition-all duration-500 group-hover:scale-110 group-hover:bg-accent group-hover:shadow-[0_0_40px_rgba(168,76,134,0.5)] z-20"
                      aria-label="Play video demonstration"
                    >
                      <Play className="h-8 w-8 md:h-12 md:h-12 fill-current ml-1" />
                    </button>
                  </div>
                  <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end z-10">
                    <div className="space-y-2">
                      <p className="text-white font-display text-xl md:text-3xl font-bold">Tour da Plataforma</p>
                      <p className="text-white/60 text-xs md:text-sm font-light tracking-wide uppercase">Cativa v2.0 · Estética e Beleza</p>
                    </div>
                    <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold">
                      02:14
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 w-full h-full bg-[#FAF7F9] flex flex-col z-30">
                  {/* Header do Mockup */}
                  <div className="h-12 bg-white border-b border-border/40 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Logo size="sm" className="scale-75 origin-left" />
                    </div>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                  </div>

                  <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar do Mockup */}
                    <div className="w-16 bg-white border-r border-border/40 py-4 flex flex-col items-center gap-6">
                      {[Calendar, Users, TrendingUp, Shield, Settings].map((Icon, i) => (
                        <div key={i} className={cn("p-2 rounded-xl transition-colors", i === 0 ? "bg-accent/10 text-accent" : "text-muted-foreground")}>
                          <Icon className="w-4 h-4" />
                        </div>
                      ))}
                    </div>

                    {/* Conteúdo do Mockup com Animação */}
                    <div className="flex-1 p-6 overflow-hidden">
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-6"
                      >
                        <div className="flex justify-between items-end">
                          <div>
                            <h4 className="text-lg font-bold text-primary-dark">Agenda de Hoje</h4>
                            <p className="text-[10px] text-muted-foreground">Sexta-feira, 15 de Maio</p>
                          </div>
                          <div className="bg-emerald-500/10 text-emerald-600 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-500/20">
                            87% Ocupação
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { time: "09:00", name: "Ana Paula", service: "Limpeza de Pele", status: "Confirmado", color: "emerald", bgColor: "bg-emerald-500/10", textColor: "text-emerald-600", dotColor: "bg-emerald-500" },
                            { time: "10:30", name: "Beatriz Silva", service: "Peeling", status: "Aguardando", color: "amber", bgColor: "bg-amber-500/10", textColor: "text-amber-600", dotColor: "bg-amber-500" },
                            { time: "13:00", name: "Carla Souza", service: "Avaliação", status: "Pendente", color: "blue", bgColor: "bg-blue-500/10", textColor: "text-blue-600", dotColor: "bg-blue-500" },
                            { time: "14:30", name: "Indisponível", service: "Bloqueio", status: "Ocupado", color: "slate", bgColor: "bg-slate-500/10", textColor: "text-slate-600", dotColor: "bg-slate-500" }
                          ].map((item, i) => (
                            <motion.div 
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 + (i * 0.1) }}
                              className="bg-white p-3 rounded-2xl border border-border/40 shadow-sm flex items-center gap-3"
                            >
                              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs", item.bgColor, item.textColor)}>
                                {item.name.charAt(0)}
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold text-primary-dark truncate">{item.name}</p>
                                <div className="flex items-center gap-1">
                                  <div className={cn("w-1.5 h-1.5 rounded-full", item.dotColor)} />
                                  <p className="text-[9px] text-muted-foreground truncate">{item.status}</p>
                                </div>
                              </div>
                              <div className="text-[8px] font-bold text-muted-foreground">{item.time}</div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Gráfico Simulado */}
                        <div className="bg-white p-4 rounded-2xl border border-border/40 shadow-sm">
                          <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] font-bold text-primary-dark uppercase tracking-widest">Faturamento Semanal</p>
                            <span className="text-emerald-500 font-bold text-xs">+12.5%</span>
                          </div>
                          <div className="flex items-end gap-2 h-20">
                            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                              <motion.div 
                                key={i}
                                initial={{ height: 0 }}
                                animate={{ height: `${h}%` }}
                                transition={{ delay: 0.5 + (i * 0.05), duration: 1 }}
                                className={cn("flex-1 rounded-t-md", i === 5 ? "bg-accent" : "bg-accent/20")}
                              />
                            ))}
                          </div>
                        </div>
                        {/* Seletor de Plano Simulado */}
                        <div className="space-y-3">
                          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                            {(['basic', 'pro', 'enterprise'] as const).map((plan) => (
                              <button
                                key={plan}
                                onClick={() => setSelectedPlan(plan)}
                                className={cn(
                                  "flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all",
                                  selectedPlan === plan ? "bg-white shadow-sm text-accent" : "text-muted-foreground"
                                )}
                              >
                                {plan}
                              </button>
                            ))}
                          </div>
                          
                          <div className="flex gap-4">
                            <div className="flex-1 bg-white p-3 rounded-2xl border border-accent/20 shadow-sm relative overflow-hidden">
                              <p className="text-[7px] font-black uppercase text-accent mb-1 tracking-widest capitalize">{selectedPlan} Plan</p>
                              <p className="text-[10px] font-bold text-primary-dark mb-2">Multitenant Ativo</p>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[7px] font-bold text-muted-foreground">
                                  <span>Agendamentos</span>
                                  <span>{selectedPlan === 'basic' ? '10/mês' : selectedPlan === 'pro' ? 'Ilimitado' : 'Enterprise'}</span>
                                </div>
                                <div className="h-1 w-full bg-accent/10 rounded-full overflow-hidden">
                                  <div className={cn("h-full bg-accent transition-all duration-500", selectedPlan === 'basic' ? 'w-1/3' : 'w-full')} />
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 bg-[#1A0F16] p-3 rounded-2xl shadow-lg relative overflow-hidden">
                              <p className="text-[7px] font-black uppercase text-accent/60 mb-1 tracking-widest">Feature Gate</p>
                              <p className="text-[10px] font-bold text-white mb-2">Limite por Tenant</p>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[7px] font-bold text-white/40">
                                  <span>Equipe</span>
                                  <span>{selectedPlan === 'basic' ? '02/03' : selectedPlan === 'pro' ? '08/10' : 'Ilimitado'}</span>
                                </div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: selectedPlan === 'basic' ? '66%' : '80%' }} transition={{ delay: 0.5, duration: 1.5 }} className="h-full bg-accent" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Overlay de Simulação de Clique */}
                  <motion.div 
                    animate={{ 
                      x: [100, 300, 300, 500, 500],
                      y: [300, 300, 150, 150, 400],
                      scale: [1, 1, 0.9, 0.9, 1]
                    }}
                    transition={{ 
                      duration: 8, 
                      repeat: Infinity,
                      times: [0, 0.2, 0.4, 0.6, 1]
                    }}
                    className="absolute w-6 h-6 pointer-events-none z-50"
                  >
                    <div className="w-full h-full bg-accent/30 rounded-full border border-accent animate-ping absolute" />
                    <div className="w-full h-full bg-accent rounded-full shadow-lg" />
                  </motion.div>
                  
                  <div className="absolute bottom-4 right-6 text-[8px] font-bold text-accent uppercase tracking-widest animate-pulse">
                    Simulação Interativa
                  </div>
                </div>
              )}
            </div>
          </div>
        </PremiumSection>
      </main>
      
      <PremiumFooter />
    </div>
  );
}
