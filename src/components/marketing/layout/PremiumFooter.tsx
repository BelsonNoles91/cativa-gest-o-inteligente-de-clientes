import { Link } from "react-router-dom";
import { ArrowRight, Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

const FOOTER_LINKS = [
  {
    title: "Produto",
    links: [
      { label: "Funcionalidades", href: "/#funcionalidades" },
      { label: "Módulos", href: "/#modulos" },
      { label: "Preços", href: "/#planos" },
       { label: "Começar grátis", href: "/onboarding" },
    ],
  },
  {
    title: "Para quem é",
    links: [
      { label: "Clínicas de estética", href: "/#solucao" },
      { label: "Salões de beleza", href: "/#solucao" },
      { label: "Barbearias", href: "/#solucao" },
      { label: "Wellness & Spa", href: "/#solucao" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidade", href: "/privacidade" },
      { label: "Termos de Uso", href: "/termos" },
      { label: "Status do Sistema", href: "/status" },
    ],
  },
];

export function PremiumFooter() {
  return (
    <footer className="bg-primary-dark text-white pt-24 pb-12 border-t border-white/5 overflow-hidden relative">
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 blur-[150px] rounded-full -z-10 translate-x-1/2 translate-y-1/2" />
      
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Top Section */}
        <div className="grid lg:grid-cols-12 gap-16 mb-20">
          <div className="lg:col-span-5">
            <Link to="/" className="flex items-center group mb-8">
              <Logo className="brightness-0 invert" size="md" />
            </Link>
            <p className="text-white/60 text-lg leading-relaxed max-w-md mb-8">
              Gestão que faz o cliente voltar. Sistema para clínicas e salões que querem organizar agenda, clientes, confirmações e indicadores com foco em retenção.
            </p>
            <div className="flex flex-col gap-4">
               <a href="mailto:contato@cativagestao.com.br" className="flex items-center gap-3 text-white/70 hover:text-accent transition-colors">
                  <Mail className="h-5 w-5" />
                  <span>contato@cativagestao.com.br</span>
               </a>
               <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/70 hover:text-accent transition-colors">
                  <Phone className="h-5 w-5" />
                  <span>Falar com Especialista</span>
               </a>
               <div className="flex items-center gap-3 text-white/70">
                  <MapPin className="h-5 w-5" />
                  <span>São Paulo, SP - Brasil</span>
               </div>
            </div>
          </div>

          <div className="lg:col-span-7">
             <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
                {FOOTER_LINKS.map(section => (
                  <div key={section.title}>
                    <h4 className="font-bold uppercase tracking-widest text-xs text-accent mb-6">{section.title}</h4>
                    <ul className="flex flex-col gap-4">
                      {section.links.map(link => (
                        <li key={link.label}>
                          <Link to={link.href} className="text-white/60 hover:text-white transition-colors">
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="p-8 md:p-12 rounded-[40px] bg-white text-primary-dark flex flex-col md:flex-row items-center justify-between gap-8 mb-20 relative overflow-hidden group">
           <div className="absolute inset-0 bg-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
           <div className="relative z-10 text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-display font-bold mb-2">Pronta para profissionalizar sua clínica?</h3>
              <p className="text-muted-foreground">Escolha o plano gratuito ou experimente os recursos premium por 14 dias.</p>
           </div>
           <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full md:w-auto">
             <Button asChild size="lg" className="h-16 px-10 rounded-full bg-primary-dark text-white shadow-xl">
                <Link to="/onboarding">Começar agora grátis</Link>
             </Button>
           </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center gap-8 text-white/40 text-sm">
            <p>© 2026 Cativa Gestão Inteligente. Todos os direitos reservados.</p>
            <div className="flex gap-6">
              <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
              <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
              <Link to="/status" className="hover:text-white transition-colors">Status</Link>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://instagram.com/cativagestao" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-accent hover:border-accent transition-all">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="https://linkedin.com/company/cativagestao" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-accent hover:border-accent transition-all">
              <Linkedin className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
