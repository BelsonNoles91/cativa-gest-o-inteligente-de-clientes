/**
 * Landing pública da Cativa — narrativa institucional + comercial.
 *
 * Estrutura:
 *  1. Hero (proposta de valor + CTA + mock visual da agenda)
 *  2. Pílulas de prova (logos/contagens) e tagline forte
 *  3. Dores do mercado (3 colunas)
 *  4. Como funciona (3 passos)
 *  5. Módulos do sistema (grid)
 *  6. Diferencial Índice Cativa (bloco destacado)
 *  7. Benefícios por perfil (Owner / Manager / Frontdesk / Professional)
 *  8. Segmentos atendidos
 *  9. ROI conceitual
 * 10. CTA final
 *
 * Mobile-first. Tokens semânticos do design system (sem cores brutas).
 */
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarHeart,
  CheckCircle2,
  Gauge,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  PackageOpen,
  PhoneCall,
  Repeat,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";

// ---------------------------------------------------------------------------
// Conteúdo declarativo — fácil de iterar
// ---------------------------------------------------------------------------
const PAINS = [
  {
    icon: TrendingDown,
    title: "Cliente que não volta",
    text:
      "Você atende, agrada, e ele some. Sem rastreio de retorno, a sua marca depende do humor do dia.",
  },
  {
    icon: PhoneCall,
    title: "Recepção sobrecarregada",
    text:
      "Confirmar horário no WhatsApp, atender telefone, vender pacote. Sem ferramenta, vira caos.",
  },
  {
    icon: Gauge,
    title: "Decisão no escuro",
    text:
      "Sem indicadores de retenção, ocupação e rebooking, o gestor reage em vez de planejar.",
  },
];

const HOW = [
  {
    n: "01",
    title: "Conecte sua operação",
    text:
      "Importe clientes, serviços, profissionais e horários em minutos. Configurações por segmento ajudam você a começar.",
  },
  {
    n: "02",
    title: "Opere com a recepção certa",
    text:
      "Agenda inteligente, fila de confirmação semiassistida e portal do cliente para reduzir ligações.",
  },
  {
    n: "03",
    title: "Cresça com dados claros",
    text:
      "Dashboards, Índice Cativa e recomendações acionáveis transformam números em próximas ações.",
  },
];

const MODULES = [
  {
    icon: CalendarHeart,
    title: "Agenda inteligente",
    text:
      "Visões diária, semanal, por profissional e por unidade. Buffers, bloqueios, lista de espera.",
  },
  {
    icon: Users,
    title: "CRM de retenção",
    text:
      "Histórico, preferências, fotos de antes/depois, observações clínicas, tags e timeline.",
  },
  {
    icon: PackageOpen,
    title: "Pacotes & Protocolos",
    text:
      "Sessões, validades, intervalos ideais e memberships recorrentes prontos para qualquer segmento.",
  },
  {
    icon: MessageCircle,
    title: "Central de Confirmação",
    text:
      "Filas por horizonte, prioridade automática e mensagens via WhatsApp manual (wa.me).",
  },
  {
    icon: UserCheck,
    title: "Portal do cliente",
    text:
      "Login próprio, agendamento, reagendamento, cancelamento com política e termos digitais.",
  },
  {
    icon: LineChart,
    title: "Analytics premium",
    text:
      "Retenção, rebooking, ocupação, ticket médio, ROI futuro — tudo filtrável por unidade.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-unidade & papéis",
    text:
      "Permissões finas por papel e unidade. Pronto para escalar de 1 a dezenas de operações.",
  },
  {
    icon: Sparkles,
    title: "Índice Cativa",
    text:
      "Métrica proprietária 0–100 que mostra a saúde do negócio em uma única tela.",
  },
];

