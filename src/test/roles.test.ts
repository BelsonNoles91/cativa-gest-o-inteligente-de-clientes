/**
 * Testes para domínio: roles e canAccess.
 * Garante que ninguém afrouxe a checagem de papel acidentalmente.
 */
import { describe, it, expect } from "vitest";
import { canAccess, hasAtLeastRole, type Role } from "@/domain/roles";

describe("domain/roles", () => {
  describe("canAccess", () => {
    it("nega acesso quando papel é null/undefined", () => {
      expect(canAccess(null, ["owner"])).toBe(false);
      expect(canAccess(undefined, ["manager"])).toBe(false);
    });

    it("permite quando o papel está na lista", () => {
      expect(canAccess("owner", ["owner", "manager"])).toBe(true);
      expect(canAccess("frontdesk", ["frontdesk"])).toBe(true);
    });

    it("nega quando o papel NÃO está na lista", () => {
      expect(canAccess("client", ["owner", "manager"])).toBe(false);
      expect(canAccess("professional", ["owner"])).toBe(false);
    });

    it("não usa hierarquia: owner não acessa rota só de manager", () => {
      // canAccess é estritamente whitelist — uso explícito.
      expect(canAccess("owner", ["manager"])).toBe(false);
    });
  });

  describe("hasAtLeastRole", () => {
    const cases: Array<[Role, Role, boolean]> = [
      ["super_admin", "owner", true],
      ["owner", "manager", true],
      ["manager", "frontdesk", true],
      ["frontdesk", "owner", false],
      ["client", "professional", false],
      ["professional", "client", true],
    ];
    it.each(cases)("hasAtLeastRole(%s, %s) === %s", (cur, req, expected) => {
      expect(hasAtLeastRole(cur, req)).toBe(expected);
    });
  });
});
