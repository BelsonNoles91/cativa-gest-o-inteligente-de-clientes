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
      <PremiumHeader />
      
      <main>
        <HeroSection />

        {/* Brand Bar */}
        <div className="bg-white border-y border-border/40 py-10 overflow-hidden">
          <div className="container flex flex-wrap justify-center md:justify-between items-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
             <span className="text-xl font-display font-bold">ESTÉTICA HUB</span>
             <span className="text-xl font-display font-bold">BEAUTY TECH</span>
             <span className="text-xl font-display font-bold">SPA RELAX</span>
             <span className="text-xl font-display font-bold">LUXE SALON</span>
             <span className="text-xl font-display font-bold">WELLNESS PRO</span>
          </div>
        </div>

        <ProblemSection />

        {/* Repositioning Section */}
        <PremiumSection id="solucao" variant="gradient" padding="lg">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
               <div className="aspect-square rounded-[60px] bg-secondary/20 flex items-center justify-center p-12 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-brand opacity-10" />
                  <div className="relative z-10 w-full h-full bg-white rounded-[40px] shadow-2xl p-8 border border-border/40">
                     <div className="flex items-center justify-between mb-8">
                        <div className="h-6 w-32 bg-primary-soft rounded-full" />
                        <TrendingUp className="text-success h-6 w-6" />
                     </div>
                     <div className="space-y-6">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-12 bg-secondary/10 rounded-xl flex items-center px-4 gap-3">
                             <div className="w-6 h-6 rounded-full bg-white" />
                             <div className="h-3 w-1/2 bg-muted/30 rounded" />
                          </div>
                        ))}
                     </div>
                     <div className="mt-12 p-6 bg-primary-dark rounded-2xl text-white text-center">
                        <p className="text-sm font-bold opacity-60 uppercase mb-2">Retenção Projetada</p>
                        <p className="text-4xl font-display font-bold">82%</p>
                     </div>
                  </div>
               </div>
               <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-accent/20 blur-[60px] rounded-full -z-10" />
            </div>

            <div className="space-y-8">
              <h2 className="text-accent font-bold tracking-widest uppercase text-sm">O Diferencial</h2>
              <h3 className="font-display text-4xl md:text-5xl text-primary-dark tracking-tight leading-tight">
                Mais do que um sistema de agenda, sua nova <span className="italic">estratégia de crescimento</span>.
              </h3>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Nós mudamos o foco da "marcação de horários" para a "gestão de relacionamento". A Cativa antecipa o comportamento do seu cliente e sugere ações para lotar sua agenda.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-6 pt-4">
                {[
                  { icon: CheckCircle2, text: "Foco total em LTV e Retenção" },
                  { icon: Smartphone, text: "Interface pensada para Mobile" },
                  { icon: Users, text: "Portal do Cliente personalizado" },
                  { icon: Calendar, text: "Agendamento em 3 cliques" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <item.icon className="h-6 w-6 text-accent" />
                    <span className="font-semibold text-primary-dark">{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="pt-8">
                <Button asChild size="lg" className="rounded-full bg-primary-dark h-14 px-8 group">
                  <Link to="/onboarding">
                    Conhecer a solução completa
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </PremiumSection>

        <FeaturesSection />

        {/* Roles Section */}
        <PremiumSection variant="dark" padding="lg">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-accent font-bold tracking-widest uppercase text-sm mb-4">A Cativa para cada um</h2>
            <h3 className="font-display text-4xl md:text-5xl text-white tracking-tight">Um sistema, <span className="italic">vários superpoderes</span>.</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                role: "Proprietário",
                title: "Visão 360º",
                desc: "Indicadores de saúde do negócio, taxa de retenção por unidade e previsibilidade de caixa em tempo real.",
                accent: "text-accent"
              },
              {
                role: "Recepção",
                title: "Agilidade Máxima",
                desc: "Confirmações em um toque, lista de espera inteligente e interface pensada para quem tem pressa.",
                accent: "text-blue-400"
              },
              {
                role: "Profissional",
                title: "Foco no Cliente",
                desc: "Sua agenda no celular, histórico clínico acessível e lembretes de retorno sugeridos automaticamente.",
                accent: "text-green-400"
              }
            ].map((card, i) => (
              <div key={i} className="p-10 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10">
                <p className={cn("text-xs font-bold uppercase tracking-widest mb-4", card.accent)}>{card.role}</p>
                <h4 className="text-2xl font-display font-bold text-white mb-4">{card.title}</h4>
                <p className="text-white/60 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </PremiumSection>

        {/* FAQ Section */}
        <PremiumSection variant="light" padding="lg" id="faq">
           <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-4xl text-primary-dark text-center mb-16">Perguntas Frequentes</h2>
              <div className="grid gap-6">
                 {[
                   { q: "A Cativa serve para meu tipo de negócio?", a: "Sim! Somos especialistas em clínicas de estética, salões de beleza, barbearias, esmalterias e profissionais autônomos de wellness." },
                   { q: "Preciso contratar API oficial do WhatsApp?", a: "Não. A Cativa possui uma Central de Confirmação inteligente que utiliza o WhatsApp manual de forma organizada, sem custos extras de API." },
                   { q: "O sistema funciona no meu celular?", a: "Totalmente. A Cativa é Mobile-First, oferecendo uma experiência impecável tanto no computador quanto em dispositivos móveis." },
                   { q: "Como funciona o período de teste?", a: "Você tem 14 dias para usar 100% dos recursos, sem precisar cadastrar cartão de crédito. É o tempo ideal para sentir o impacto na sua recepção." }
                 ].map((item, i) => (
                   <div key={i} className="p-8 rounded-3xl bg-secondary/5 border border-border/40">
                      <h4 className="text-lg font-bold text-primary-dark mb-2">{item.q}</h4>
                      <p className="text-muted-foreground">{item.a}</p>
                   </div>
                 ))}
              </div>
           </div>
        </PremiumSection>

        {/* Final CTA */}
        <PremiumSection variant="soft" padding="xl" className="text-center overflow-visible">
           <div className="max-w-4xl mx-auto relative">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/20 blur-[120px] rounded-full -z-10" />
              <h2 className="font-display text-5xl md:text-7xl text-primary-dark mb-8 tracking-tight">
                Pronta para <span className="text-accent italic">fazer a transição</span> para o premium?
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
                Junte-se a centenas de negócios que abandonaram o amadorismo e escolheram a Cativa para escalar com inteligência.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                 <Button asChild size="lg" className="h-16 px-12 rounded-full bg-primary-dark text-lg shadow-2xl shadow-primary/20">
                    <Link to="/onboarding">Criar minha conta grátis</Link>
                 </Button>
                 <Button asChild size="lg" variant="outline" className="h-16 px-12 rounded-full text-lg border-2 border-primary-dark text-primary-dark hover:bg-primary-dark hover:text-white transition-all">
                    <Link to="/planos">Ver planos e preços</Link>
                 </Button>
              </div>
              <p className="mt-8 text-sm text-muted-foreground font-medium">14 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>
           </div>
        </PremiumSection>
      </main>

      <PremiumFooter />
    </div>
  );
}
