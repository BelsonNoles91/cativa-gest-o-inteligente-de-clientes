import { Navbar } from "@/components/marketing/layout/Navbar";
import { Footer } from "@/components/marketing/layout/Footer";
import { HeroSection } from "@/components/marketing/sections/HeroSection";
import { ProblemSection } from "@/components/marketing/sections/ProblemSection";
import { FeaturesSection } from "@/components/marketing/sections/FeaturesSection";
import { PremiumSection } from "@/components/marketing/layout/PremiumSection";
import { ArrowRight, CheckCircle2, TrendingUp, Users, Calendar, Smartphone, Star, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function PremiumLanding() {
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-accent/30 selection:text-primary-dark">
      <Navbar />
      
      <main>
        <HeroSection />

        {/* Brand Bar - Editorial Style */}
        <div className="bg-white border-y border-border/40 py-16 overflow-hidden">
          <div className="container mx-auto px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-center text-muted-foreground/60 mb-12">Empoderando marcas que ditam o padrão do mercado</p>
            <div className="flex flex-wrap justify-center md:justify-between items-center gap-12 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
               <span className="text-2xl font-display font-black tracking-tighter">ESTÉTICA HUB</span>
               <span className="text-2xl font-display font-black tracking-tighter">BEAUTY TECH</span>
               <span className="text-2xl font-display font-black tracking-tighter">SPA RELAX</span>
               <span className="text-2xl font-display font-black tracking-tighter">LUXE SALON</span>
               <span className="text-2xl font-display font-black tracking-tighter">WELLNESS PRO</span>
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
                  A Nova Estratégia
                </div>
                <h3 className="font-display text-5xl md:text-7xl text-primary-dark tracking-tighter leading-[0.9] mb-8">
                  Sua nova <br />
                  <span className="italic serif font-normal text-accent">inteligência</span> <br />
                  operacional.
                </h3>
                <p className="text-xl text-muted-foreground/80 leading-relaxed font-light">
                  Nós mudamos o foco da "marcação de horários" para a "gestão de relacionamento". A Cativa antecipa o comportamento do seu cliente e sugere ações para lotar sua agenda.
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

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                role: "Proprietário",
                title: "Decisões Guiadas por Dados",
                desc: "Indicadores de saúde do negócio, taxa de retenção por unidade e previsibilidade de caixa real.",
                accent: "border-accent/30",
                iconBg: "bg-accent/10"
              },
              {
                role: "Recepção",
                title: "Agilidade que Encanta",
                desc: "Confirmações em um toque, lista de espera inteligente e interface pensada para quem tem pressa.",
                accent: "border-blue-500/30",
                iconBg: "bg-blue-500/10"
              },
              {
                role: "Profissional",
                title: "Foco Total no Atendimento",
                desc: "Agenda no celular, histórico clínico acessível e lembretes de retorno sugeridos automaticamente.",
                accent: "border-emerald-500/30",
                iconBg: "bg-emerald-500/10"
              }
            ].map((card, i) => (
              <div key={i} className={cn("group p-12 rounded-[3rem] bg-white/5 border backdrop-blur-xl transition-all duration-700 hover:bg-white/10 hover:-translate-y-2", card.accent)}>
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", card.iconBg)}>
                   <Users className="h-6 w-6 text-white" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">{card.role}</p>
                <h4 className="text-2xl font-display font-bold text-white mb-6 group-hover:text-accent transition-colors">{card.title}</h4>
                <p className="text-white/60 leading-relaxed font-light text-lg">{card.desc}</p>
              </div>
            ))}
          </div>
        </PremiumSection>

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
                      { q: "A Cativa serve para meu tipo de negócio?", a: "Sim! Somos especialistas em clínicas de estética, salões de beleza, barbearias, esmalterias e profissionais autônomos de wellness que buscam um posicionamento premium." },
                      { q: "Preciso contratar API oficial do WhatsApp?", a: "Não. A Cativa possui uma Central de Confirmação inteligente que utiliza o WhatsApp de forma organizada, sem custos ocultos de API de terceiros." },
                      { q: "O sistema funciona no meu celular?", a: "Totalmente. A Cativa é Mobile-First, oferecendo uma experiência nativa e impecável tanto no computador quanto em dispositivos móveis." },
                      { q: "Como funciona o período de teste?", a: "Você tem 14 dias para usar 100% dos recursos, sem necessidade de cartão de crédito. É o tempo ideal para sentir o impacto na produtividade da sua equipe." }
                    ].map((item, i) => (
                      <div key={i} className="p-10 rounded-[2.5rem] bg-[#FAF7F9] border border-border/20 transition-all hover:border-accent/40 group">
                         <h4 className="text-xl font-bold text-primary-dark mb-4 flex items-center justify-between">
                            {item.q}
                            <div className="w-8 h-8 rounded-full border border-border/40 flex items-center justify-center group-hover:bg-accent group-hover:border-accent transition-all">
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

        {/* Final CTA - High Impact */}
        <PremiumSection variant="accent" padding="xl" className="text-center overflow-visible bg-primary-dark">
           <div className="max-w-5xl mx-auto relative z-10">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] bg-accent/20 blur-[150px] rounded-full -z-10 animate-pulse" />
              
              <h2 className="font-display text-6xl md:text-9xl text-white mb-12 tracking-tighter leading-[0.85]">
                Seu negócio, <br />
                <span className="italic serif font-normal text-accent">redefinido.</span>
              </h2>
              
              <div className="flex flex-col sm:flex-row justify-center items-center gap-8 mb-16">
                 <Button asChild size="lg" className="h-20 px-16 rounded-none bg-accent text-white text-xl font-bold shadow-2xl hover:bg-white hover:text-primary-dark transition-all duration-500 scale-110 hover:scale-105">
                    <Link to="/onboarding">Começar Agora</Link>
                 </Button>
                 <Link to="/planos" className="text-white/60 hover:text-white font-bold uppercase tracking-widest text-sm transition-colors border-b border-white/20 pb-1">
                    Ver Planos e Preços
                 </Link>
              </div>
              
              <div className="flex flex-wrap justify-center gap-12 pt-12 border-t border-white/10">
                 {["14 dias grátis", "Sem cartão de crédito", "Cancele a qualquer momento"].map((text, i) => (
                   <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white/50">{text}</span>
                   </div>
                 ))}
              </div>
           </div>
        </PremiumSection>
      </main>

      <Footer />
    </div>
  );
}
