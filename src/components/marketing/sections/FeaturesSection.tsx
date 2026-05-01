import { 
  Users, 
  Calendar, 
  MessageSquare, 
  TrendingUp, 
  Package, 
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import { PremiumSection } from "../layout/PremiumSection";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    title: "CRM de Retenção",
    description: "Histórico clínico completo, preferências, fotos e lembretes automáticos de retorno baseados no ciclo de cada serviço.",
    icon: Users,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    title: "Agenda Inteligente",
    description: "Visões múltiplas, bloqueios por profissional, tempo de setup entre serviços e lista de espera automatizada.",
    icon: Calendar,
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    title: "Central de Confirmação",
    description: "Reduza o no-show em até 40% com uma fila de confirmação organizada que não exige APIs complexas do WhatsApp.",
    icon: MessageSquare,
    color: "bg-green-500/10 text-green-600",
  },
  {
    title: "Indicadores Cativa",
    description: "Sua saúde operacional em um único score. Saiba quem são seus melhores profissionais e clientes em segundos.",
    icon: TrendingUp,
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    title: "Pacotes e Assinaturas",
    description: "Crie planos recorrentes e pacotes de sessões com controle automático de saldo e validade.",
    icon: Package,
    color: "bg-rose-500/10 text-rose-600",
  },
  {
    title: "Portal do Cliente",
    description: "Dê autonomia para seu cliente agendar, reagendar e consultar histórico através de um link personalizado da sua marca.",
    icon: ShieldCheck,
    color: "bg-indigo-500/10 text-indigo-600",
  },
];

export function FeaturesSection() {
  return (
    <PremiumSection id="modulos" variant="soft" padding="lg" className="overflow-visible">
      <div className="flex flex-col lg:flex-row gap-16 items-start">
        <div className="lg:w-1/3 lg:sticky lg:top-32">
          <h2 className="text-accent font-bold tracking-widest uppercase text-sm mb-4">Módulos Integrados</h2>
          <h3 className="font-display text-4xl md:text-5xl text-primary-dark mb-6 tracking-tight">
            Tudo que você precisa. <br />
            Sem complicação.
          </h3>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Cada recurso foi desenhado ouvindo recepcionistas, gestores e profissionais de estética. Funcionalidade real, sem excessos inúteis.
          </p>
          <div className="space-y-4">
            {[
              "Multi-unidade pronto",
              "Backup automático",
              "Suporte especializado",
              "Treinamento incluso"
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-primary-dark font-medium">
                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                  <ArrowRight className="h-3 w-3 text-accent" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:w-2/3 grid sm:grid-cols-2 gap-4">
          {FEATURES.map((feature, index) => (
            <div 
              key={feature.title}
              className={cn(
                "p-8 rounded-[40px] bg-white border border-border/40 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10",
                index % 2 === 1 ? "sm:translate-y-8" : ""
              )}
            >
              <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center mb-8", feature.color)}>
                <feature.icon className="h-8 w-8" />
              </div>
              <h4 className="text-2xl font-display font-bold text-primary-dark mb-4">{feature.title}</h4>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </PremiumSection>
  );
}
