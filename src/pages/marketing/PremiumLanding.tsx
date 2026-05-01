import { Navbar } from "@/components/marketing/layout/Navbar";
import { Footer } from "@/components/marketing/layout/Footer";
import { HeroSection } from "@/components/marketing/sections/HeroSection";
import { ProblemSection } from "@/components/marketing/sections/ProblemSection";
import { FeaturesSection } from "@/components/marketing/sections/FeaturesSection";
import { ModulesSection } from "@/components/marketing/sections/ModulesSection";
import { ProcessSection } from "@/components/marketing/sections/ProcessSection";
import { MetricsSection } from "@/components/marketing/sections/MetricsSection";
import { PremiumSection } from "@/components/marketing/layout/PremiumSection";
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
            <h3 className="font-display text-5xl md:text-7xl text-primary-dark tracking-tighter leading-[0.9]">
              Planos que <br />
              <span className="italic serif font-normal text-accent">escalam com você.</span>
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {[
              {
                name: "Essencial",
                price: "147",
                desc: "Ideal para profissionais autônomos e estúdios em início de carreira.",
                features: ["Agenda Inteligente", "Confirmações manuais ilimitadas", "Gestão de Clientes", "Relatórios básicos"],
                button: "Começar Agora",
                highlight: false
              },
              {
                name: "Premium",
                price: "297",
                desc: "Para clínicas e salões que buscam automação total e inteligência.",
                features: ["Tudo do Essencial", "Confirmações Automáticas", "BI & Dashboards Avançados", "Multi-profissionais", "Suporte Prioritário"],
                button: "Testar Premium Grátis",
                highlight: true
              }
            ].map((plan, i) => (
              <div key={i} className={cn(
                "p-12 rounded-[3.5rem] border transition-all duration-700 hover:-translate-y-2",
                plan.highlight 
                  ? "bg-primary-dark text-white border-primary-dark shadow-2xl shadow-primary/20 scale-105" 
                  : "bg-white text-primary-dark border-border/40"
              )}>
                <p className={cn("text-xs font-bold uppercase tracking-widest mb-4", plan.highlight ? "text-accent" : "text-muted-foreground")}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-sm font-bold opacity-60">R$</span>
                  <span className="text-6xl font-display font-bold">{plan.price}</span>
                  <span className="text-sm font-bold opacity-60">/mês</span>
                </div>
                <p className={cn("text-lg font-light mb-10 leading-relaxed", plan.highlight ? "text-white/70" : "text-muted-foreground")}>
                  {plan.desc}
                </p>
                
                <div className="space-y-6 mb-12">
                   {plan.features.map((feat, idx) => (
                     <div key={idx} className="flex items-center gap-4">
                        <CheckCircle2 className={cn("h-5 w-5", plan.highlight ? "text-accent" : "text-primary-dark")} />
                        <span className="font-light">{feat}</span>
                     </div>
                   ))}
                </div>

                <Button asChild className={cn(
                  "w-full h-16 rounded-none text-lg font-bold transition-all",
                  plan.highlight 
                    ? "bg-accent text-white hover:bg-white hover:text-primary-dark" 
                    : "bg-primary-dark text-white hover:bg-accent"
                )}>
                  <Link to="/onboarding">{plan.button}</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center mt-12 text-sm text-muted-foreground font-light italic">
            * Valores para pagamento mensal. Descontos progressivos para planos anuais.
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
                      { q: "A Cativa serve para o meu tipo de negócio?", a: "Sim. A plataforma foi pensada para clínicas de estética, salões de beleza, barbearias, esmalterias, lash/brow, massagem, wellness e negócios correlatos." },
                      { q: "Preciso usar API de WhatsApp?", a: "Não. A Cativa não depende de API de WhatsApp. O processo foi pensado para funcionar de forma organizada e semiautomatizada, mantendo controle operacional." },
                      { q: "O sistema é difícil de usar?", a: "Não. A interface foi desenhada para ser intuitiva, rápida e clara, especialmente para quem vive a rotina da recepção e da gestão." },
                      { q: "Funciona no celular?", a: "Sim. A Cativa foi pensada com abordagem mobile-first, para que a experiência funcione muito bem em diferentes tamanhos de tela." },
                      { q: "Consigo personalizar para a minha operação?", a: "Sim. Serviços, mensagens, regras, equipe e unidades podem ser ajustados conforme a realidade do seu negócio." },
                      { q: "A Cativa é apenas uma agenda?", a: "Não. A agenda é apenas uma parte. A proposta é organizar operação, relacionamento, confirmação, protocolos e indicadores para aumentar retenção." }
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
                Sua operação, <br />
                <span className="italic serif font-normal text-accent">elevada.</span>
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
