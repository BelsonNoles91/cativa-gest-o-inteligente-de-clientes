import { Navbar } from "@/components/marketing/layout/Navbar";
import { Footer } from "@/components/marketing/layout/Footer";
import { HeroSection } from "@/components/marketing/sections/HeroSection";
import { ProblemSection } from "@/components/marketing/sections/ProblemSection";
import { FeaturesSection } from "@/components/marketing/sections/FeaturesSection";
import { ModulesSection } from "@/components/marketing/sections/ModulesSection";
import { ProcessSection } from "@/components/marketing/sections/ProcessSection";
import { MetricsSection } from "@/components/marketing/sections/MetricsSection";
import { PremiumSection } from "@/components/marketing/layout/PremiumSection";
import { PlansSection } from "@/components/marketing/sections/PlansSection";
import { ArrowRight, CheckCircle2, TrendingUp, Users, Calendar, Star, Quote, ShieldCheck, UserCheck, LayoutDashboard, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function PremiumLanding() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-accent/30 selection:text-primary-dark">
      <Navbar />
      
      <main>
        <HeroSection />

        {/* Trust/Benefits Bar - Premium & Realistic */}
        <div className="bg-white border-y border-border/40 py-12 overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="flex flex-wrap justify-center lg:justify-between items-center gap-8 md:gap-16">
               {[
                 { label: "MOBILE-FIRST", desc: "Gestão na palma da mão" },
                 { label: "MULTIUNIDADE", desc: "Controle centralizado" },
                 { label: "PERSONALIZÁVEL", desc: "Adaptado ao seu fluxo" },
                 { label: "ARQUITETURA ROBUSTA", desc: "Segurança de dados" },
                 { label: "FOCO EM RETENÇÃO", desc: "LTV como prioridade" }
               ].map((item, i) => (
                 <div key={i} className="flex flex-col items-center lg:items-start group">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-dark/40 group-hover:text-accent transition-colors mb-1">{item.label}</span>
                    <span className="text-[10px] font-medium text-muted-foreground/60">{item.desc}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <ProblemSection />

        {/* Solution Narrative Section */}
        <PremiumSection id="solucao" variant="soft" padding="lg">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div className="relative group">
               <div className="aspect-square rounded-[4rem] bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] flex items-center justify-center p-16 relative overflow-hidden border border-border/40 transition-transform duration-700 group-hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="relative z-10 w-full h-full flex flex-col justify-between">
                     <div className="flex items-center justify-between">
                        <div className="space-y-2">
                           <div className="h-4 w-32 bg-primary-dark/10 rounded-full" />
                           <div className="h-2 w-20 bg-primary-dark/5 rounded-full" />
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                           <TrendingUp className="text-success h-6 w-6" />
                        </div>
                     </div>

                     <div className="py-12 flex-1 flex items-center justify-center">
                        <div className="relative">
                           <div className="text-[12rem] font-display font-bold text-primary-dark/5 leading-none select-none">82</div>
                           <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-7xl font-display font-bold text-primary-dark">82%</span>
                              <span className="text-xs font-bold uppercase tracking-widest text-success">Retenção Ativa</span>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="h-16 bg-secondary/20 rounded-2xl border border-border/20" />
                        <div className="h-16 bg-primary-dark rounded-2xl flex items-center justify-center text-white">
                           <Star className="h-5 w-5 fill-accent text-accent" />
                        </div>
                     </div>
                  </div>
               </div>
               
               {/* Decorative floating badge */}
               <div className="absolute -bottom-10 -left-10 bg-accent text-white p-8 rounded-[2.5rem] shadow-2xl transform rotate-3 transition-transform duration-700 group-hover:rotate-0 z-20">
                  <Quote className="h-8 w-8 mb-4 opacity-40" />
                  <p className="text-lg font-medium leading-tight mb-2">"A Cativa não é um software, é um consultor silencioso."</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">— Amanda Souza, Clínica Bloom</p>
               </div>
            </div>

            <div className="space-y-12">
              <div>
                <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8">
                  Estratégia & Controle
                </div>
                <h3 className="font-display text-5xl md:text-7xl text-primary-dark tracking-tighter leading-[0.9] mb-8">
                  O problema não é <br />
                  <span className="italic serif font-normal text-accent">só agenda.</span>
                </h3>
                <p className="text-xl text-muted-foreground/80 leading-relaxed font-light mb-6">
                  A maioria dos sistemas ajuda a marcar horários. A Cativa foi criada para ajudar seu negócio a reter melhor, confirmar melhor, operar melhor e crescer com mais previsibilidade.
                </p>
                <p className="text-2xl font-display italic serif text-primary-dark/60">
                  "Porque crescer com consistência exige mais do que agenda. Exige inteligência operacional."
                </p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-8">
                {[
                  { icon: CheckCircle2, text: "Foco total em LTV e Retenção", desc: "Aumente o valor de cada cliente." },
                  { icon: Smartphone, text: "Mobile-First de verdade", desc: "Gestão completa na palma da mão." },
                  { icon: Users, text: "Experiência do Cliente", desc: "Portal dedicado e personalizado." },
                  { icon: Calendar, text: "Fluxo de 3 cliques", desc: "Rapidez que sua recepção precisa." },
                ].map((item, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex items-center gap-3">
                       <item.icon className="h-5 w-5 text-accent" />
                       <span className="font-bold text-primary-dark tracking-tight">{item.text}</span>
                    </div>
                    <p className="text-sm text-muted-foreground font-light">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="pt-8">
                <Button asChild size="lg" className="rounded-none bg-primary-dark h-16 px-10 group relative overflow-hidden transition-all hover:scale-[1.02]">
                  <Link to="/onboarding">
                    <span className="relative z-10 flex items-center">
                      Conhecer a solução completa
                      <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </span>
                    <div className="absolute inset-0 bg-accent translate-y-full transition-transform group-hover:translate-y-0" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </PremiumSection>

        <FeaturesSection />
        <ModulesSection />

        {/* Plans Section */}
        <PremiumSection id="planos" variant="soft" padding="lg">
          <div className="max-w-4xl mx-auto text-center mb-24">
            <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8">
              Investimento
            </div>
            <h3 className="font-display text-5xl md:text-8xl text-primary-dark tracking-tighter leading-[0.9]">
              Planos que <br />
              <span className="italic serif font-normal text-accent">escalam com você.</span>
            </h3>
          </div>

          <PlansSection />

          <p className="text-center mt-20 text-sm text-muted-foreground font-light italic">
            * Valores para pagamento mensal. Descontos progressivos para planos anuais. <br />
            Suporte especializado disponível para todos os planos pagos.
          </p>
        </PremiumSection>

        {/* Roles Section - Elevated Visuals */}
        <PremiumSection variant="dark" padding="lg">
          <div className="max-w-4xl mx-auto text-center mb-24">
            <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8 border border-white/10">
              Ecossistema Cativa
            </div>
            <h3 className="font-display text-5xl md:text-8xl text-white tracking-tighter leading-[0.9]">
              Um sistema, <br />
              <span className="italic serif font-normal text-accent">múltiplas jornadas.</span>
            </h3>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                role: "Proprietário",
                title: "O Fim da Gestão por 'Feeling'",
                desc: "Indicadores de saúde real, taxa de retorno por profissional e previsibilidade de faturamento para os próximos 30 dias.",
                icon: LayoutDashboard,
                iconBg: "bg-accent/10"
              },
              {
                role: "Gerente",
                title: "Controle da Rotina e Equipe",
                desc: "Visibilidade sobre agenda, fluxo operacional, confirmações, gargalos e oportunidades de melhoria em tempo real.",
                icon: ShieldCheck,
                iconBg: "bg-blue-500/10"
              },
              {
                role: "Recepção",
                title: "Agilidade e Menos Retrabalho",
                desc: "Organize confirmações, cadastros e reagendamentos com poucos cliques e muito mais previsibilidade.",
                icon: Calendar,
                iconBg: "bg-emerald-500/10"
              },
              {
                role: "Profissional",
                title: "Mais Contexto para Atender",
                desc: "Acesse informações importantes do cliente, acompanhe histórico e atue com continuidade na jornada.",
                icon: UserCheck,
                iconBg: "bg-purple-500/10"
              }
            ].map((card, i) => (
              <div key={i} className="group p-10 rounded-[3rem] bg-white/5 border border-white/10 backdrop-blur-xl transition-all duration-700 hover:bg-white/10 hover:-translate-y-2">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", card.iconBg)}>
                   <card.icon className="h-6 w-6 text-white" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">{card.role}</p>
                <h4 className="text-xl font-display font-bold text-white mb-6 group-hover:text-accent transition-colors">{card.title}</h4>
                <p className="text-white/60 leading-relaxed font-light text-base">{card.desc}</p>
              </div>
            ))}
          </div>
        </PremiumSection>

        <ProcessSection />

        <MetricsSection />

        {/* FAQ Section - Clean & Sophisticated */}
        <PremiumSection variant="light" padding="lg" id="faq">
           <div className="max-w-5xl mx-auto">
              <div className="flex flex-col lg:flex-row gap-20">
                 <div className="lg:w-1/3">
                    <div className="sticky top-32">
                       <h2 className="font-display text-5xl md:text-6xl text-primary-dark tracking-tighter leading-none mb-8">Dúvidas <br />Comuns.</h2>
                       <p className="text-muted-foreground font-light text-lg mb-10">Tudo o que você precisa saber para elevar seu negócio hoje.</p>
                       <Button variant="link" className="p-0 text-accent font-bold uppercase tracking-widest text-xs gap-2 hover:gap-4 transition-all">
                          Falar com Especialista <ArrowRight className="h-4 w-4" />
                       </Button>
                    </div>
                 </div>
                 <div className="lg:w-2/3 space-y-4">
                    {[
                      { q: "A Cativa serve para o meu tipo de negócio?", a: "Sim. A plataforma foi pensada para clínicas de estética, salões de beleza, barbearias, esmalterias, lash/brow, massagem, wellness e negócios correlatos que buscam um nível superior de gestão." },
                      { q: "Como funciona a demonstração?", a: "Nossa demonstração é um tour guiado por um especialista que entende o seu cenário. Mostramos como a Cativa resolve seus gargalos específicos em 20 minutos." },
                      { q: "Posso testar antes de contratar?", a: "Sim. Oferecemos 14 dias de teste grátis com acesso total às funcionalidades core para que você sinta a diferença na operação real." },
                      { q: "Vocês ajudam na migração de dados?", a: "Sim. Temos um processo de onboarding assistido para garantir que seu histórico e cadastros sejam migrados com segurança e rapidez." },
                      { q: "O sistema funciona em tablets e celulares?", a: "Totalmente. A Cativa é mobile-first, permitindo que profissionais e gestores operem com 100% de eficiência de qualquer dispositivo." },
                      { q: "É possível gerenciar mais de uma unidade?", a: "Com certeza. A estrutura da Cativa foi desenhada para redes e franquias, permitindo visão consolidada ou isolada por unidade com um único login." }
                    ].map((item, i) => (
                      <div key={i} className="p-8 md:p-10 rounded-[2.5rem] bg-[#FAF7F9] border border-border/20 transition-all hover:border-accent/40 group">
                         <h4 className="text-xl font-bold text-primary-dark mb-4 flex items-center justify-between gap-4">
                            {item.q}
                            <div className="w-8 h-8 rounded-full border border-border/40 flex items-center justify-center group-hover:bg-accent group-hover:border-accent transition-all shrink-0">
                               <ArrowRight className="h-4 w-4 text-primary-dark group-hover:text-white -rotate-45 group-hover:rotate-0 transition-transform" />
                            </div>
                         </h4>
                         <p className="text-muted-foreground font-light leading-relaxed text-lg">{item.a}</p>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </PremiumSection>

        {/* Final CTA - High Impact Editorial Style */}
        <PremiumSection variant="dark" padding="xl" className="text-center overflow-visible">
           {/* Sophisticated background depth */}
           <div className="absolute inset-0 bg-[#1A0F16]" />
           <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[140%] bg-accent/5 blur-[120px] rounded-full rotate-12" />
           <div className="absolute bottom-[-30%] right-[-10%] w-[50%] h-[120%] bg-primary/10 blur-[100px] rounded-full -rotate-12" />
           
           <div className="max-w-6xl mx-auto relative z-10">
              <div className="inline-block px-5 py-2 rounded-full bg-accent/10 text-[11px] font-bold uppercase tracking-[0.3em] text-accent mb-12 border border-accent/20">
                Pronto para o Próximo Nível?
              </div>
              
              <h2 className="font-display text-5xl sm:text-7xl md:text-[10rem] text-white mb-16 tracking-tighter leading-[0.8] animate-fade-in">
                Sua operação, <br />
                <span className="italic serif font-normal text-accent relative inline-block">
                  elevada.
                  <svg className="absolute -bottom-4 left-0 w-full h-6 text-accent/20 -z-10" viewBox="0 0 400 24" fill="none">
                    <path d="M2 20C80 5 280 2 398 20" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/>
                  </svg>
                </span>
              </h2>
              
              <p className="text-white/70 text-2xl md:text-3xl font-light max-w-3xl mx-auto mb-20 leading-relaxed tracking-tight">
                Deixe o improviso para trás. A Cativa é a inteligência que sua marca de beleza merece para crescer com consistência e sofisticação.
              </p>
              
               <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mb-24">
                  <Button asChild size="lg" className="h-20 px-12 rounded-full bg-accent text-white text-xl font-bold shadow-[0_30px_60px_-15px_rgba(168,76,134,0.5)] hover:bg-white hover:text-primary-dark transition-all duration-700 scale-110 hover:scale-105 group relative overflow-hidden">
                     <Link to="/demo">
                       <span className="relative z-10 flex items-center gap-3">
                         Agendar minha demonstração
                         <ArrowRight className="h-6 w-6" />
                       </span>
                       <div className="absolute inset-0 bg-white translate-y-full transition-transform duration-500 group-hover:translate-y-0" />
                     </Link>
                  </Button>
                  
                  <Button asChild variant="outline" size="lg" className="h-20 px-12 rounded-full border-white/20 text-white text-xl hover:bg-white hover:text-primary-dark transition-all duration-500">
                     <Link to="/onboarding">Começar teste de 14 dias</Link>
                  </Button>
               </div>
                 
                 <div className="flex flex-col items-start gap-2 group cursor-pointer">
                    <Link to="/planos" className="text-white/90 hover:text-accent font-bold uppercase tracking-[0.2em] text-sm transition-all flex items-center gap-3">
                       Ver Planos e Preços
                       <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-2" />
                    </Link>
                    <div className="h-px w-full bg-white/20 group-hover:bg-accent transition-colors" />
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-16 border-y border-white/10">
                 {[
                   { text: "14 dias grátis", sub: "Sem compromisso" },
                   { text: "Sem cartão", sub: "Setup imediato" },
                   { text: "Suporte VIP", sub: "Implementação guiada" }
                 ].map((item, i) => (
                   <div key={i} className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-3 mb-1">
                         <CheckCircle2 className="h-5 w-5 text-accent" />
                         <span className="text-xl font-bold text-white tracking-tight">{item.text}</span>
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">{item.sub}</span>
                   </div>
                 ))}
              </div>
              
              <div className="mt-16 flex flex-col items-center gap-6 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-1000">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">Tecnologia Certificada</p>
                <div className="flex items-center gap-12">
                   <div className="h-8 w-24 bg-white/10 rounded" />
                   <div className="h-8 w-32 bg-white/10 rounded" />
                   <div className="h-8 w-20 bg-white/10 rounded" />
                </div>
              </div>
           </div>
        </PremiumSection>
      </main>

      <Footer />
    </div>
  );
}
