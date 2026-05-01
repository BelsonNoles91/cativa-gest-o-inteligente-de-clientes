import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

const NAV_LINKS = [
  { label: "Funcionalidades", href: "/#funcionalidades" },
  { label: "Módulos", href: "/#modulos" },
  { label: "Métricas", href: "/#metricas" },
  { label: "Planos", href: "/#planos" },
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
          <Logo size="sm" className="transition-transform group-hover:scale-105 h-8 md:h-10 w-auto" />
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
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[90]"
            />
            <motion.div 
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 right-0 w-[280px] bg-white z-[100] shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border/40">
                <Logo size="sm" className="h-8 w-auto" />
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-primary-dark rounded-full hover:bg-accent/10"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                <nav className="flex flex-col gap-4">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.label}
                      to={link.href}
                      className="text-lg font-medium text-primary-dark hover:text-accent transition-colors py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <hr className="border-border/40" />
                <div className="flex flex-col gap-3">
                  <Button asChild variant="outline" size="lg" className="w-full rounded-xl border-primary-dark/10">
                    <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>Entrar</Link>
                  </Button>
                  <Button asChild size="lg" className="w-full rounded-xl bg-primary-dark shadow-xl shadow-primary/10">
                    <Link to="/demo" onClick={() => setMobileMenuOpen(false)}>Agendar Demo</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
