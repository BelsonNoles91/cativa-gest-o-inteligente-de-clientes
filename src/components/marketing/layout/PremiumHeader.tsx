import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Funcionalidades", href: "/#funcionalidades" },
  { label: "Módulos", href: "/#modulos" },
  { label: "Métricas", href: "/#metricas" },
  { label: "Planos", href: "/planos" },
  { label: "Demonstração", href: "/demo" },
];

export function PremiumHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out px-4 py-4 md:px-8",
        isScrolled 
          ? "bg-white/90 backdrop-blur-xl border-b border-border/40 py-3 shadow-sm" 
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center group shrink-0" aria-label="Cativa - Home">
          <Logo size="sm" className="transition-transform group-hover:scale-105" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 overflow-x-auto no-scrollbar">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors relative group whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-accent rounded-md px-1"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3 xl:gap-4 shrink-0">
          <Button asChild variant="ghost" className="font-semibold text-sm focus:ring-2 focus:ring-accent">
            <Link to="/auth/login">Entrar</Link>
          </Button>
          <Button asChild className="rounded-full bg-primary-dark hover:bg-primary px-4 xl:px-6 shadow-lg shadow-primary/10 transition-all active:scale-95 focus:ring-2 focus:ring-accent focus:ring-offset-2">
            <Link to="/demo">Agendar Demo</Link>
          </Button>
        </div>

        {/* Mobile Toggle */}
        <button
          className="lg:hidden p-2 text-primary-dark rounded-full hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-b border-border animate-fade-in shadow-2xl overflow-hidden h-screen flex flex-col">
          <div className="p-8 flex flex-col gap-6 items-center">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-2xl font-display font-medium text-primary-dark"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <hr className="w-full border-border" />
            <Button asChild variant="outline" size="lg" className="w-full rounded-full">
              <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>Entrar</Link>
            </Button>
            <Button asChild size="lg" className="w-full rounded-full bg-primary-dark shadow-xl">
              <Link to="/onboarding" onClick={() => setMobileMenuOpen(false)}>Começar agora</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
