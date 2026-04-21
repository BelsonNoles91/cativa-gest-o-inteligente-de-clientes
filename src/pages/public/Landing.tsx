/**
 * Landing page pública.
 */
import { Link } from "react-router-dom";
import { ArrowRight, CalendarHeart, MessageCircle, PackageOpen, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/StatusBadge";

const features = [
  { icon: CalendarHeart, title: "Agenda inteligente", text: "Confirmações, lista de espera e ocupação otimizada da sua equipe." },
  { icon: Users, title: "CRM de retenção", text: "Histórico, preferências e gatilhos para o cliente voltar mais vezes." },
  { icon: PackageOpen, title: "Pacotes & Protocolos", text: "Memberships, sessões e protocolos prontos para qualquer segmento." },
  { icon: MessageCircle, title: "Confirmação semiautomática", text: "Mensagens prontas com um clique, sem depender de API de WhatsApp." },
  { icon: Sparkles, title: "Painel premium", text: "Visão clara para quem decide, simplicidade para quem opera." },
  { icon: ShieldCheck, title: "Multi-unidade & papéis", text: "Permissões finas por papel e unidade. Pronto para escalar." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm md:flex">
            <a href="#recursos" className="text-muted-foreground hover:text-foreground">Recursos</a>
            <a href="#segmentos" className="text-muted-foreground hover:text-foreground">Segmentos</a>
            <Link to="/planos" className="text-muted-foreground hover:text-foreground">Planos</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth/login">Entrar</Link>
            </Button>
            <Button asChild className="rounded-xl bg-gradient-brand">
              <Link to="/onboarding">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-soft" />
        <div className="container relative grid gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <StatusBadge tone="brand">Novo · Cativa para beleza & wellness</StatusBadge>
            <h1 className="font-display text-4xl leading-[1.05] md:text-6xl">
              Gestão que faz o <span className="text-gradient-brand">cliente voltar</span>.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground md:text-lg">
              Centralize agenda, clientes, pacotes e confirmações. Mobile-first para a recepção, premium para quem decide.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-xl bg-gradient-brand px-6 shadow-md">
                <Link to="/onboarding">
                  Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6">
                <Link to="/planos">Ver planos</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              14 dias de trial · sem cartão de crédito · pt-BR nativo
            </p>
          </div>

          {/* Mock visual */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-[36px] bg-gradient-brand opacity-20 blur-2xl" aria-hidden />
            <div className="relative rounded-3xl border border-border/70 bg-card p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hoje</p>
                  <p className="font-display text-xl">Agenda do salão</p>
                </div>
                <StatusBadge tone="success">87% ocupação</StatusBadge>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { h: "09:00", n: "Marina Alves", s: "Coloração + corte", t: "success" as const },
                  { h: "10:30", n: "Patrícia Lima", s: "Design de sobrancelha", t: "info" as const },
                  { h: "11:15", n: "Carla Sousa", s: "Manicure + pedicure", t: "warning" as const },
                  { h: "13:00", n: "Renato Dias", s: "Barba + corte", t: "brand" as const },
                ].map((row) => (
                  <div key={row.h} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3">
                    <div className="grid h-10 w-12 place-items-center rounded-lg bg-primary-soft text-xs font-semibold text-primary">
                      {row.h}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.n}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.s}</p>
                    </div>
                    <StatusBadge tone={row.t}>Confirmado</StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="container py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl md:text-4xl">Tudo o que sua recepção precisa</h2>
          <p className="mt-3 text-muted-foreground">
            Operação leve no dia a dia. Decisões claras no fim do mês.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="surface-card group p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-soft text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Segmentos */}
      <section id="segmentos" className="border-t border-border/70 bg-gradient-soft py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl md:text-4xl">Feito para o seu segmento</h2>
            <p className="mt-3 text-muted-foreground">Salão · Clínica · Lash & Brow · Barbearia · Esmalteria · Wellness</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 md:py-24">
        <div className="rounded-3xl bg-gradient-brand p-10 text-center text-primary-foreground shadow-lg md:p-16">
          <h2 className="font-display text-3xl md:text-4xl">Pronto para fazer o cliente voltar?</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Comece em minutos. Sem instalação, sem complicação.
          </p>
          <Button asChild size="lg" className="mt-6 h-12 rounded-xl bg-background px-6 text-foreground hover:bg-background/90">
            <Link to="/onboarding">Criar conta grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/70 py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} Cativa. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
