import { AlertCircle, TrendingDown, Clock, Users, ShieldAlert, BarChart3 } from "lucide-react";
import { PremiumSection, PremiumGrid } from "../layout/PremiumSection";

const PAINS = [
  {
    icon: TrendingDown,
    title: "Vazamento de Clientes",
    description: "Você investe para atrair, mas eles não retornam. Sem um fluxo de rebooking, seu balde está furado.",
  },
  {
    icon: Clock,
    title: "Caos na Agenda",
    description: "Buracos no dia e no-shows de última hora que destroem sua lucratividade diária.",
  },
  {
    icon: Users,
    title: "Recepção Asfixiada",
    description: "WhatsApp apitando, telefone tocando e clientes esperando. A operação manual não escala.",
  },
  {
    icon: ShieldAlert,
    title: "Segurança de Dados",
    description: "Informações de clientes e financeiro espalhados em papel ou sistemas amadores.",
  },
  {
    icon: BarChart3,
    title: "Decisão no 'Feeling'",
    description: "Você não sabe qual sua taxa de retenção real ou qual serviço traz lucro de verdade.",
  },
  {
    icon: AlertCircle,
    title: "Dependência da Equipe",
    description: "O conhecimento está na cabeça dos profissionais, não no seu sistema. Se alguém sai, o cliente vai junto.",
  },
];

export function ProblemSection() {
  return (
    <PremiumSection id="dor" variant="light" padding="lg">
      <div className="max-w-3xl mx-auto text-center mb-20">
        <h2 className="text-accent font-bold tracking-widest uppercase text-sm mb-4">O cenário real</h2>
        <h3 className="font-display text-4xl md:text-5xl lg:text-6xl text-primary-dark mb-6 tracking-tight">
          Gerir um negócio de beleza <br className="hidden md:block" />
          é mais difícil do que parece.
        </h3>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Planilhas e agendas de papel resolvem o horário, mas não resolvem o negócio. 
          Onde estão os gargalos que impedem você de faturar 30% mais?
        </p>
      </div>

      <PremiumGrid cols="3" gap="lg">
        {PAINS.map((pain, index) => (
          <div 
            key={pain.title} 
            className="group relative p-8 rounded-[32px] bg-white border border-border/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <pain.icon className="h-7 w-7 text-primary" />
            </div>
            
            <h4 className="text-xl font-display font-bold text-primary-dark mb-3">
              {pain.title}
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              {pain.description}
            </p>
          </div>
        ))}
      </PremiumGrid>

      <div className="mt-20 p-8 md:p-12 rounded-[40px] bg-primary-dark text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 blur-[100px] rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <h4 className="text-2xl md:text-3xl font-display font-bold mb-4 italic text-accent">
              "O problema não é falta de clientes, é falta de retenção."
            </h4>
            <p className="text-white/70 text-lg">
              A Cativa foi criada para inverter essa lógica. Nós não apenas agendamos horários, nós construímos relacionamentos lucrativos.
            </p>
          </div>
          <div className="flex-shrink-0">
             <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                <p className="text-sm font-bold uppercase tracking-widest text-accent mb-2">Impacto Cativa</p>
                <p className="text-4xl font-display font-bold">+24%</p>
                <p className="text-xs text-white/60">Aumento médio no LTV (Lifetime Value) <br />nos primeiros 90 dias.</p>
             </div>
          </div>
        </div>
      </div>
    </PremiumSection>
  );
}
