import { SignupLink, useSignupsOpen } from "@/features/system/SignupLink";
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
  { label: "Preços", href: "/#planos" },
  { label: "Dúvidas", href: "/#duvidas" },
];

export function PremiumHeader() {
  const signupsOpen = useSignupsOpen();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState(() =>
    typeof window !== "undefined" && window.location.hash
      ? `/${window.location.hash}`
      : ""
  );

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash ? `/${window.location.hash}` : "");
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

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
          ? "bg-white border-b border-border/40 py-3 shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center group shrink-0" aria-label="Cativa - Home">
          <Logo size="md" className="transition-transform group-hover:scale-105 h-8 md:h-10 w-auto" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = activeHash === link.href;
            return (
              <Link
                key={link.label}
                to={link.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActiveHash(link.href)}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-primary"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
          {signupsOpen && (
            <Button asChild variant="ghost" className="text-sm px-4">
              <Link to="/auth/login">Entrar</Link>
            </Button>
          )}
          <Button asChild variant="premium" className="rounded-xl h-10 px-5 text-sm">
            <SignupLink>
              {signupsOpen ? "Começar agora grátis" : "Entrar na minha conta"}
            </SignupLink>
          </Button>
        </div>

        {/* Mobile Toggle */}
        <button
          className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-full text-primary-dark hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              className="lg:hidden fixed inset-y-0 right-0 w-[86vw] max-w-[320px] bg-white z-[100] shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border/40">
                <Logo size="sm" className="h-8 w-auto" />
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-primary-dark hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                <nav className="flex flex-col gap-1">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.label}
                      to={link.href}
                      className="flex min-h-[48px] items-center rounded-xl px-3 text-lg font-medium text-primary-dark transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <hr className="border-border/40" />
                <div className="flex flex-col gap-3">
                  {signupsOpen && (
                    <Button asChild variant="outline" size="lg" className="w-full rounded-xl">
                      <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>Entrar</Link>
                    </Button>
                  )}
                  <Button asChild variant="premium" size="lg" className="w-full rounded-xl">
                    <SignupLink onClick={() => setMobileMenuOpen(false)}>
                      {signupsOpen ? "Começar agora grátis" : "Entrar na minha conta"}
                    </SignupLink>
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
