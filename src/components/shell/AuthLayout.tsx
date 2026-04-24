/**
 * AuthLayout — layout das telas de autenticação (login, recuperar senha).
 * Split visual: lado esquerdo branding, lado direito formulário.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { Sparkles, ShieldCheck, CalendarHeart } from "lucide-react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Brand side */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-brand p-10 text-primary-foreground lg:flex">
        <div data-volatile className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div data-volatile className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />

        <Link to="/" className="relative z-10">
          <Logo size="lg" />
        </Link>

        <div className="relative z-10 max-w-md space-y-6">
          <h2 className="font-display text-4xl leading-tight">
            Gestão que faz o cliente <em className="not-italic text-accent-soft">voltar</em>.
          </h2>
          <p className="text-primary-foreground/80">
            Centralize agenda, clientes, pacotes e confirmações em um só lugar.
            Operação leve no mobile, visão clara para quem decide.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              { icon: CalendarHeart, text: "Agenda inteligente, otimizada para ocupação" },
              { icon: Sparkles, text: "Pacotes, protocolos e memberships" },
              { icon: ShieldCheck, text: "Multi-unidade, papéis e permissões" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-foreground/15">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Cativa. Feito para negócios de beleza e bem-estar.
        </p>
      </aside>

      {/* Form side */}
      <main className="flex flex-col">
        <header className="flex items-center justify-between p-6 lg:hidden">
          <Logo size="md" />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md animate-fade-in">{children}</div>
        </div>
      </main>
    </div>
  );
}
