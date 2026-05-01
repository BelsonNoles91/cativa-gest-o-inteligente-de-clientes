import { Link } from "react-router-dom";
import { ArrowRight, Instagram, Linkedin } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white pt-32 pb-16 border-t border-border/40">
      <div className="container mx-auto px-6 md:px-8 max-w-7xl">
        <div className="grid lg:grid-cols-12 gap-20 mb-32">
          {/* Brand Info */}
          <div className="lg:col-span-6">
            <Link to="/" className="inline-flex items-center gap-3 mb-10 group transition-transform hover:scale-[1.02]">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
                 <span className="text-white font-black text-xl font-display">C</span>
              </div>
              <span className="text-3xl font-display font-black tracking-tighter text-primary-dark">
                CATIVA<span className="text-accent">.</span>
              </span>
            </Link>
            <p className="text-xl text-primary-dark/80 font-medium leading-relaxed mb-12 max-w-md">
              A inteligência operacional que clínicas de estética e salões premium utilizam para escalar com consistência e design.
            </p>
            <div className="flex gap-6">
              {[Instagram, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-12 h-12 rounded-full border border-border/60 flex items-center justify-center text-primary-dark hover:bg-primary-dark hover:text-white transition-all duration-500">
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="lg:col-span-3">
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-primary-dark mb-10">Plataforma</h4>
            <ul className="space-y-6">
              <li><a href="#funcionalidades" className="text-primary-dark/70 hover:text-accent transition-colors font-semibold">Funcionalidades</a></li>
              <li><a href="#modulos" className="text-primary-dark/70 hover:text-accent transition-colors font-semibold">Módulos</a></li>
              <li><a href="#planos" className="text-primary-dark/70 hover:text-accent transition-colors font-semibold">Planos</a></li>
              <li><Link to="/onboarding" className="text-primary-dark/70 hover:text-accent transition-colors font-semibold">Agendar Demonstração</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-primary-dark mb-10">Suporte</h4>
            <ul className="space-y-6">
              <li><a href="#duvidas" className="text-primary-dark/70 hover:text-accent transition-colors font-semibold">Dúvidas Frequentes</a></li>
              <li><Link to="/auth/login" className="text-primary-dark/70 hover:text-accent transition-colors font-semibold">Área do Cliente</Link></li>
              <li><Link to="/privacidade" className="text-primary-dark/70 hover:text-accent transition-colors font-semibold">Privacidade</Link></li>
              <li><Link to="/termos" className="text-primary-dark/70 hover:text-accent transition-colors font-semibold">Termos de Uso</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-16 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest text-center md:text-left">
            © {currentYear} Cativa. Inteligência para Negócios de Beleza.
          </p>
          <div className="flex gap-12">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Desenvolvido com excelência</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
