import {
  CalendarDays,
  Users,
  Sparkles,
  PackageOpen,
  CheckCircle2,
  Hourglass,
  BarChart3,
  Smartphone,
} from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const Agenda = () => (
  <PlaceholderPage
    title="Agenda"
    description="Visão diária, semanal e por profissional. Drag & drop, bloqueios e overbooking inteligentes."
    icon={<CalendarDays className="h-5 w-5" />}
  />
);

export const Clients = () => (
  <PlaceholderPage
    title="Clientes"
    description="CRM com histórico, preferências, anotações e gatilhos de retorno."
    icon={<Users className="h-5 w-5" />}
  />
);

export const Services = () => (
  <PlaceholderPage
    title="Serviços"
    description="Catálogo completo: duração, preço, profissionais habilitados e regras."
    icon={<Sparkles className="h-5 w-5" />}
  />
);

export const Packages = () => (
  <PlaceholderPage
    title="Pacotes & Protocolos"
    description="Crie pacotes, protocolos clínicos, memberships e venda recorrente."
    icon={<PackageOpen className="h-5 w-5" />}
  />
);

export const Confirmations = () => (
  <PlaceholderPage
    title="Central de confirmações"
    description="Confirme horários em poucos cliques. Mensagens prontas e abertura manual no WhatsApp."
    icon={<CheckCircle2 className="h-5 w-5" />}
  />
);

export const Waitlist = () => (
  <PlaceholderPage
    title="Lista de espera"
    description="Encaixe clientes em horários liberados e aumente sua taxa de ocupação."
    icon={<Hourglass className="h-5 w-5" />}
  />
);

export const Analytics = () => (
  <PlaceholderPage
    title="Analytics"
    description="Retenção, recorrência, ocupação e desempenho por profissional."
    icon={<BarChart3 className="h-5 w-5" />}
  />
);

export const ClientPortal = () => (
  <PlaceholderPage
    title="Portal do cliente"
    description="Onde seu cliente acompanha agendamentos, pacotes e histórico."
    icon={<Smartphone className="h-5 w-5" />}
  />
);

