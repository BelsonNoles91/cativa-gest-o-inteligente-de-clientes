import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Instagram, Linkedin, Twitter } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white pt-32 pb-16 border-t border-border/40">
      <div className="container mx-auto px-6 md:px-8 max-w-7xl">
        <div className="grid lg:grid-cols-12 gap-20 mb-32">
          {/* Brand Info */}
          <div className="lg:col-span-5">
            <Link to="/" className="inline-block mb-10">
              <span className="text-3xl font-display font-black tracking-tighter text-primary-dark">
                CATIVA<span className="text-accent">.</span>
              </span>
            </Link>
            <p className="text-xl text-muted-foreground/70 font-light leading-relaxed mb-12 max-w-md">
              Elevando o padrão operacional do mercado de beleza através de design impecável e inteligência de dados.
            </p>
            <div className="flex gap-6">
              {[Instagram, Linkedin, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-12 h-12 rounded-full border border-border/60 flex items-center justify-center text-primary-dark hover:bg-primary-dark hover:text-white transition-all duration-500">
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="lg:col-span-2">
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-primary-dark mb-10">Produto</h4>
            <ul className="space-y-6">
              {["Funcionalidades", "Soluções", "Agenda", "Relatórios"].map(item => (
                <li key={item}>
                  <Link to="#" className="text-muted-foreground hover:text-accent transition-colors font-light">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-primary-dark mb-10">Empresa</h4>
            <ul className="space-y-6">
              {["Sobre nós", "Blog", "Carreiras", "Contato"].map(item => (
                <li key={item}>
                  <Link to="#" className="text-muted-foreground hover:text-accent transition-colors font-light">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA / Newsletter */}
          <div className="lg:col-span-3">
            <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-primary-dark mb-10">Novidades</h4>
            <p className="text-sm text-muted-foreground mb-8 font-light">Assine nossa curadoria sobre gestão e UX.</p>
            <div className="relative group">
              <input 
                type="email" 
                placeholder="Seu melhor e-mail" 
                className="w-full bg-secondary/30 border-none rounded-none py-4 px-6 text-sm focus:ring-1 focus:ring-accent transition-all outline-none"
              />
              <button className="absolute right-0 top-0 bottom-0 px-6 bg-primary-dark text-white group-hover:bg-accent transition-colors">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-16 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-xs text-muted-foreground/60 font-medium uppercase tracking-widest">
            © {currentYear} Cativa. Todos os direitos reservados.
          </p>
          <div className="flex gap-12">
            <Link to="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-primary-dark transition-colors">Privacidade</Link>
            <Link to="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-primary-dark transition-colors">Termos</Link>
            <Link to="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-primary-dark transition-colors">Segurança</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
