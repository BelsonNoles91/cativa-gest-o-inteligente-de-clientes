/**
 * AuthLayout — layout das telas de autenticação (login, recuperar senha).
 * Refinado com o design premium da landing page.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, CalendarHeart, Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-background font-sans selection:bg-accent/30 selection:text-primary-dark">
      {/* Lado do Branding - Estilo Editorial Premium */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-16 text-primary-dark">
        {/* Elementos Visuais de Fundo (Estilo Hero) */}
        <div className="absolute top-0 right-0 w-full h-full bg-[#F3EBF0] -skew-x-6 transform origin-top-right -z-10 translate-x-20 opacity-50" />
        <div className="absolute top-[10%] left-[5%] text-[10rem] font-display font-bold text-primary/5 select-none pointer-events-none leading-none">
          CATIVA
        </div>

        <Link to="/" className="relative z-10">
          <span className="text-3xl font-display font-black tracking-tighter text-primary-dark">
            CATIVA<span className="text-accent">.</span>
          </span>
        </Link>

        <div className="relative z-10 max-w-lg space-y-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white border border-secondary shadow-sm mb-4">
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">SaaS Premium para Beleza</span>
            </div>
            <h2 className="font-display text-6xl leading-[0.9] tracking-tighter">
              A inteligência <br />
              que faz seu negócio <br />
              <span className="italic serif font-normal text-accent-strong relative inline-block">
                prosperar.
                <svg className="absolute -bottom-1 left-0 w-full h-2 text-accent/30 -z-10" viewBox="0 0 300 12" fill="none">
                  <path d="M1 10.5C50 4 150 1 299 10.5" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
                </svg>
              </span>
            </h2>
          </div>

          <div className="space-y-8">
            {[
              { icon: CalendarHeart, text: "Agenda inteligente", desc: "Otimizada para ocupação total." },
              { icon: Sparkles, text: "Gestão de Fidelidade", desc: "Pacotes e protocolos que geram retorno." },
              { icon: ShieldCheck, text: "Segurança de Dados", desc: "Controle total sobre sua operação." },
            ].map(({ icon: Icon, text, desc }) => (
              <div key={text} className="flex items-start gap-4 group">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm border border-border/40 group-hover:scale-110 transition-transform duration-500">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-primary-dark tracking-tight">{text}</h4>
                  <p className="text-sm text-muted-foreground font-light">{desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>

        <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.3em] text-primary-dark/70">
          © {new Date().getFullYear()} Cativa. Desenvolvido com excelência.
        </p>
      </aside>

      {/* Lado do Formulário */}
      <main className="flex flex-col bg-white">
        <header className="flex items-center justify-between p-8 lg:hidden">
          <Link to="/">
            <span className="text-2xl font-display font-black tracking-tighter text-primary-dark">
              CATIVA<span className="text-accent">.</span>
            </span>
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 md:px-12 py-16">
          <div className="w-full max-w-md animate-fade-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
