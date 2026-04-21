/**
 * Navegação principal do produto.
 * Cada item declara: rota, rótulo (pt-BR), ícone, papéis permitidos
 * e se aparece no bottom nav mobile.
 *
 * Mantenha esta lista como fonte única de verdade para sidebar e
 * bottom navigation.
 */
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Sparkles,
  PackageOpen,
  CheckCircle2,
  Hourglass,
  BarChart3,
  Settings,
  ShieldCheck,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/domain/roles";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  showInBottomNav?: boolean;
  group: "operacao" | "gestao" | "sistema";
}

export const navItems: NavItem[] = [
  {
    to: "/app",
    label: "Painel",
    icon: LayoutDashboard,
    roles: ["owner", "manager", "frontdesk", "professional"],
    showInBottomNav: true,
    group: "operacao",
  },
  {
    to: "/app/agenda",
    label: "Agenda",
    icon: CalendarDays,
    roles: ["owner", "manager", "frontdesk", "professional"],
    showInBottomNav: true,
    group: "operacao",
  },
  {
    to: "/app/clientes",
    label: "Clientes",
    icon: Users,
    roles: ["owner", "manager", "frontdesk"],
    showInBottomNav: true,
    group: "operacao",
  },
  {
    to: "/app/confirmacoes",
    label: "Confirmações",
    icon: CheckCircle2,
    roles: ["owner", "manager", "frontdesk"],
    showInBottomNav: true,
    group: "operacao",
  },
  {
    to: "/app/lista-de-espera",
    label: "Lista de espera",
    icon: Hourglass,
    roles: ["owner", "manager", "frontdesk"],
    group: "operacao",
  },
  {
    to: "/app/servicos",
    label: "Serviços",
    icon: Sparkles,
    roles: ["owner", "manager"],
    group: "gestao",
  },
  {
    to: "/app/pacotes",
    label: "Pacotes & Protocolos",
    icon: PackageOpen,
    roles: ["owner", "manager"],
    group: "gestao",
  },
  {
    to: "/app/analytics",
    label: "Analytics",
    icon: BarChart3,
    roles: ["owner", "manager"],
    group: "gestao",
  },
  {
    to: "/app/meu-plano",
    label: "Meu plano",
    icon: CreditCard,
    roles: ["owner", "manager"],
    group: "sistema",
  },
  {
    to: "/app/configuracoes",
    label: "Configurações",
    icon: Settings,
    roles: ["owner", "manager"],
    group: "sistema",
  },
  {
    to: "/app/super-admin",
    label: "Super Admin",
    icon: ShieldCheck,
    roles: ["super_admin"],
    group: "sistema",
  },
];
