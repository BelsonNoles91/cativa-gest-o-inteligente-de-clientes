import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

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

  return (
    <nav 
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] transition-all duration-500 px-6 md:px-12",
        isScrolled ? "py-4" : "py-10"
      )}
    >
      <div 
        className={cn(
          "mx-auto max-w-7xl h-20 rounded-full flex items-center justify-between px-10 transition-all duration-500",
          isScrolled 
            ? "bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.05)] border border-white/40" 
            : "bg-transparent"
        )}
      >
        <Link to="/" className="flex items-center group">
          <span className="text-2xl font-display font-black tracking-tighter text-primary-dark">
            CATIVA<span className="text-accent group-hover:animate-pulse">.</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-12">
          {["Funcionalidades", "Módulos", "Planos", "FAQ"].map((link) => (
            <Link 
              key={link} 
              to={`#${link.toLowerCase()}`} 
              className="text-sm font-bold uppercase tracking-widest text-primary-dark/60 hover:text-accent transition-colors"
            >
              {link}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-8">
          <Link to="/login" className="text-sm font-bold uppercase tracking-widest text-primary-dark/60 hover:text-primary-dark transition-colors">
            Entrar
          </Link>
          <Button asChild className="rounded-full px-8 bg-primary-dark hover:bg-accent transition-all duration-500 shadow-lg shadow-primary/10">
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

      {/* Mobile Menu */}
      <div className={cn(
        "fixed inset-0 bg-white z-[110] p-12 flex flex-col transition-all duration-700 ease-in-out lg:hidden",
        mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}>
        <div className="flex justify-between items-center mb-24">
          <span className="text-2xl font-display font-black tracking-tighter text-primary-dark">CATIVA.</span>
          <button onClick={() => setMobileMenuOpen(false)} className="w-12 h-12 flex items-center justify-center">
            <X className="h-8 w-8" />
          </button>
        </div>
        
        <div className="flex flex-col gap-12">
          {["Funcionalidades", "Módulos", "Planos", "FAQ"].map((link) => (
            <Link 
              key={link} 
              to={`#${link.toLowerCase()}`} 
              className="text-4xl font-display font-bold text-primary-dark"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link}
            </Link>
          ))}
        </div>

        <div className="mt-auto space-y-6">
           <Button asChild size="lg" className="w-full h-16 rounded-2xl bg-primary-dark text-xl">
              <Link to="/onboarding">Começar Agora</Link>
           </Button>
           <Button variant="ghost" asChild size="lg" className="w-full h-16 rounded-2xl text-xl">
              <Link to="/login">Entrar</Link>
           </Button>
        </div>
      </div>
    </nav>
  );
}
