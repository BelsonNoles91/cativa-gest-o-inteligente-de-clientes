/**
 * Papéis (roles) do sistema Cativa.
 * Regras críticas devem viver aqui ou em services/, NUNCA na UI.
 *
 * Ordem hierárquica do mais alto para o mais baixo privilégio:
 *   super_admin > owner > manager > frontdesk > professional > client
 */

export const ROLES = [
  "super_admin",
  "owner",
  "manager",
  "frontdesk",
  "professional",
  "client",
] as const;

export type Role = (typeof ROLES)[number];

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  owner: "Proprietário",
  manager: "Gerente",
  frontdesk: "Recepção",
  professional: "Profissional",
  client: "Cliente",
};

const RANK: Record<Role, number> = {
  super_admin: 100,
  owner: 80,
  manager: 60,
  frontdesk: 40,
  professional: 30,
  client: 10,
};

export function hasAtLeastRole(current: Role, required: Role): boolean {
  return RANK[current] >= RANK[required];
}

export function canAccess(current: Role | null | undefined, allowed: Role[]): boolean {
  if (!current) return false;
  return allowed.includes(current);
}
