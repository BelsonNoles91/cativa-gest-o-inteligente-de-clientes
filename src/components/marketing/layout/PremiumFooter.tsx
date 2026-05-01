import { Link } from "react-router-dom";
import { ArrowRight, Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

const FOOTER_LINKS = [
  {
    title: "Produto",
    links: [
      { label: "Funcionalidades", href: "#modulos" },
      { label: "O Problema", href: "#dor" },
      { label: "Planos e Preços", href: "/planos" },
      { label: "Demonstração", href: "/demo" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre nós", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Carreiras", href: "#" },
      { label: "Contato", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidade", href: "#" },
      { label: "Termos de Uso", href: "#" },
      { label: "Cookies", href: "#" },
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
            <p className="text-white/60 text-lg leading-relaxed max-w-md mb-8 italic">
              "Nossa missão é transformar a gestão de negócios de beleza através de tecnologia inteligente e foco implacável na experiência do cliente."
            </p>
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-3 text-white/70 hover:text-accent transition-colors">
                  <Mail className="h-5 w-5" />
                  <span>contato@cativagestao.com.br</span>
               </div>
               <div className="flex items-center gap-3 text-white/70 hover:text-accent transition-colors">
                  <Phone className="h-5 w-5" />
                  <span>(11) 99999-9999</span>
               </div>
               <div className="flex items-center gap-3 text-white/70 hover:text-accent transition-colors">
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
                          <a href={link.href} className="text-white/60 hover:text-white transition-colors">
                            {link.label}
                          </a>
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
              <h3 className="text-2xl md:text-3xl font-display font-bold mb-2">Pronta para transformar sua clínica?</h3>
              <p className="text-muted-foreground">Experimente por 14 dias sem compromisso.</p>
           </div>
           <Button asChild size="lg" className="h-16 px-10 rounded-full bg-primary-dark text-white shadow-xl relative z-10">
              <Link to="/onboarding">Começar Trial Grátis</Link>
           </Button>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm">
            © 2026 Cativa Gestão Inteligente. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-accent hover:border-accent transition-all">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-accent hover:border-accent transition-all">
              <Linkedin className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
