import { SignupLink } from "@/features/system/SignupLink";
/**
 * PublicHeader — cabeçalho compartilhado da presença pública (Landing,
 * Planos, futuras páginas institucionais).
 *
 * Mobile-first: menu colapsa em sheet. Foco em clareza + CTAs visíveis.
 */
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/#produto", label: "Produto" },
  { to: "/#modulos", label: "Módulos" },
  { to: "/#indice-cativa", label: "Índice Cativa" },
  { to: "/#segmentos", label: "Segmentos" },
  { to: "/planos", label: "Planos" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" aria-label="Cativa — início">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm md:flex">
          {NAV.map((item) =>
            item.to.startsWith("/#") ? (
              <a
                key={item.to}
                href={item.to.replace("/", "")}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "transition-colors hover:text-foreground",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth/login">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-xl bg-gradient-brand">
            <SignupLink>Começar grátis</SignupLink>
          </Button>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg border border-border/70 md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <div className="container flex flex-col gap-1 py-3">
            {NAV.map((item) =>
              item.to.startsWith("/#") ? (
                <a
                  key={item.to}
                  href={item.to.replace("/", "")}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ),
            )}
            <div className="mt-2 flex gap-2 pt-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/auth/login">Entrar</Link>
              </Button>
              <Button asChild className="flex-1 bg-gradient-brand">
                <SignupLink>Começar grátis</SignupLink>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
