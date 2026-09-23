import { describe, expect, it } from "vitest";
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  rolePermissions,
} from "../permissions";

describe("permissions matrix", () => {
  it("owner e super_admin têm todas as permissões", () => {
    expect(rolePermissions.owner).toEqual(rolePermissions.super_admin);
    expect(hasPermission("owner", "billing.manage")).toBe(true);
    expect(hasPermission("super_admin", "team.manageRoles")).toBe(true);
  });

  it("gestor não gerencia cobrança, papéis nem importação de dados", () => {
    expect(hasPermission("manager", "billing.manage")).toBe(false);
    expect(hasPermission("manager", "team.manageRoles")).toBe(false);
    expect(hasPermission("manager", "data.import")).toBe(false);
    expect(hasPermission("manager", "catalog.manage")).toBe(true);
  });

  it("recepção opera agenda e clientes, sem excluir nem exportar", () => {
    expect(hasAllPermissions("frontdesk", ["appointments.create", "clients.create"])).toBe(true);
    expect(hasPermission("frontdesk", "clients.delete")).toBe(false);
    expect(hasPermission("frontdesk", "clients.export")).toBe(false);
    expect(hasPermission("frontdesk", "blocks.manage")).toBe(false);
    expect(hasPermission("frontdesk", "analytics.view")).toBe(false);
  });

  it("profissional apenas visualiza clientes e edita atendimentos", () => {
    expect(hasPermission("professional", "appointments.edit")).toBe(true);
    expect(hasPermission("professional", "appointments.create")).toBe(false);
    expect(hasPermission("professional", "appointments.viewAll")).toBe(false);
    expect(hasPermission("professional", "clients.view")).toBe(true);
    expect(hasPermission("professional", "clients.edit")).toBe(false);
  });

  it("cliente não tem permissões administrativas", () => {
    expect(hasAnyPermission("client", ["appointments.create", "clients.view"])).toBe(false);
  });

  it("papel ausente nunca tem permissão", () => {
    expect(hasPermission(null, "appointments.view")).toBe(false);
    expect(hasPermission(undefined, "clients.view")).toBe(false);
  });
});
