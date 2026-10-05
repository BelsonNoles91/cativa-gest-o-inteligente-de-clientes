import { beforeEach, describe, expect, it } from "vitest";
import {
  readOfflineTenantContext,
  saveOfflineTenantContext,
  type OfflineTenantContext,
} from "./offline-tenant-context";

const context: OfflineTenantContext = {
  userId: "user-1",
  savedAt: new Date().toISOString(),
  tenant: {
    id: "tenant-1",
    name: "Studio QA",
    slug: "studio-qa",
    segment: "salao",
  },
  role: "owner",
  units: [{ id: "unit-1", tenant_id: "tenant-1", name: "Unidade QA", is_default: true }],
  currentUnitId: "unit-1",
};

describe("offline tenant context", () => {
  beforeEach(() => localStorage.clear());

  it("restaura somente o contexto recente do mesmo usuário", () => {
    saveOfflineTenantContext(context);

    expect(readOfflineTenantContext("user-1")).toEqual(context);
    expect(readOfflineTenantContext("user-2")).toBeNull();
  });

  it("recusa contexto expirado ou com unidade de outro tenant", () => {
    saveOfflineTenantContext({
      ...context,
      savedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    expect(readOfflineTenantContext("user-1")).toBeNull();

    saveOfflineTenantContext({
      ...context,
      units: [{ ...context.units[0], tenant_id: "tenant-2" }],
    });
    expect(readOfflineTenantContext("user-1")).toBeNull();
  });

  it("nunca restaura papéis de super-admin ou cliente", () => {
    saveOfflineTenantContext({ ...context, role: "super_admin" as OfflineTenantContext["role"] });
    expect(readOfflineTenantContext("user-1")).toBeNull();

    saveOfflineTenantContext({ ...context, role: "client" as OfflineTenantContext["role"] });
    expect(readOfflineTenantContext("user-1")).toBeNull();
  });

  it("ignora conteúdo malformado e unidade selecionada inexistente", () => {
    localStorage.setItem("cativa:offline-tenant-context:user-1", "not-json");
    expect(readOfflineTenantContext("user-1")).toBeNull();

    saveOfflineTenantContext({ ...context, currentUnitId: "unit-unknown" });
    expect(readOfflineTenantContext("user-1")).toBeNull();
  });
});