const PROFILES = [
  {
    icon: LayoutDashboard,
    role: "Owner",
    title: "Visão clara, decisão rápida",
    items: [
      "Índice Cativa por unidade e profissional",
      "Receita futura agendada e em risco",
      "Comparativo de retenção por equipe",
      "Limites de plano e expansão multi-unidade",
    ],
  },
  {
    icon: UserCog,
    role: "Manager",
    title: "Operação que se sustenta sozinha",
    items: [
      "Próximas ações sugeridas (Next Best Action)",
      "Filas de confirmação priorizadas",
      "Bloqueios, escalas e disponibilidades",
      "Pacotes/protocolos com adesão e renovação",
    ],
  },
  {
    icon: PhoneCall,
    role: "Frontdesk",
    title: "Recepção mobile-first",
    items: [
      "Agenda do dia em poucos toques",
      "Confirmação semiassistida via WhatsApp manual",
      "Lista de espera com 1 clique",
      "Check-in, no-show e remarcação rápidos",
    ],
  },
  {
    icon: UserCheck,
    role: "Professional",
    title: "Foco no atendimento",
    items: [
      "Sua agenda, seus clientes, suas notas",
      "Histórico, preferências e fotos do cliente",
      "Tempo entre atendimentos respeitado",
      "Indicadores pessoais de retenção",
    ],
  },
];

const SEGMENTS = [
  "Salões de beleza",
  "Clínicas de estética",
  "Lash & Brow",
  "Barbearias",
  "Esmalterias",
  "Massagem & Spa",
  "Wellness",
  "Estúdios independentes",
];

