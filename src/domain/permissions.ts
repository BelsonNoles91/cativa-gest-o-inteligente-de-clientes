/**
 * Matriz de permissões por papel (RBAC de aplicação).
 *
 * Esta é a fonte única de verdade para habilitar/desabilitar AÇÕES na UI e
 * nos services. É uma camada de UX + consistência: a segurança real continua
 * nas RLS policies do Postgres.
 *
 * Papéis: super_admin > owner > manager > frontdesk > professional > client
 */
import type { Role } from "./roles";

export const PERMISSIONS = [
  // Agenda
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "appointments.cancel",
  "appointments.viewAll",
  "blocks.manage",
  "schedule.self",
  "schedule.approve",
  // Clientes
  "clients.view",
  "clients.create",
  "clients.edit",
  "clients.delete",
  "clients.export",
  // Catálogo e receita
  "catalog.manage",
  "packages.manage",
  // Gestão
  "analytics.view",
  "billing.manage",
  "data.import",
  "data.export",
  // Configurações
  "settings.business",
  "settings.units",
  "settings.team",
  "settings.branding",
  "settings.prefs",
  "settings.publicPage",
  "team.invite",
  "team.manageRoles",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const OWNER_PERMISSIONS: Permission[] = [...PERMISSIONS];

const MANAGER_PERMISSIONS: Permission[] = [
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "appointments.cancel",
  "appointments.viewAll",
  "blocks.manage",
  "schedule.self",
  "schedule.approve",
  "clients.view",
  "clients.create",
  "clients.edit",
  "clients.delete",
  "clients.export",
  "catalog.manage",
  "packages.manage",
  "analytics.view",
  "data.export",
  "settings.business",
  "settings.branding",
  "settings.prefs",
  "settings.team",
  "team.invite",
];

const FRONTDESK_PERMISSIONS: Permission[] = [
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "appointments.cancel",
  "appointments.viewAll",
  "clients.view",
  "clients.create",
  "clients.edit",
];

const PROFESSIONAL_PERMISSIONS: Permission[] = [
  "appointments.view",
  "appointments.edit",
  "schedule.self",
  "clients.view",
];

const CLIENT_PERMISSIONS: Permission[] = [];

export const rolePermissions: Record<Role, Permission[]> = {
  super_admin: OWNER_PERMISSIONS,
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  frontdesk: FRONTDESK_PERMISSIONS,
  professional: PROFESSIONAL_PERMISSIONS,
  client: CLIENT_PERMISSIONS,
};

/** Verifica se o papel possui a permissão informada. */
export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}

/** true se o papel possuir TODAS as permissões. */
export function hasAllPermissions(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/** true se o papel possuir ao menos UMA das permissões. */
export function hasAnyPermission(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Mensagem padrão exibida quando a ação é bloqueada por papel. */
export const PERMISSION_DENIED_MESSAGE =
  "Seu perfil de acesso não permite esta ação. Fale com o proprietário do negócio.";
