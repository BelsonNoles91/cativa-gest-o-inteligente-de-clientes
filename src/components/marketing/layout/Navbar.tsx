import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Funcionalidades", href: "#funcionalidades" },
    { name: "Módulos", href: "#modulos" },
    { name: "Métricas", href: "#metricas" },
    { name: "Planos", href: "/planos" },
    { name: "Demonstração", href: "/demo" },
    { name: "Dúvidas", href: "#duvidas" },
  ];

  return (
    <nav 
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] transition-all duration-500 px-4 md:px-12",
        isScrolled ? "py-2 md:py-4" : "py-4 md:py-10"
      )}
    >
      <div 
        className={cn(
          "mx-auto max-w-7xl h-16 md:h-20 rounded-full flex items-center justify-between px-6 md:px-10 transition-all duration-500",
          isScrolled 
            ? "bg-white/90 backdrop-blur-xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.05)] border border-white/40" 
            : "bg-white/40 backdrop-blur-md border border-white/20 lg:bg-transparent lg:backdrop-blur-none lg:border-none"
        )}
      >
        <Link to="/" className="flex items-center gap-2 group transition-transform hover:scale-[1.02]">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
             <span className="text-white font-black text-lg md:text-xl font-display">C</span>
          </div>
          <span className="text-xl md:text-2xl font-display font-black tracking-tighter text-primary-dark">
            CATIVA<span className="text-accent group-hover:animate-pulse">.</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a 
              key={link.name}
              href={link.href} 
              className="text-[10px] font-bold uppercase tracking-widest text-primary-dark hover:text-accent transition-colors"
            >
              {link.name}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <Link to="/auth/login" className="text-[10px] font-bold uppercase tracking-widest text-primary-dark hover:text-accent transition-colors px-6">
            Entrar
          </Link>
          <Button asChild variant="outline" size="sm" className="px-8 border-primary-dark/20 hover:bg-primary-dark hover:text-white transition-all duration-300">
            <Link to="/demo">Demonstração</Link>
          </Button>
          <Button asChild variant="premium" size="sm" className="px-8 shadow-lg shadow-accent/20">
            <Link to="/onboarding">Começar Agora</Link>
          </Button>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="lg:hidden w-12 h-12 flex items-center justify-center text-primary-dark"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 bg-white z-[110] p-12 flex flex-col lg:hidden"
          >
            <div className="flex justify-between items-center mb-24">
              <span className="text-2xl font-display font-black tracking-tighter text-primary-dark">CATIVA.</span>
              <button onClick={() => setMobileMenuOpen(false)} className="w-12 h-12 flex items-center justify-center">
                <X className="h-8 w-8" />
              </button>
            </div>
            
            <div className="flex flex-col gap-10 overflow-y-auto">
              {navLinks.map((link) => (
                <a 
                  key={link.name}
                  href={link.href} 
                  className="text-4xl font-display font-bold text-primary-dark" 
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
            </div>

            <div className="mt-auto space-y-6">
               <Button asChild size="lg" className="w-full h-16 rounded-2xl bg-accent text-xl">
                  <Link to="/onboarding">Começar Agora</Link>
               </Button>
               <Button asChild size="lg" variant="outline" className="w-full h-16 rounded-2xl text-xl">
                  <Link to="/demo">Agendar Demonstração</Link>
               </Button>
               <Button variant="ghost" asChild size="lg" className="w-full h-16 rounded-2xl text-xl">
                  <Link to="/auth/login">Entrar</Link>
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}