const ROI_STATS = [
  { value: "+18%", label: "Retenção média estimada com rebooking ativo" },
  { value: "−42%", label: "Queda potencial de no-show com confirmação semiassistida" },
  { value: "+12%", label: "Ocupação adicional com lista de espera trabalhada" },
  { value: "5x", label: "Mais rápido para a recepção fechar o dia" },
];

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function Landing() {
  return (
    <ErrorBoundary name="LandingPage">
      <div className="min-h-screen bg-background">
        <PublicHeader />

      {/* =========================================================
           HERO
           ========================================================= */}
      <section id="produto" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-soft" aria-hidden />
        <div className="pointer-events-none absolute -top-32 right-[-10%] h-80 w-80 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-[-10%] h-80 w-80 rounded-full bg-accent/20 blur-3xl" aria-hidden />

        <div className="container relative grid gap-12 py-16 md:grid-cols-12 md:py-28 lg:py-32">
          <div className="flex flex-col justify-center space-y-8 md:col-span-6 lg:col-span-7">
            <StatusBadge tone="brand" className="w-fit">Plataforma SaaS · Beleza & Wellness</StatusBadge>
            <h1 className="font-display text-5xl leading-[0.95] tracking-tight md:text-7xl lg:text-[5.5rem]">
              Sua gestão <br className="hidden md:block" />
              em <span className="text-gradient-brand italic">alta performance</span>.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground/90 md:text-xl leading-relaxed">

              Cativa centraliza agenda, clientes, pacotes, confirmações e portal
              de autoatendimento — para você focar em atender enquanto o sistema
              cuida da retenção, do rebooking e do no-show.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-14 rounded-2xl bg-gradient-brand px-8 text-lg shadow-lg tap-feedback">
                <Link to="/onboarding">
                  Começar trial grátis <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6">
                <Link to="/planos">Ver planos</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> 14 dias de trial
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Sem cartão de crédito
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> 100% pt-BR
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Mobile-first
              </li>
            </ul>
          </div>

          {/* Mock visual */}
          <div className="relative md:col-span-6 lg:col-span-5">
            <div className="absolute -inset-6 rounded-[36px] bg-gradient-brand opacity-20 blur-2xl" aria-hidden />
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hoje · Studio Centro</p>
                  <p className="font-display text-xl">Agenda do salão</p>
                </div>
                <StatusBadge tone="success">87% ocupação</StatusBadge>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { h: "09:00", n: "Marina Alves", s: "Coloração + corte", t: "success" as const, badge: "Confirmado" },
                  { h: "10:30", n: "Patrícia Lima", s: "Design de sobrancelha", t: "info" as const, badge: "Aguardando" },
                  { h: "11:15", n: "Carla Sousa", s: "Manicure + pedicure", t: "warning" as const, badge: "1ª visita" },
                  { h: "13:00", n: "Renato Dias", s: "Barba + corte", t: "brand" as const, badge: "VIP" },
                ].map((row) => (
                  <div key={row.h} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3">
                    <div className="grid h-10 w-12 place-items-center rounded-lg bg-primary-soft text-xs font-semibold text-primary">
                      {row.h}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.n}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.s}</p>
                    </div>
                    <StatusBadge tone={row.t}>{row.badge}</StatusBadge>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-muted/60 p-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Índice Cativa</p>
                  <p className="font-display text-2xl">82<span className="text-base text-muted-foreground">/100</span></p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className="flex items-center justify-end gap-1 text-success">
                    <TrendingUp className="h-3 w-3" /> +6 vs. mês anterior
                  </p>
                  <p>Retenção e rebooking em alta</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           BARRA DE PROVA / PROPOSTA
           ========================================================= */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="container grid gap-6 py-8 sm:grid-cols-2 md:grid-cols-4">
          {ROI_STATS.map((s) => (
            <div key={s.label} className="text-center md:text-left">
              <p className="font-display text-3xl text-primary">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
           DORES DO MERCADO
           ========================================================= */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <StatusBadge tone="warning">O problema</StatusBadge>
          <h2 className="mt-4 font-display text-3xl md:text-4xl">
            Atender é fácil. Fazer voltar é o desafio.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Salões, clínicas e estúdios perdem receita silenciosamente em três frentes.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.title} className="surface-card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
           COMO FUNCIONA
           ========================================================= */}
      <section id="como-funciona" className="border-y border-border/60 bg-gradient-soft py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <StatusBadge tone="brand">Como funciona</StatusBadge>
            <h2 className="mt-4 font-display text-3xl md:text-4xl">
              Três passos para virar a chave da operação
            </h2>
            <p className="mt-3 text-muted-foreground">
              Sem instalação, sem treinamento longo. A recepção entende em uma tarde.
            </p>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {HOW.map((h) => (
              <li key={h.n} className="surface-card relative p-6">
                <span className="font-display text-5xl leading-none text-primary/15">{h.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{h.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{h.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* =========================================================
           MÓDULOS
           ========================================================= */}
      <section id="modulos" className="container py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <StatusBadge tone="brand">Módulos</StatusBadge>
          <h2 className="mt-4 font-display text-3xl md:text-4xl">
            Tudo que sua operação precisa, sem inchar o sistema
          </h2>
          <p className="mt-3 text-muted-foreground">
            Cada módulo entrega valor sozinho — e ainda melhor quando combinados.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="surface-card group p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-soft text-primary">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{m.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
           ÍNDICE CATIVA — DIFERENCIAL
           ========================================================= */}
      <section id="indice-cativa" className="container py-16 md:py-24">
        <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-md">
          <div className="grid gap-0 md:grid-cols-12">
            <div className="space-y-5 p-8 md:col-span-7 md:p-12">
              <StatusBadge tone="brand">Diferencial proprietário</StatusBadge>
              <h2 className="font-display text-3xl md:text-4xl">
                Índice Cativa: a saúde do seu negócio em <span className="text-gradient-brand">um único número</span>.
              </h2>
              <p className="text-muted-foreground">
                Score de 0 a 100 que combina retenção, rebooking, confirmação,
                recuperação de no-show, ocupação, adesão à janela ideal de retorno,
                completude do CRM e valor futuro agendado — com pesos ponderados e
                tendência ao longo do tempo.
              </p>
              <ul className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  "Por negócio, unidade e profissional",
                  "Tendência mês a mês",
                  "Principais gargalos identificados",
                  "Recomendações Next Best Action",
                  "Filtros por período e segmento",
                  "Fórmulas transparentes e portáveis",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <Button asChild className="bg-gradient-brand">
                  <Link to="/onboarding">
                    Quero ver meu Índice <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative bg-gradient-soft p-8 md:col-span-5 md:p-12">
              <div className="surface-card p-6 shadow-sm">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Score atual</p>
                  <span className="flex items-center gap-1 text-xs text-success">
                    <TrendingUp className="h-3 w-3" /> +6
                  </span>
                </div>
                <p className="mt-1 font-display text-6xl text-primary">82<span className="text-2xl text-muted-foreground">/100</span></p>
                <div className="mt-4 space-y-2">
                  {[
                    { label: "Retenção", v: 88 },
                    { label: "Rebooking", v: 76 },
                    { label: "Confirmação", v: 91 },
                    { label: "Ocupação", v: 73 },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium">{row.v}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-brand"
                          style={{ width: `${row.v}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-accent/40 bg-accent-soft p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
                    <Zap className="h-3 w-3" /> Próxima ação sugerida
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Acionar lista de espera nos buracos da quarta — recupera ~3h de ocupação.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           BENEFÍCIOS POR PERFIL
           ========================================================= */}
      <section id="perfis" className="border-y border-border/60 bg-gradient-soft py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <StatusBadge tone="brand">Para cada perfil</StatusBadge>
            <h2 className="mt-4 font-display text-3xl md:text-4xl">
              Valor entregue para quem decide e para quem opera
            </h2>
            <p className="mt-3 text-muted-foreground">
              Da diretoria ao caixa. Cada papel ganha uma experiência sob medida.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PROFILES.map((p) => (
              <div key={p.role} className="surface-card flex flex-col p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <p.icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">{p.role}</p>
                <h3 className="mt-1 text-lg font-semibold">{p.title}</h3>
                <ul className="mt-3 flex-1 space-y-2 text-sm">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-muted-foreground">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
           SEGMENTOS
           ========================================================= */}
      <section id="segmentos" className="container py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <StatusBadge tone="brand">Segmentos atendidos</StatusBadge>
          <h2 className="mt-4 font-display text-3xl md:text-4xl">
            Feito para o seu segmento
          </h2>
          <p className="mt-3 text-muted-foreground">
            Templates iniciais por segmento aceleram o setup e respeitam o vocabulário do seu mercado.
          </p>
        </div>
        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-3">
          {SEGMENTS.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary"
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* =========================================================
           ROI conceitual
           ========================================================= */}
      <section id="roi" className="container py-16 md:py-24">
        <div className="overflow-hidden rounded-[28px] bg-gradient-brand p-1 shadow-lg">
          <div className="rounded-[24px] bg-card p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <StatusBadge tone="success">Prova de valor</StatusBadge>
                <h2 className="mt-4 font-display text-3xl md:text-4xl">
                  Onde o investimento vira receita
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Os ganhos do Cativa não vêm de mágica — vêm de operação organizada.
                  Cada módulo destrava uma alavanca conhecida do mercado.
                </p>
              </div>
              <ul className="space-y-3 text-sm">
                {[
                  { icon: Repeat, label: "Mais rebooking", text: "Próxima visita marcada antes do cliente sair." },
                  { icon: PhoneCall, label: "Menos no-show", text: "Confirmação semiassistida cobre as horas críticas." },
                  { icon: Star, label: "Mais ticket", text: "Pacotes e protocolos com adesão acompanhada." },
                  { icon: Users, label: "Menos atrito", text: "Portal do cliente reduz ligações na recepção." },
                ].map((it) => (
                  <li key={it.label} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3">
                    <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                      <it.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-medium">{it.label}</p>
                      <p className="text-xs text-muted-foreground">{it.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           CTA FINAL
           ========================================================= */}
      <section className="container pb-20 md:pb-28">
        <div className={cn(
          "rounded-3xl bg-gradient-brand p-10 text-center text-primary-foreground shadow-lg md:p-16",
        )}>
          <h2 className="font-display text-3xl md:text-4xl">
            Pronto para fazer o cliente voltar?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            14 dias grátis. Sem cartão. Você só paga se a Cativa fizer parte da rotina.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-xl bg-background px-6 text-foreground hover:bg-background/90">
              <Link to="/onboarding">
                Criar conta grátis <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-primary-foreground/30 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/planos">Ver planos</Link>
            </Button>
          </div>
        </div>
      </section>

        <PublicFooter />
      </div>
    </ErrorBoundary>
  );
}
