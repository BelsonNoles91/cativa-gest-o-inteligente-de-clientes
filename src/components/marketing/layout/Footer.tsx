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
            <Link to="/" className="inline-block mb-10">
              <span className="text-3xl font-display font-black tracking-tighter text-primary-dark">
                CATIVA<span className="text-accent">.</span>
              </span>
            </Link>
            <p className="text-xl text-muted-foreground/70 font-light leading-relaxed mb-12 max-w-md">
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
              <li><a href="#features" className="text-muted-foreground hover:text-accent transition-colors font-light">Funcionalidades</a></li>
              <li><a href="#modulos" className="text-muted-foreground hover:text-accent transition-colors font-light">Módulos</a></li>
              <li><a href="#planos" className="text-muted-foreground hover:text-accent transition-colors font-light">Planos</a></li>
              <li><Link to="/demo" className="text-muted-foreground hover:text-accent transition-colors font-light">Agendar Demo</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-primary-dark mb-10">Suporte</h4>
            <ul className="space-y-6">
              <li><a href="#faq" className="text-muted-foreground hover:text-accent transition-colors font-light">Central de Ajuda</a></li>
              <li><Link to="/auth/login" className="text-muted-foreground hover:text-accent transition-colors font-light">Área do Cliente</Link></li>
              <li><Link to="#" className="text-muted-foreground hover:text-accent transition-colors font-light">Privacidade</Link></li>
              <li><Link to="#" className="text-muted-foreground hover:text-accent transition-colors font-light">Termos de Uso</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-16 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">
            © {currentYear} Cativa. Inteligência para Negócios de Beleza.
          </p>
          <div className="flex gap-12">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Made for Excellence</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
