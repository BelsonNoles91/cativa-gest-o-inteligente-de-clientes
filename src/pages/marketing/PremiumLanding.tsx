import { PremiumHeader as Navbar } from "@/components/marketing/layout/PremiumHeader";
import { PremiumFooter as Footer } from "@/components/marketing/layout/PremiumFooter";
import { HeroSection } from "@/components/marketing/sections/HeroSection";
import { ProblemSection } from "@/components/marketing/sections/ProblemSection";
import { FeaturesSection } from "@/components/marketing/sections/FeaturesSection";
import { ModulesSection } from "@/components/marketing/sections/ModulesSection";
import { ProcessSection } from "@/components/marketing/sections/ProcessSection";
import { MetricsSection } from "@/components/marketing/sections/MetricsSection";
import { PremiumSection } from "@/components/marketing/layout/PremiumSection";
import { PlansSection } from "@/components/marketing/sections/PlansSection";
import { ArrowRight, CheckCircle2, TrendingUp, Users, Calendar, Star, Quote, ShieldCheck, UserCheck, LayoutDashboard, Sparkles, MessageSquare, PieChart, Smartphone, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";

export default function PremiumLanding() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
  const [activeSegment, setActiveSegment] = useState(0);
  const segments = [
    { 
      name: "Estética", 
      quote: "Ficha de anamnese, pacotes de sessões e resumo com IA de cada atendimento, tudo no histórico do cliente.", 
      author: "Feito para tratamentos em várias sessões",
      benefit: "Resumo com IA",
      percentage: "IA",
      beforeAfter: { before: "Fichas em papel", after: "Histórico completo", chart: [20, 35, 15, 8] }
    },
    { 
      name: "Salões", 
      quote: "Horário cancelado vai direto para quem está na lista de espera. A agenda da equipe fica cheia.", 
      author: "Feito para equipes com vários profissionais",
      benefit: "Agenda cheia",
      percentage: "24h",
      beforeAfter: { before: "Buracos na agenda", after: "Lista de espera", chart: [40, 45, 10, 5] }
    },
    { 
      name: "Barbearias", 
      quote: "Link e QR code próprios: o cliente marca sozinho pelo celular, a qualquer hora.", 
      author: "Feito para quem atende sem parar",
      benefit: "Agendamento online",
      percentage: "1 link",
      beforeAfter: { before: "Parar o corte p/ responder", after: "Cliente marca sozinho", chart: [60, 50, 5, 2] }
    }
  ];

  const [showStickyCTA, setShowStickyCTA] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCTA(window.scrollY > 800);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-accent/30 selection:text-primary-dark overflow-x-hidden">
      <Helmet>
        <title>Cativa — Sistema para Clínicas e Salões focado em Retenção</title>
        <meta name="description" content="Agendamento online com link próprio, confirmação pelo WhatsApp em 1 toque, lista de espera, resumo com IA e clientes que voltam. Teste grátis por 14 dias." />
        <link rel="canonical" href="https://cativapp.lovable.app" />
        <meta property="og:url" content="https://cativapp.lovable.app" />
        <meta property="og:title" content="Cativa — Sistema para Clínicas e Salões focado em Retenção" />
        <meta property="og:description" content="A inteligência que profissionaliza sua gestão e faz seu cliente voltar mais vezes." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="keywords" content="sistema para clínica de estética, sistema para salão de beleza, agenda para estética, CRM para salão, confirmação de horários, gestão para clínica estética, software para salão de beleza" />
      </Helmet>
      <motion.div className="fixed top-0 left-0 right-0 h-1 bg-accent z-[200] origin-left" style={{ scaleX }} />
      <Navbar />
      
      <main>
        <HeroSection />

        {/* Seção de Confiança Institucional */}
        <div className="bg-white border-y border-border/40 py-20 md:py-32 overflow-hidden px-4">
          <div className="container mx-auto">
            <div className="max-w-4xl mx-auto text-center mb-20">
              <h2 className="font-display text-4xl md:text-6xl text-primary-dark tracking-tighter leading-none mb-6">
                Criada para operações que querem <br />
                <span className="text-accent-strong italic serif font-normal">crescer com mais controle.</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
                A Cativa foi desenhada para negócios de beleza e estética que precisam organizar a rotina, melhorar a retenção e profissionalizar a experiência do cliente sem depender de controles improvisados.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
               {[
                 { title: "Agendamento online", desc: "Link e QR code do seu negócio para o cliente marcar sozinho, 24h.", icon: Calendar },
                 { title: "Confirmação sem custo", desc: "Mensagem pronta no WhatsApp em 1 toque. Sem robô e sem bloqueio de número.", icon: MessageSquare },
                 { title: "Clientes que voltam", desc: "Alerta de quem está sumindo e cupom de retorno pronto para enviar.", icon: PieChart },
                 { title: "App no celular", desc: "Instale na tela inicial e receba aviso de cada agendamento e cancelamento.", icon: Smartphone },
                 { title: "Equipe organizada", desc: "Portal do profissional, metas, ranking e comissões do mês.", icon: Users },
                 { title: "Dados protegidos", desc: "Cada pessoa vê só o que a função permite. Exporte seus dados quando quiser.", icon: ShieldCheck }
               ].map((item, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="flex flex-col items-center group text-center p-6 rounded-3xl hover:bg-secondary/5 transition-colors"
                 >
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent group-hover:scale-110 transition-transform">
                       <item.icon className="h-6 w-6" />
                    </div>
                    <h4 className="text-lg font-bold text-primary-dark mb-2 tracking-tight">{item.title}</h4>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
                 </motion.div>
               ))}
            </div>
          </div>
        </div>

        <ProblemSection />

        {/* Seção de Solução Dinâmica */}
        <PremiumSection id="solucao" variant="soft" padding="lg">
          <div className="flex flex-wrap justify-center gap-4 mb-16 overflow-x-auto px-4">
            {segments.map((s, i) => (
              <button 
                key={i}
                onClick={() => setActiveSegment(i)}
                className={cn(
                  "px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500",
                  activeSegment === i 
                    ? "bg-primary-dark text-white shadow-xl scale-105" 
                    : "bg-white text-muted-foreground border border-border/40 hover:border-accent/40"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-24 items-center">
            <div className="relative group px-4 md:px-0">
               <AnimatePresence mode="wait">
                 <motion.div 
                   key={activeSegment}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 20 }}
                   transition={{ duration: 0.5 }}
                   className="aspect-square rounded-[3rem] md:rounded-[4rem] bg-white shadow-xl flex items-center justify-center p-8 md:p-16 relative overflow-hidden border border-border/40"
                 >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    
                    <div className="relative z-10 w-full h-full flex flex-col justify-between">
                       <div className="flex items-center justify-between">
                          <div className="space-y-2">
                             <div className="h-4 w-24 md:w-32 bg-primary-dark/10 rounded-full" />
                             <div className="h-2 w-16 md:w-20 bg-primary-dark/10 rounded-full" />
                          </div>
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                             <TrendingUp className="text-emerald-700 h-5 w-5 md:h-6 md:w-6" />
                          </div>
                       </div>

                       <div className="py-8 md:py-12 flex-1 flex items-center justify-center">
                          <div className="relative">
                             <div className="text-8xl md:text-[12rem] font-display font-bold text-primary-dark/5 leading-none select-none">
                                {segments[activeSegment].percentage.replace('%', '')}
                             </div>
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <motion.span 
                                  key={`perc-${activeSegment}`}
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="text-5xl md:text-7xl font-display font-bold text-primary-dark"
                                >
                                  {segments[activeSegment].percentage}
                                </motion.span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{segments[activeSegment].benefit}</span>
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="h-12 md:h-16 bg-secondary/20 rounded-2xl border border-border/20 p-4 flex flex-col justify-center">
                            <span className="text-[8px] font-bold text-slate-700 uppercase">Antes: {segments[activeSegment].beforeAfter.before}</span>
                            <div className="h-1 w-full bg-rose-200 rounded-full mt-1">
                               <motion.div initial={{ width: "80%" }} animate={{ width: "80%" }} className="h-full bg-rose-500 rounded-full" />
                            </div>
                          </div>
                          <div className="h-12 md:h-16 bg-primary-dark rounded-2xl flex flex-col justify-center p-4 text-white">
                            <span className="text-[8px] font-bold uppercase opacity-60">Hoje: {segments[activeSegment].beforeAfter.after}</span>
                            <div className="h-1 w-full bg-white/20 rounded-full mt-1">
                               <motion.div 
                                 key={`bar-${activeSegment}`}
                                 initial={{ width: 0 }} 
                                 animate={{ width: "100%" }} 
                                 className="h-full bg-accent rounded-full" 
                               />
                            </div>
                          </div>
                       </div>
                    </div>
                 </motion.div>
               </AnimatePresence>
               
               {/* Badge flutuante dinâmico */}
               <AnimatePresence mode="wait">
                 <motion.div 
                    key={`quote-${activeSegment}`}
                    initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 3 }}
                    exit={{ opacity: 0, scale: 0.8, rotate: 5 }}
                    className="absolute -bottom-10 right-0 md:-bottom-10 md:-left-10 bg-accent text-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl z-20 max-w-[240px] md:max-w-xs"
                 >
                    <Sparkles className="h-6 w-6 md:h-8 md:w-8 mb-4 opacity-60" />
                    <p className="text-sm md:text-lg font-medium leading-tight mb-2">{segments[activeSegment].quote}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-90">{segments[activeSegment].author}</p>
                 </motion.div>
               </AnimatePresence>
            </div>

            <div className="space-y-10 md:space-y-12 px-4 md:px-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`content-${activeSegment}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-strong mb-6 md:mb-8">
                    Foco em {segments[activeSegment].name}
                  </div>
                  <h3 className="font-display text-[2.5rem] md:text-7xl text-primary-dark tracking-tighter leading-[0.95] mb-6 md:mb-8">
                    O problema não é <br className="hidden md:block" />
                    <span className="italic serif font-normal text-accent-strong">apenas a agenda.</span>
                  </h3>
                  <p className="text-lg md:text-xl text-primary-dark/80 leading-relaxed font-normal mb-6">
                    {activeSegment === 0 && "Para clínicas de estética, cada minuto conta. A Cativa ajuda você a fidelizar melhor, confirmar horários e crescer com segurança."}
                    {activeSegment === 1 && "Salões premium precisam de fluxo constante. Nossa inteligência reduz buracos na agenda e otimiza o trabalho da sua equipe."}
                    {activeSegment === 2 && "Barbearias modernas exigem agilidade total. O portal do cliente e as confirmações rápidas garantem que ninguém perca tempo."}
                  </p>
                </motion.div>
              </AnimatePresence>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                {[
                  { icon: CheckCircle2, text: "Fidelidade Total", desc: "Aumente o retorno médio." },
                  { icon: ShieldCheck, text: "Dados Blindados", desc: "Segurança total das informações." },
                  { icon: Users, text: "Espaço do Cliente", desc: "Autonomia para quem você atende." },
                  { icon: Calendar, text: "Fluxo Inteligente", desc: "Rapidez que o dia a dia exige." },
                ].map((item, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={i} className="space-y-2"
                  >
                    <div className="flex items-center gap-3">
                       <item.icon className="h-5 w-5 text-accent" />
                       <span className="font-bold text-primary-dark tracking-tight">{item.text}</span>
                    </div>
                    <p className="text-xs md:text-sm text-slate-600 font-medium">{item.desc}</p>
                  </motion.div>
                ))}
              </div>

              <div className="pt-6 md:pt-8">
                <Button asChild size="lg" variant="premium" className="w-full md:w-auto h-16 px-10 rounded-2xl group">
                  <Link to="/onboarding" className="flex items-center justify-center gap-2">
                    Começar agora como {segments[activeSegment].name}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </PremiumSection>

        <div id="funcionalidades"><FeaturesSection /></div>
        <div id="modulos"><ModulesSection /></div>

        {/* Seção de Planos */}
        <PremiumSection id="planos" variant="soft" padding="lg">
          <div className="max-w-4xl mx-auto text-center mb-16 md:mb-24 px-4">
            <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-strong mb-8">
              Investimento
            </div>
            <h3 className="font-display text-[2.5rem] md:text-8xl text-primary-dark tracking-tighter leading-[0.95]">
              Planos que <br className="hidden md:block" />
              <span className="italic serif font-normal text-accent-strong">crescem com você.</span>
            </h3>
          </div>

          <PlansSection />

          <p className="text-center mt-16 md:mt-20 text-xs md:text-sm text-primary-dark/70 font-bold italic px-4">
            * Valores para pagamento mensal. Descontos progressivos para planos anuais. <br />
            Atendimento especializado disponível para todos os planos pagos.
          </p>
        </PremiumSection>

        {/* Seção de Perfis */}
        <PremiumSection variant="dark" padding="lg">
          <div className="max-w-4xl mx-auto text-center mb-16 md:mb-24 px-4">
            <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-8 border border-white/10">
              Ecossistema Cativa
            </div>
            <h3 className="font-display text-[2.5rem] md:text-8xl text-white tracking-tighter leading-[0.95]">
              Um sistema, <br className="hidden md:block" />
              <span className="italic serif font-normal text-accent">muitas possibilidades.</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 px-4 md:px-0">
            {[
              {
                role: "Dono do Negócio",
                title: "Decisão com clareza",
                desc: "Mais clareza sobre retenção, ocupação e previsibilidade para decidir com menos achismo e mais segurança.",
                icon: LayoutDashboard,
                iconBg: "bg-accent/10"
              },
              {
                role: "Gerente",
                title: "Padrão operacional",
                desc: "Mais controle sobre equipe, confirmações, gargalos e processos que garantem a qualidade da marca.",
                icon: ShieldCheck,
                iconBg: "bg-blue-500/10"
              },
              {
                role: "Recepção",
                title: "Agilidade real",
                desc: "Menos improviso, menos retrabalho e mais agilidade para confirmar, reagendar e organizar a agenda.",
                icon: Calendar,
                iconBg: "bg-emerald-500/10"
              },
              {
                role: "Profissional",
                title: "Contexto do cliente",
                desc: "Mais contexto sobre cada cliente, histórico de atendimento e próxima oportunidade de retorno.",
                icon: UserCheck,
                iconBg: "bg-purple-500/10"
              }
            ].map((card, i) => (
              <div key={i} className="group p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] bg-white/5 border border-white/10 backdrop-blur-xl transition-all duration-700 hover:bg-white/10">
                <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-6 md:mb-8 transition-transform duration-500 group-hover:scale-110", card.iconBg)}>
                   <card.icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mb-4">{card.role}</p>
                <h4 className="text-lg md:text-xl font-display font-bold text-white mb-4 md:mb-6 group-hover:text-accent transition-colors">{card.title}</h4>
                <p className="text-white/80 leading-relaxed font-normal text-sm md:text-base">{card.desc}</p>
              </div>
            ))}
          </div>
        </PremiumSection>
...

        <div id="processo"><ProcessSection /></div>

        <div id="metricas"><MetricsSection /></div>

        {/* Seção de Dúvidas Frequentes */}
        <PremiumSection variant="light" padding="lg" id="duvidas">
           <div className="max-w-5xl mx-auto">
              <div className="flex flex-col lg:flex-row gap-20">
                 <div className="lg:w-1/3">
                    <div className="sticky top-32">
                       <h2 className="font-display text-5xl md:text-6xl text-primary-dark tracking-tighter leading-none mb-8">Dúvidas <br />Comuns.</h2>
                       <p className="text-muted-foreground font-light text-lg mb-10">Tudo o que você precisa saber para elevar seu negócio hoje.</p>
                       <Button asChild size="lg" className="rounded-full bg-primary-dark text-white px-8 py-6 h-auto text-sm font-bold uppercase tracking-widest gap-2 hover:scale-[1.02] transition-all shadow-lg">
                          <Link to="/onboarding" className="flex items-center gap-2">Começar agora grátis <ArrowRight className="h-4 w-4" /></Link>
                       </Button>
                    </div>
                 </div>
                  <div className="lg:w-2/3 space-y-4 px-4 md:px-0">
                    {[
                      { q: "A Cativa serve para o meu tipo de negócio?", a: "Sim. A plataforma foi pensada para clínicas de estética, salões de beleza, barbearias, esmalterias, profissionais de cílios e sobrancelhas, massagem e negócios de bem-estar." },
                      { q: "Meus clientes conseguem agendar sozinhos?", a: "Sim. Você ganha uma página própria com link e QR code. O cliente vê os horários livres, escolhe serviço e profissional e marca a qualquer hora. Você define o que ele pode fazer sozinho: agendar, remarcar ou cancelar." },
                      { q: "Como começo a usar?", a: "Clique em 'Começar agora grátis' e crie sua conta em poucos minutos. Se você já usa outro sistema ou planilha, dá para importar sua lista de clientes." },
                      { q: "Posso testar os recursos premium?", a: "Sim. Todos os novos cadastros recebem 14 dias de acesso aos recursos premium para sentir a diferença na rotina antes de decidir, sem cartão." },
                      { q: "As confirmações são enviadas pelo WhatsApp?", a: "Sim, pelo seu próprio WhatsApp. A Cativa prepara a mensagem de cada cliente e abre a conversa em 1 toque. Nada é enviado por robô: não há risco de bloqueio do número nem custo por mensagem." },
                      { q: "Como a Cativa ajuda o cliente a voltar?", a: "O sistema calcula a data ideal de retorno pelo histórico, avisa quem está sumindo e prepara mensagens com cupom de retorno. Horários cancelados são oferecidos para a lista de espera." },
                      { q: "Minha equipe tem acesso separado?", a: "Sim. Dono, gerente, recepção e profissional têm acessos diferentes. O profissional tem seu portal com agenda, metas e comissões, e você decide se ele vê a agenda de todos ou só a dele." },
                      { q: "Funciona para quem tem mais de uma unidade?", a: "Sim. Você gerencia várias unidades com visão consolidada ou separada por local." },
                      { q: "Precisa baixar aplicativo?", a: "Não precisa ir à loja de apps. A Cativa funciona no navegador e pode ser instalada na tela inicial do celular, com avisos de novos agendamentos e cancelamentos." }
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

        {/* Chamada Final */}
        <PremiumSection id="final-cta" variant="dark" padding="xl" className="text-center overflow-visible">
           {/* Fundo sofisticado */}
           <div className="absolute inset-0 bg-[#1A0F16]" />
           <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[140%] bg-accent/5 blur-[120px] rounded-full rotate-12" />
           <div className="absolute bottom-[-30%] right-[-10%] w-[50%] h-[120%] bg-primary/10 blur-[100px] rounded-full -rotate-12" />
           
           <div className="max-w-6xl mx-auto relative z-10 px-4">
              <div className="inline-block px-5 py-2 rounded-full bg-accent/10 text-[11px] font-bold uppercase tracking-[0.3em] text-accent mb-12 border border-accent/20">
                Pronto para o Próximo Nível?
              </div>
              
              <h2 className="font-display text-[2.5rem] sm:text-7xl md:text-[9rem] text-white mb-12 md:mb-16 tracking-tighter leading-[0.9] animate-fade-in">
                Sua operação, <br />
                <span className="italic serif font-normal text-accent relative inline-block">
                  elevada.
                  <svg className="absolute -bottom-4 left-0 w-full h-6 text-accent/20 -z-10" viewBox="0 0 400 24" fill="none">
                    <path d="M2 20C80 5 280 2 398 20" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/>
                  </svg>
                </span>
              </h2>
              
              <p className="text-white/70 text-xl md:text-3xl font-light max-w-3xl mx-auto mb-20 leading-relaxed tracking-tight">
                Deixe o improviso para trás. A Cativa é a inteligência que sua marca de beleza merece para crescer com consistência e sofisticação.
              </p>
              
               <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mb-24">
                  <div className="flex flex-col gap-2">
                    <Button asChild size="lg" variant="premium" className="group relative overflow-hidden h-20 px-12">
                       <Link to="/onboarding">
                         <span className="relative z-10 flex items-center gap-3 text-xl">
                           Começar Agora Grátis
                           <ArrowRight className="h-6 w-6" />
                         </span>
                         <div className="absolute inset-0 bg-white translate-y-full transition-transform duration-500 group-hover:translate-y-0" />
                       </Link>
                    </Button>
                    <span className="text-xs text-white/70 font-bold uppercase tracking-widest">Acesso imediato à sua nova gestão.</span>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="outlineWhite" size="lg" className="h-20 px-12 rounded-full border-white/20 hover:bg-white/10">
                       <Link to="/auth/login" className="text-xl">Já tenho uma conta</Link>
                    </Button>
                    <span className="text-xs text-white/70 font-bold uppercase tracking-widest">Faça login para continuar sua operação.</span>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-16 border-y border-white/10">
                  {[
                    { text: "14 dias grátis", sub: "Sem compromisso" },
                    { text: "Sem cartão", sub: "Acesso imediato" },
                    { text: "Atendimento Exclusivo", sub: "Acompanhamento guiado" }
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                       <div className="flex items-center gap-3 mb-1">
                          <CheckCircle2 className="h-5 w-5 text-accent" />
                          <span className="text-lg md:text-xl font-bold text-white tracking-tight">{item.text}</span>
                       </div>
                       <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{item.sub}</span>
                    </div>
                  ))}
               </div>
            </div>
        </PremiumSection>
      </main>

      <Footer />

      {/* Sticky CTA Mobile */}
      <AnimatePresence>
        {showStickyCTA && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-[100] p-4 lg:hidden bg-white/90 backdrop-blur-xl border-t border-border/40 pb-safe shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)]"
          >
            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1 rounded-full border-primary-dark/20 h-14 font-bold text-xs uppercase tracking-widest">
                <Link to="/auth/login">Entrar</Link>
              </Button>
              <Button asChild className="flex-1 rounded-full bg-primary-dark h-14 font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
                <Link to="/onboarding">Começar Grátis</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
