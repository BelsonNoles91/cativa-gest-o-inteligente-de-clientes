import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => {
  type QueryResult = { data: any; error: any | null };
  const results = new Map<string, QueryResult[]>();
  const queries: Array<{ table: string; query: Record<string, any> }> = [];
  const from = vi.fn((table: string) => {
    const currentResult = () => {
      const queue = results.get(table);
      if (!queue?.length) return { data: [], error: null };
      if (queue.length > 1) return queue.shift()!;
      return queue[0];
    };
    const query: Record<string, any> = {};
    for (const method of [
      "select", "eq", "order", "ilike", "insert", "update", "delete", "in",
    ]) query[method] = vi.fn(() => query);
    query.single = vi.fn(async () => currentResult());
    query.maybeSingle = vi.fn(async () => currentResult());
    query.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(currentResult()).then(resolve, reject);
    queries.push({ table, query });
    return query;
  });
  return { from, rpc: vi.fn(), results, queries };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  createCancellationPolicy,
  createCategory,
  createMembership,
  createPackage,
  createProtocol,
  createService,
  deleteCancellationPolicy,
  deleteCategory,
  deleteMembership,
  deletePackage,
  deleteProtocol,
  deleteService,
  getService,
  listBasePrices,
  listCancellationPolicies,
  listCategories,
  listMembershipBenefits,
  listMemberships,
  listPackageItems,
  listPackages,
  listProfessionalPriceOverrides,
  listProtocols,
  listProtocolSessions,
  listServices,
  listUnitPriceOverrides,
  saveProfessionalPriceOverrides,
  saveUnitPriceOverrides,
  updateCancellationPolicy,
  updateCategory,
  updateMembership,
  updatePackage,
  updateProtocol,
  updateService,
} from "../catalog";

const tenantId = "tenant-a";
const failure = { code: "503", message: "catalog database unavailable" };

function respond(table: string, data: unknown, error: unknown | null = null) {
  supabaseMock.results.set(table, [{ data, error }]);
}

function respondSequence(table: string, ...results: Array<{ data: unknown; error: unknown | null }>) {
  supabaseMock.results.set(table, results);
}

function respondRpc(data: unknown = null, error: unknown | null = null) {
  supabaseMock.rpc.mockResolvedValueOnce({ data, error });
}

function latestRpc() {
  return supabaseMock.rpc.mock.calls.at(-1);
}

function latestQuery(table: string) {
  const result = supabaseMock.queries.filter((entry) => entry.table === table).at(-1);
  if (!result) throw new Error(`No query for ${table}`);
  return result.query;
}

function queriesFor(table: string) {
  return supabaseMock.queries.filter((entry) => entry.table === table).map((entry) => entry.query);
}

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "category-1", tenant_id: tenantId, parent_id: null, name: "Facial",
    description: null, color: null, icon: null, position: null, is_active: true, ...overrides,
  };
}

function serviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "service-1", tenant_id: tenantId, category_id: null, cancellation_policy_id: null,
    name: "Limpeza de pele", description: null, internal_code: null, duration_minutes: 30,
    buffer_before_minutes: 0, buffer_after_minutes: 0, processing_minutes: 0, min_advance_hours: 0,
    max_advance_days: 60, ideal_return_window_days: null, requires_resource: false, resource_label: null,
    eligible_for_package: true, eligible_for_membership: true, pre_appointment_instructions: null,
    post_appointment_instructions: null, is_active: true, is_featured: false, position: null,
    ...overrides,
  };
}

function packageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "package-1", tenant_id: tenantId, kind: "package", name: "Pacote 5 sessões",
    description: null, price_cents: null, validity_days: null, recommended_interval_days: null,
    usage_rules: null, notes: null, is_active: true, ...overrides,
  };
}

function membershipRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "membership-1", tenant_id: tenantId, name: "Mensal", description: null,
    price_cents: null, billing_cycle: "monthly", is_active: true, notes: null, ...overrides,
  };
}

function protocolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "protocol-1", tenant_id: tenantId, name: "Protocolo facial", description: null,
    total_sessions: null, recommended_interval_days: null, total_price_cents: null,
    pre_instructions: null, post_instructions: null, is_active: true, ...overrides,
  };
}

function policyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "policy-1", tenant_id: tenantId, name: "Padrão", description: null,
    hours_before_no_charge: 24, late_cancel_fee_pct: 0, no_show_fee_pct: 0, is_default: false,
    ...overrides,
  };
}

describe("catalog repository — contract, mapping and persistence failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.results.clear();
    supabaseMock.queries.length = 0;
  });

  it("mapeia categorias, defaults e filtros do tenant", async () => {
    respond("service_categories", [categoryRow(), categoryRow({
      id: "category-2", parent_id: "category-1", description: "Descrição", color: "#123456",
      icon: "sparkles", position: 2, is_active: false,
    })]);
    await expect(listCategories(tenantId)).resolves.toEqual([
      {
        id: "category-1", tenantId, parentId: null, name: "Facial", description: null,
        color: null, icon: null, position: 0, isActive: true,
      },
      {
        id: "category-2", tenantId, parentId: "category-1", name: "Facial", description: "Descrição",
        color: "#123456", icon: "sparkles", position: 2, isActive: false,
      },
    ]);
    expect(latestQuery("service_categories").eq).toHaveBeenCalledWith("tenant_id", tenantId);
    expect(latestQuery("service_categories").order).toHaveBeenCalledWith("position");
  });

  it("cria, atualiza e exclui categorias sem descartar null, false ou zero", async () => {
    respond("service_categories", categoryRow());
    await createCategory({ tenantId, name: "Facial" });
    expect(latestQuery("service_categories").insert).toHaveBeenCalledWith({
      tenant_id: tenantId, name: "Facial", parent_id: null, color: null, icon: null,
      description: null, position: 0, is_active: true,
    });
    await updateCategory("category-1", {
      name: "Novo", parentId: null, color: null, icon: null, description: null, position: 0, isActive: false,
    });
    expect(latestQuery("service_categories").update).toHaveBeenCalledWith({
      name: "Novo", parent_id: null, color: null, icon: null, description: null, position: 0, is_active: false,
    });
    await updateCategory("category-1", {});
    expect(latestQuery("service_categories").update).toHaveBeenLastCalledWith({});
    await deleteCategory("category-1");
    expect(latestQuery("service_categories").delete).toHaveBeenCalledOnce();
    expect(latestQuery("service_categories").eq).toHaveBeenCalledWith("id", "category-1");
  });

  it("lista serviços com filtros normalizados e traduz campos opcionais", async () => {
    respond("services", [serviceRow({
      category_id: "category-1", cancellation_policy_id: "policy-1", description: "Descrição",
      internal_code: "LIMP-01", ideal_return_window_days: 45, requires_resource: true,
      resource_label: "Sala", eligible_for_package: false, eligible_for_membership: false,
      pre_appointment_instructions: "Chegar cedo", post_appointment_instructions: "Evitar sol",
      is_featured: true, position: 3,
    })]);
    await expect(listServices({ tenantId, search: "  pele  ", categoryId: "category-1", activeOnly: true }))
      .resolves.toMatchObject([{
        id: "service-1", tenantId, categoryId: "category-1", cancellationPolicyId: "policy-1",
        internalCode: "LIMP-01", idealReturnWindowDays: 45, requiresResource: true,
        eligibleForPackage: false, eligibleForMembership: false, preAppointmentInstructions: "Chegar cedo",
        postAppointmentInstructions: "Evitar sol", isFeatured: true, position: 3,
      }]);
    expect(latestQuery("services").ilike).toHaveBeenCalledWith("name", "%pele%");
    expect(latestQuery("services").eq).toHaveBeenCalledWith("category_id", "category-1");
    expect(latestQuery("services").eq).toHaveBeenCalledWith("is_active", true);
    expect(latestQuery("services").order).toHaveBeenNthCalledWith(1, "position", { ascending: true });
    expect(latestQuery("services").order).toHaveBeenNthCalledWith(2, "name", { ascending: true });
  });

  it("ignora busca vazia e retorna lista vazia quando não há serviços", async () => {
    respond("services", null);
    await expect(listServices({ tenantId, search: "   " })).resolves.toEqual([]);
    expect(latestQuery("services").ilike).not.toHaveBeenCalled();
    expect(latestQuery("services").eq).not.toHaveBeenCalledWith("category_id", expect.anything());
    expect(latestQuery("services").eq).not.toHaveBeenCalledWith("is_active", true);
  });

  it("busca serviço e diferencia ausência de erro de banco", async () => {
    respond("services", serviceRow({ position: null }));
    await expect(getService("service-1")).resolves.toMatchObject({
      id: "service-1", durationMinutes: 30, maxAdvanceDays: 60, position: 0,
      categoryId: null, cancellationPolicyId: null, isActive: true,
    });
    respond("services", null);
    await expect(getService("missing")).resolves.toBeNull();
  });

  it("cria serviço com defaults; quando informado, grava o preço base em BRL", async () => {
    respond("services", serviceRow());
    await expect(createService({ tenantId, name: "Limpeza de pele" })).resolves.toMatchObject({
      id: "service-1", durationMinutes: 30, bufferBeforeMinutes: 0, maxAdvanceDays: 60,
      eligibleForPackage: true, eligibleForMembership: true, isActive: true, isFeatured: false,
    });
    expect(latestQuery("services").insert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: tenantId, category_id: null, cancellation_policy_id: null, duration_minutes: 30,
      max_advance_days: 60, is_active: true, eligible_for_package: true, eligible_for_membership: true,
    }));
    expect(supabaseMock.queries.some(({ table }) => table === "service_prices")).toBe(false);

    respondRpc(serviceRow());
    await createService({ tenantId, name: "Limpeza", basePriceCents: 12500 });
    expect(latestRpc()).toEqual(["catalog_create_service_with_price", {
      _service: expect.objectContaining({ tenant_id: tenantId, name: "Limpeza" }),
      _amount_cents: 12500,
      _currency: "BRL",
    }]);
    expect(queriesFor("service_prices")).toHaveLength(0);
  });

  it("grava serviço configurado com todos os campos de negócio", async () => {
    respondRpc(serviceRow({
      category_id: "category-1", cancellation_policy_id: "policy-1", duration_minutes: 60,
      buffer_before_minutes: 5, buffer_after_minutes: 10, processing_minutes: 15, min_advance_hours: 2,
      max_advance_days: 90, ideal_return_window_days: 30, requires_resource: true, resource_label: "Cabine",
      eligible_for_package: false, eligible_for_membership: false, pre_appointment_instructions: "Antes",
      post_appointment_instructions: "Depois", is_active: false, is_featured: true,
    }));
    await createService({
      tenantId, name: "Procedimento", description: "Descrição", categoryId: "category-1", durationMinutes: 60,
      bufferBeforeMinutes: 5, bufferAfterMinutes: 10, processingMinutes: 15, minAdvanceHours: 2,
      maxAdvanceDays: 90, idealReturnWindowDays: 30, requiresResource: true, resourceLabel: "Cabine",
      eligibleForPackage: false, eligibleForMembership: false, preAppointmentInstructions: "Antes",
      postAppointmentInstructions: "Depois", cancellationPolicyId: "policy-1", isActive: false,
      isFeatured: true, internalCode: "PROC-1", basePriceCents: 5000, currency: "BRL",
    });
    expect(latestRpc()).toEqual(["catalog_create_service_with_price", expect.objectContaining({
      _service: expect.objectContaining({
      description: "Descrição", category_id: "category-1", buffer_before_minutes: 5,
      buffer_after_minutes: 10, processing_minutes: 15, min_advance_hours: 2, max_advance_days: 90,
      ideal_return_window_days: 30, requires_resource: true, resource_label: "Cabine",
      eligible_for_package: false, eligible_for_membership: false, pre_appointment_instructions: "Antes",
      post_appointment_instructions: "Depois", cancellation_policy_id: "policy-1", is_active: false,
      is_featured: true, internal_code: "PROC-1",
      }),
      _amount_cents: 5000,
      _currency: "BRL",
    })]);
  });

  it("atualiza serviço sem preço e suporta null/false em qualquer campo", async () => {
    respond("services", serviceRow());
    await updateService("service-1", {
      name: "Atualizado", description: "Descrição", categoryId: null, durationMinutes: 0,
      bufferBeforeMinutes: 0, bufferAfterMinutes: 0, processingMinutes: 0, minAdvanceHours: 0,
      maxAdvanceDays: 0, idealReturnWindowDays: null, requiresResource: false, resourceLabel: null,
      eligibleForPackage: false, eligibleForMembership: false, preAppointmentInstructions: null,
      postAppointmentInstructions: null, cancellationPolicyId: null, isActive: false, isFeatured: false,
      internalCode: null,
    });
    expect(latestQuery("services").update).toHaveBeenCalledWith({
      name: "Atualizado", description: "Descrição", category_id: null, duration_minutes: 0,
      buffer_before_minutes: 0, buffer_after_minutes: 0, processing_minutes: 0, min_advance_hours: 0,
      max_advance_days: 0, ideal_return_window_days: null, requires_resource: false, resource_label: null,
      eligible_for_package: false, eligible_for_membership: false, pre_appointment_instructions: null,
      post_appointment_instructions: null, cancellation_policy_id: null, is_active: false, is_featured: false,
      internal_code: null,
    });
    expect(queriesFor("service_prices")).toHaveLength(0);
  });

  it("atualiza serviço e preço-base em uma única operação transacional", async () => {
    respondRpc(serviceRow({ name: "Atualizado" }));
    await updateService("service-1", { basePriceCents: 9000 });
    expect(latestRpc()).toEqual(["catalog_update_service_with_price", {
      _service_id: "service-1", _patch: {}, _amount_cents: 9000, _currency: null,
    }]);
    expect(queriesFor("service_prices")).toHaveLength(0);

    respondRpc(serviceRow());
    await updateService("service-1", { basePriceCents: 9500, currency: "USD" });
    expect(latestRpc()).toEqual(["catalog_update_service_with_price", {
      _service_id: "service-1", _patch: {}, _amount_cents: 9500, _currency: "USD",
    }]);
  });

  it("exclui serviço com escopo pelo identificador", async () => {
    await deleteService("service-1");
    expect(latestQuery("services").delete).toHaveBeenCalledOnce();
    expect(latestQuery("services").eq).toHaveBeenCalledWith("id", "service-1");
  });

  it("agrega preços-base em mapa por serviço e traduz overrides unitários e profissionais", async () => {
    respond("service_prices", [
      { id: "price-1", service_id: "service-1", currency: "BRL", amount_cents: 1000, is_default: true },
      { id: "price-2", service_id: "service-2", currency: "USD", amount_cents: 2000, is_default: true },
    ]);
    const prices = await listBasePrices(tenantId);
    expect(prices.get("service-1")).toEqual({
      id: "price-1", serviceId: "service-1", currency: "BRL", amountCents: 1000, isDefault: true,
    });
    expect(prices.get("service-2")?.currency).toBe("USD");

    respond("service_unit_prices", [{
      id: "unit-price-1", service_id: "service-1", unit_id: "unit-a", amount_cents: 2500, duration_minutes: null,
    }]);
    await expect(listUnitPriceOverrides("service-1")).resolves.toEqual([{
      id: "unit-price-1", serviceId: "service-1", unitId: "unit-a", amountCents: 2500, durationMinutes: null,
    }]);
    respond("service_professional_prices", [{
      id: "pro-price-1", service_id: "service-1", professional_id: "professional-a",
      amount_cents: 3000, duration_minutes: 60,
    }]);
    await expect(listProfessionalPriceOverrides("service-1")).resolves.toEqual([{
      id: "pro-price-1", serviceId: "service-1", professionalId: "professional-a",
      amountCents: 3000, durationMinutes: 60,
    }]);
  });

  it("substitui overrides de preço por operação atômica e propaga falhas", async () => {
    respondRpc();
    await saveUnitPriceOverrides({ tenantId, serviceId: "service-1", overrides: [
      { unitId: "unit-a", amountCents: 3200 }, { unitId: "unit-b", amountCents: 4000, durationMinutes: 45 },
    ] });
    expect(latestRpc()).toEqual(["catalog_replace_service_unit_prices", {
      _tenant_id: tenantId, _service_id: "service-1", _overrides: [
        { unit_id: "unit-a", amount_cents: 3200, duration_minutes: null },
        { unit_id: "unit-b", amount_cents: 4000, duration_minutes: 45 },
      ],
    }]);
    respondRpc();
    await saveUnitPriceOverrides({ tenantId, serviceId: "service-1", overrides: [] });
    expect(latestRpc()).toEqual(["catalog_replace_service_unit_prices", {
      _tenant_id: tenantId, _service_id: "service-1", _overrides: [],
    }]);
    respondRpc(null, failure);
    await expect(saveUnitPriceOverrides({
      tenantId, serviceId: "service-1", overrides: [{ unitId: "unit-a", amountCents: 3200 }],
    })).rejects.toBe(failure);

    respondRpc();
    await saveProfessionalPriceOverrides({ tenantId, serviceId: "service-1", overrides: [
      { professionalId: "professional-a", amountCents: 2800 },
    ] });
    expect(latestRpc()).toEqual(["catalog_replace_service_professional_prices", {
      _tenant_id: tenantId, _service_id: "service-1", _overrides: [{
        professional_id: "professional-a", amount_cents: 2800, duration_minutes: null,
      }],
    }]);
    respondRpc(null, failure);
    await expect(saveProfessionalPriceOverrides({
      tenantId, serviceId: "service-1", overrides: [{ professionalId: "professional-a", amountCents: 2800 }],
    })).rejects.toBe(failure);
  });

  it("lista, cria, atualiza e exclui pacotes com itens ordenados", async () => {
    respond("packages", [packageRow()]);
    await expect(listPackages(tenantId)).resolves.toMatchObject([{
      id: "package-1", kind: "package", priceCents: 0, validityDays: null, isActive: true,
    }]);
    respondRpc(packageRow({ price_cents: 12000, validity_days: 90 }));
    await expect(createPackage({ tenantId, name: "Pacote", items: [
      { serviceId: "service-1", sessions: 5 }, { serviceId: "service-2", sessions: 2 },
    ] })).resolves.toMatchObject({ id: "package-1", priceCents: 12000 });
    expect(latestRpc()).toEqual(["catalog_save_package_bundle", {
      _id: null, _tenant_id: tenantId,
      _values: expect.objectContaining({ kind: "package", name: "Pacote", price_cents: 0 }),
      _items: [{ service_id: "service-1", sessions: 5 }, { service_id: "service-2", sessions: 2 }],
    }]);
    expect(queriesFor("package_items")).toHaveLength(0);
    respondRpc();
    await updatePackage("package-1", {
      tenantId, name: "Novo", kind: "combo", description: null, priceCents: 0,
      validityDays: null, recommendedIntervalDays: 30, usageRules: null, notes: null, isActive: false,
      items: [{ serviceId: "service-2", sessions: 3 }],
    });
    expect(latestRpc()).toEqual(["catalog_save_package_bundle", expect.objectContaining({
      _id: "package-1", _tenant_id: tenantId,
      _values: expect.objectContaining({ name: "Novo", kind: "combo", price_cents: 0, is_active: false }),
      _items: [{ service_id: "service-2", sessions: 3 }],
    })]);
    expect(queriesFor("package_items")).toHaveLength(0);
    respond("package_items", [{
      id: "item-1", package_id: "package-1", service_id: "service-1", sessions: 5, position: 0,
    }]);
    await expect(listPackageItems("package-1")).resolves.toMatchObject([
      { id: "item-1", packageId: "package-1", sessions: 5, position: 0 },
    ]);
    await updatePackage("package-1", {});
    await deletePackage("package-1");
    expect(latestQuery("packages").delete).toHaveBeenCalledOnce();
  });

  it("não relata sucesso ao substituir filhos de catálogo sem o tenant obrigatório", async () => {
    await expect(updatePackage("package-1", { name: "Não gravar", items: [] })).rejects.toThrow("tenantId é obrigatório");
    await expect(updateMembership("membership-1", { name: "Não gravar", benefits: [] })).rejects.toThrow("tenantId é obrigatório");
    await expect(updateProtocol("protocol-1", { name: "Não gravar", steps: [] })).rejects.toThrow("tenantId é obrigatório");
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it("atualiza metadados sem filhos e propaga erros nas tabelas de pacote, membership e protocolo", async () => {
    await updatePackage("package-1", { name: "Cabeçalho do pacote" });
    expect(latestQuery("packages").update).toHaveBeenCalledWith({ name: "Cabeçalho do pacote" });
    respond("packages", null, failure);
    await expect(updatePackage("package-2", { notes: "Falha esperada" })).rejects.toBe(failure);

    await updateMembership("membership-1", { name: "Cabeçalho da assinatura" });
    expect(latestQuery("memberships").update).toHaveBeenCalledWith({ name: "Cabeçalho da assinatura" });
    respond("memberships", null, failure);
    await expect(updateMembership("membership-2", { notes: "Falha esperada" })).rejects.toBe(failure);

    await updateProtocol("protocol-1", { name: "Cabeçalho do protocolo" });
    expect(latestQuery("protocols").update).toHaveBeenCalledWith({ name: "Cabeçalho do protocolo" });
    respond("protocols", null, failure);
    await expect(updateProtocol("protocol-2", { description: "Falha esperada" })).rejects.toBe(failure);
  });

  it("lista e altera benefícios de memberships, incluindo defaults e descontos zero", async () => {
    respond("memberships", [membershipRow()]);
    await expect(listMemberships(tenantId)).resolves.toMatchObject([{
      id: "membership-1", priceCents: 0, billingCycle: "monthly", isActive: true,
    }]);
    respondRpc(membershipRow({ price_cents: 9900, notes: "benefícios" }));
    await expect(createMembership({ tenantId, name: "Mensal", benefits: [
      { serviceId: "service-1", sessionsPerCycle: 2 },
    ] })).resolves.toMatchObject({ id: "membership-1", priceCents: 9900 });
    expect(latestRpc()).toEqual(["catalog_save_membership_bundle", {
      _id: null, _tenant_id: tenantId,
      _values: expect.objectContaining({ name: "Mensal", billing_cycle: "monthly", price_cents: 0 }),
      _benefits: [{ service_id: "service-1", sessions_per_cycle: 2, discount_pct: 0 }],
    }]);
    respond("membership_benefits", [{
      id: "benefit-1", membership_id: "membership-1", service_id: "service-1",
      sessions_per_cycle: 2, discount_pct: 10,
    }]);
    await expect(listMembershipBenefits("membership-1")).resolves.toMatchObject([
      { id: "benefit-1", sessionsPerCycle: 2, discountPct: 10 },
    ]);
    respondRpc();
    await updateMembership("membership-1", {
      tenantId, name: "Novo", description: null, priceCents: 0, billingCycle: "yearly", isActive: false,
      notes: null, benefits: [{ serviceId: "service-2", sessionsPerCycle: 1, discountPct: 20 }],
    });
    expect(latestRpc()).toEqual(["catalog_save_membership_bundle", expect.objectContaining({
      _id: "membership-1", _tenant_id: tenantId,
      _values: expect.objectContaining({ name: "Novo", billing_cycle: "yearly", price_cents: 0 }),
      _benefits: [{ service_id: "service-2", sessions_per_cycle: 1, discount_pct: 20 }],
    })]);
    await updateMembership("membership-1", {});
    await deleteMembership("membership-1");
    expect(latestQuery("memberships").delete).toHaveBeenCalledOnce();
  });

  it("lista, cria, atualiza e exclui protocolos e etapas com numeração determinística", async () => {
    respond("protocols", [protocolRow()]);
    await expect(listProtocols(tenantId)).resolves.toMatchObject([{
      id: "protocol-1", totalSessions: 1, totalPriceCents: null, isActive: true,
    }]);
    respondRpc(protocolRow({ total_sessions: 2, total_price_cents: 15000 }));
    await expect(createProtocol({ tenantId, name: "Protocolo", steps: [
      { serviceId: "service-1", intervalDays: 7 }, { serviceId: "service-2", notes: "Etapa 2" },
    ] })).resolves.toMatchObject({ id: "protocol-1", totalSessions: 2 });
    expect(latestRpc()).toEqual(["catalog_save_protocol_bundle", {
      _id: null, _tenant_id: tenantId,
      _values: expect.objectContaining({ name: "Protocolo", total_sessions: 2, is_active: true }),
      _steps: [
        { service_id: "service-1", interval_days: 7, notes: null },
        { service_id: "service-2", interval_days: null, notes: "Etapa 2" },
      ],
    }]);
    respond("protocol_sessions", [{
      id: "step-1", protocol_id: "protocol-1", service_id: "service-1", step: 1,
      interval_days: 7, notes: null,
    }]);
    await expect(listProtocolSessions("protocol-1")).resolves.toMatchObject([
      { id: "step-1", step: 1, intervalDays: 7 },
    ]);
    respondRpc();
    await updateProtocol("protocol-1", {
      tenantId, name: "Atualizado", description: null, totalSessions: 3,
      recommendedIntervalDays: null, totalPriceCents: 0, preInstructions: null, postInstructions: "Depois",
      isActive: false, steps: [{ serviceId: "service-3" }],
    });
    expect(latestRpc()).toEqual(["catalog_save_protocol_bundle", expect.objectContaining({
      _id: "protocol-1", _tenant_id: tenantId,
      _values: expect.objectContaining({ name: "Atualizado", total_sessions: 3, is_active: false }),
      _steps: [{ service_id: "service-3", interval_days: null, notes: null }],
    })]);
    await updateProtocol("protocol-1", {});
    await deleteProtocol("protocol-1");
    expect(latestQuery("protocols").delete).toHaveBeenCalledOnce();
  });

  it("cria, mapeia, atualiza e exclui políticas de cancelamento", async () => {
    respond("cancellation_policies", [policyRow()]);
    await expect(listCancellationPolicies(tenantId)).resolves.toMatchObject([{
      id: "policy-1", hoursBeforeNoCharge: 24, lateCancelFeePct: 0, noShowFeePct: 0,
    }]);
    respond("cancellation_policies", policyRow());
    await expect(createCancellationPolicy({ tenantId, name: "Padrão" })).resolves.toMatchObject({
      id: "policy-1", isDefault: false,
    });
    expect(latestQuery("cancellation_policies").insert).toHaveBeenCalledWith({
      tenant_id: tenantId, name: "Padrão", description: null, hours_before_no_charge: 24,
      late_cancel_fee_pct: 0, no_show_fee_pct: 0, is_default: false,
    });
    await updateCancellationPolicy("policy-1", {
      name: "Nova", description: null, hoursBeforeNoCharge: 0, lateCancelFeePct: 50,
      noShowFeePct: 100, isDefault: true,
    });
    expect(latestQuery("cancellation_policies").update).toHaveBeenCalledWith({
      name: "Nova", description: null, hours_before_no_charge: 0, late_cancel_fee_pct: 50,
      no_show_fee_pct: 100, is_default: true,
    });
    await deleteCancellationPolicy("policy-1");
    expect(latestQuery("cancellation_policies").delete).toHaveBeenCalledOnce();
  });

  it("propaga erros de leitura e exclusão de serviços/categorias sem converter falha em vazio", async () => {
    respond("services", null, failure);
    await expect(listServices({ tenantId })).rejects.toBe(failure);
    await expect(getService("service-1")).rejects.toBe(failure);
    await expect(deleteService("service-1")).rejects.toBe(failure);
    respond("service_categories", null, failure);
    await expect(listCategories(tenantId)).rejects.toBe(failure);
    await expect(createCategory({ tenantId, name: "x" })).rejects.toBe(failure);
    await expect(updateCategory("category-1", { name: "x" })).rejects.toBe(failure);
    await expect(deleteCategory("category-1")).rejects.toBe(failure);
  });

  it("propaga falha das RPCs atômicas sem tentar compensação em chamadas separadas", async () => {
    respondRpc(null, failure);
    await expect(createService({ tenantId, name: "Sem serviço órfão", basePriceCents: 1000 })).rejects.toBe(failure);
    expect(queriesFor("services")).toHaveLength(0);
    expect(queriesFor("service_prices")).toHaveLength(0);

    respondRpc(null, failure);
    await expect(updateService("service-1", { basePriceCents: 2000 })).rejects.toBe(failure);
    expect(queriesFor("service_prices")).toHaveLength(0);

    respondRpc(null, failure);
    await expect(createPackage({ tenantId, name: "Sem pacote órfão", items: [
      { serviceId: "service-1", sessions: 1 },
    ] })).rejects.toBe(failure);
    expect(queriesFor("package_items")).toHaveLength(0);
  });

  it("falha de forma explícita quando uma RPC de catálogo retorna JSON fora do contrato", async () => {
    respondRpc(null);
    await expect(createService({ tenantId, name: "Resposta ausente", basePriceCents: 1000 }))
      .rejects.toThrow("criação do serviço e preço-base não retornou o registro esperado");

    respondRpc([]);
    await expect(createPackage({ tenantId, name: "Array inesperado" }))
      .rejects.toThrow("criação do pacote e itens não retornou o registro esperado");

    respondRpc("unexpected primitive");
    await expect(createMembership({ tenantId, name: "Primitivo inesperado" }))
      .rejects.toThrow("criação da assinatura e benefícios não retornou o registro esperado");
  });
});
