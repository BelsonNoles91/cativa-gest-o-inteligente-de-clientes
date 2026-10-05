import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
const schedulingMock = vi.hoisted(() => ({ insertAppointment: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));
vi.mock("@/repositories/scheduling", () => schedulingMock);

import {
  importAppointments,
  importClients,
  importPackages,
  importServices,
  importTeam,
} from "./importers";

type Result = { data?: unknown; error: { message: string } | null };

function makeQuery(result: Result) {
  const query: Record<string, unknown> = {};
  query.insert = vi.fn(() => query);
  for (const method of ["select", "eq"]) query[method] = vi.fn(() => query);
  query.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query as Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
  };
}

describe("importers", () => {
  beforeEach(() => vi.resetAllMocks());

  it("preserva tenant, normaliza campos de cliente e informa falhas por lote", async () => {
    const firstInsert = makeQuery({ error: null });
    const secondInsert = makeQuery({ error: { message: "lote inválido" } });
    supabaseMock.from.mockReturnValueOnce(firstInsert).mockReturnValueOnce(secondInsert);

    const result = await importClients(
      Array.from({ length: 101 }, (_, index) => ({
        fullName: ` Cliente ${index} `,
        isVip: index === 0,
      })),
      { tenantId: "tenant-synthetic", createdBy: "user-synthetic" },
    );

    expect(firstInsert.insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        tenant_id: "tenant-synthetic",
        created_by: "user-synthetic",
        full_name: "Cliente 0",
        is_vip: true,
      }),
    ]));
    expect(secondInsert.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        tenant_id: "tenant-synthetic",
        created_by: "user-synthetic",
        full_name: "Cliente 100",
        is_vip: false,
      }),
    ]);
    expect(result).toEqual({
      inserted: 100,
      failed: 1,
      errors: [{ rowIndex: 100, message: "lote inválido" }],
    });
  });

  it("insere preço em BRL e aplica tenant e serviço correspondentes", async () => {
    const serviceInsert = makeQuery({ data: [{ id: "service-1", name: "Massagem" }], error: null });
    const priceInsert = makeQuery({ error: null });
    supabaseMock.from
      .mockReturnValueOnce(serviceInsert)
      .mockReturnValueOnce(priceInsert);

    const result = await importServices(
      [{ name: " Massagem ", durationMinutes: 40, priceCents: 129.99 }],
      { tenantId: "tenant-synthetic" },
    );

    expect(serviceInsert.insert).toHaveBeenCalledWith([expect.objectContaining({
      tenant_id: "tenant-synthetic",
      name: "Massagem",
      duration_minutes: 40,
      is_active: true,
    })]);
    expect(priceInsert.insert).toHaveBeenCalledWith([{
      tenant_id: "tenant-synthetic",
      service_id: "service-1",
      currency: "BRL",
      amount_cents: 12999,
      is_default: true,
    }]);
    expect(result).toEqual({ inserted: 1, failed: 0, errors: [] });
  });

  it("não grava preço se a resposta do INSERT não confirmar o ID do serviço", async () => {
    const serviceInsert = makeQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValueOnce(serviceInsert);

    await expect(importServices(
      [{ name: "Serviço A", priceCents: 50 }],
      { tenantId: "tenant-synthetic" },
    )).resolves.toEqual({
      inserted: 1,
      failed: 1,
      errors: [{
        rowIndex: 0,
        message: "Serviço importado, mas não foi possível confirmar o ID para gravar o preço de Serviço A.",
      }],
    });
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it("registra falha ao gravar preço, preservando que o serviço foi criado", async () => {
    const priceError = { message: "preço rejeitado" };
    const priceInsert = makeQuery({ error: priceError });
    supabaseMock.from
      .mockReturnValueOnce(makeQuery({ data: [{ id: "service-2", name: "Corte" }], error: null }))
      .mockReturnValueOnce(priceInsert);

    const result = await importServices(
      [{ name: "Corte", priceCents: 75 }],
      { tenantId: "tenant-synthetic" },
    );

    expect(result).toEqual({
      inserted: 1,
      failed: 1,
      errors: [{
        rowIndex: 0,
        message: "Serviço importado, mas o preço não foi gravado: preço rejeitado",
      }],
    });
  });

  it("não faz leitura/gravação de preços quando não há valores válidos", async () => {
    const insert = makeQuery({ error: null });
    supabaseMock.from.mockReturnValueOnce(insert);

    await expect(importServices(
      [{ name: "Serviço sem preço" }, { name: "Preço inválido", priceCents: Number.NaN }],
      { tenantId: "tenant-synthetic" },
    )).resolves.toEqual({ inserted: 2, failed: 0, errors: [] });
    expect(insert.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        tenant_id: "tenant-synthetic",
        name: "Serviço sem preço",
        description: null,
        duration_minutes: 30,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
      }),
      expect.objectContaining({ name: "Preço inválido", duration_minutes: 30 }),
    ]);
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it("recusa vincular preços a serviços de nomes duplicados no mesmo lote", async () => {
    const serviceInsert = makeQuery({
      data: [
        { id: "service-1", name: "Massagem" },
        { id: "service-2", name: "Massagem" },
      ],
      error: null,
    });
    supabaseMock.from.mockReturnValueOnce(serviceInsert);

    await expect(importServices([
      { name: "Massagem", priceCents: 19.9 },
      { name: "Massagem", priceCents: 29.9 },
    ], { tenantId: "tenant-synthetic" })).resolves.toEqual({
      inserted: 2,
      failed: 2,
      errors: [
        {
          rowIndex: 0,
          message: "Serviço importado, mas há nomes repetidos no lote; o preço de Massagem não foi associado.",
        },
        {
          rowIndex: 1,
          message: "Serviço importado, mas há nomes repetidos no lote; o preço de Massagem não foi associado.",
        },
      ],
    });
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it("mantém associação por ID quando nomes iguais ficam em lotes diferentes", async () => {
    const firstServiceInsert = makeQuery({
      data: [{ id: "service-first", name: "Repetido" }],
      error: null,
    });
    const firstPriceInsert = makeQuery({ error: null });
    const secondServiceInsert = makeQuery({
      data: [{ id: "service-last", name: "Repetido" }],
      error: null,
    });
    const secondPriceInsert = makeQuery({ error: null });
    supabaseMock.from
      .mockReturnValueOnce(firstServiceInsert)
      .mockReturnValueOnce(firstPriceInsert)
      .mockReturnValueOnce(secondServiceInsert)
      .mockReturnValueOnce(secondPriceInsert);
    const rows = Array.from({ length: 101 }, (_, index) => ({
      name: index === 0 || index === 100 ? "Repetido" : `Serviço ${index}`,
      ...(index === 0 ? { priceCents: 20 } : {}),
      ...(index === 100 ? { priceCents: 30 } : {}),
    }));

    await expect(importServices(rows, { tenantId: "tenant-synthetic" })).resolves.toEqual({
      inserted: 101,
      failed: 0,
      errors: [],
    });

    expect(firstServiceInsert.insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: "Repetido" }),
    ]));
    expect(secondServiceInsert.insert).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Repetido" }),
    ]);
    expect(firstPriceInsert.insert).toHaveBeenCalledWith([expect.objectContaining({
      service_id: "service-first",
      amount_cents: 2000,
    })]);
    expect(secondPriceInsert.insert).toHaveBeenCalledWith([expect.objectContaining({
      service_id: "service-last",
      amount_cents: 3000,
    })]);
  });

  it("contabiliza falha do lote de serviços sem tentar inserir preços", async () => {
    const serviceInsert = makeQuery({ error: { message: "catálogo indisponível" } });
    supabaseMock.from.mockReturnValueOnce(serviceInsert);

    await expect(importServices([
      { name: "Serviço A", priceCents: 19.9 },
      { name: "Serviço B", priceCents: 29.9 },
    ], { tenantId: "tenant-synthetic" })).resolves.toEqual({
      inserted: 0,
      failed: 2,
      errors: [{ rowIndex: 0, message: "catálogo indisponível" }],
    });
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it("importa pacotes com defaults seguros e converte preço para centavos", async () => {
    const insert = makeQuery({ error: null });
    supabaseMock.from.mockReturnValueOnce(insert);

    const result = await importPackages(
      [{ name: " Pacote Inicial ", kind: "", priceCents: 89.9, validityDays: 30 }],
      { tenantId: "tenant-synthetic" },
    );

    expect(insert.insert).toHaveBeenCalledWith([{
      tenant_id: "tenant-synthetic",
      name: "Pacote Inicial",
      kind: "package",
      description: null,
      price_cents: 8990,
      validity_days: 30,
      recommended_interval_days: null,
      is_active: true,
    }]);
    expect(result).toEqual({ inserted: 1, failed: 0, errors: [] });
  });

  it("preserva tipo protocolo e normaliza preço/validade zero sem fabricar valores", async () => {
    const insert = makeQuery({ error: null });
    supabaseMock.from.mockReturnValueOnce(insert);

    await importPackages([
      { name: "Protocolo", kind: "protocol", priceCents: 0, validityDays: 0, recommendedIntervalDays: 0 },
    ], { tenantId: "tenant-synthetic" });

    expect(insert.insert).toHaveBeenCalledWith([expect.objectContaining({
      kind: "protocol",
      price_cents: 0,
      validity_days: null,
      recommended_interval_days: null,
    })]);
  });

  it("limita comissões de profissionais e preserva suspensão explícita", async () => {
    const insert = makeQuery({ error: null });
    supabaseMock.from.mockReturnValueOnce(insert);

    const result = await importTeam([
      { displayName: " Ana ", commissionPct: 125, isActive: false },
      { displayName: "Bia", commissionPct: -5 },
      { displayName: "Caio", commissionPct: Number.POSITIVE_INFINITY },
    ], { tenantId: "tenant-synthetic" });

    expect(insert.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        tenant_id: "tenant-synthetic",
        display_name: "Ana",
        commission_pct: 100,
        is_active: false,
      }),
      expect.objectContaining({ display_name: "Bia", commission_pct: 0, is_active: true }),
      expect.objectContaining({ display_name: "Caio", commission_pct: null, is_active: true }),
    ]);
    expect(result).toEqual({ inserted: 3, failed: 0, errors: [] });
  });

  it("normaliza referências e cria agendamento com duração, unidade e preço padrão", async () => {
    const lookupResults: Result[] = [
      { data: [{ id: "client-1", full_name: "Érica Silva" }], error: null },
      { data: [{ id: "pro-1", display_name: "Dra Ana" }], error: null },
      { data: [{ id: "service-1", name: "Limpeza", duration_minutes: 45 }], error: null },
      { data: [{ service_id: "service-1", amount_cents: 8999, is_default: true }], error: null },
      { data: [{ id: "unit-1", name: "Centro", is_active: true }], error: null },
    ];
    for (const result of lookupResults) supabaseMock.from.mockReturnValueOnce(makeQuery(result));
    schedulingMock.insertAppointment.mockResolvedValue(undefined);

    const result = await importAppointments([{
      clientName: " Erica Silva ",
      professionalName: "DRA ANA",
      serviceName: " LIMPEZA ",
      unitName: " centro ",
      startsAt: "2026-10-06T12:00:00.000Z",
    }], { tenantId: "tenant-synthetic", createdBy: "user-synthetic" });

    expect(schedulingMock.insertAppointment).toHaveBeenCalledWith({
      tenantId: "tenant-synthetic",
      unitId: "unit-1",
      clientId: "client-1",
      professionalId: "pro-1",
      serviceId: "service-1",
      startsAt: "2026-10-06T12:00:00.000Z",
      endsAt: "2026-10-06T12:45:00.000Z",
      durationMinutes: 45,
      source: "frontdesk",
      status: "pending",
      notes: null,
      totalPriceCents: 8999,
      itemPriceCents: 8999,
      createdBy: "user-synthetic",
    });
    expect(result).toEqual({ inserted: 1, failed: 0, errors: [] });
  });

  it("usa unidade padrão única, duração e preço explícitos mesmo quando zero", async () => {
    const lookupResults: Result[] = [
      { data: [{ id: "client-1", full_name: "Cliente" }], error: null },
      { data: [{ id: "pro-1", display_name: "Profissional" }], error: null },
      { data: [{ id: "service-1", name: "Serviço", duration_minutes: 30 }], error: null },
      { data: [{ service_id: "service-1", amount_cents: 4500, is_default: true }], error: null },
      { data: [{ id: "unit-default", name: "Única", is_active: true }], error: null },
    ];
    for (const result of lookupResults) supabaseMock.from.mockReturnValueOnce(makeQuery(result));
    schedulingMock.insertAppointment.mockResolvedValue(undefined);

    const result = await importAppointments([{
      clientName: "Cliente",
      professionalName: "Profissional",
      serviceName: "Serviço",
      startsAt: "2026-10-06T12:00:00.000Z",
      durationMinutes: 0,
      priceCents: 0,
      source: null,
      status: null,
    }], { tenantId: "tenant-synthetic" });

    expect(schedulingMock.insertAppointment).toHaveBeenCalledWith(expect.objectContaining({
      unitId: "unit-default",
      durationMinutes: 30,
      endsAt: "2026-10-06T12:30:00.000Z",
      totalPriceCents: 0,
      source: "frontdesk",
      status: "pending",
    }));
    expect(result).toEqual({ inserted: 1, failed: 0, errors: [] });
  });

  it("retorna erro por linha para cliente ausente e não tenta gravar agendamento", async () => {
    const lookupResults: Result[] = [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];
    for (const result of lookupResults) supabaseMock.from.mockReturnValueOnce(makeQuery(result));

    const result = await importAppointments([
      { clientName: "Ausente", professionalName: "P", serviceName: "S", startsAt: "2026-10-06T12:00:00Z" },
    ], { tenantId: "tenant-synthetic" });

    expect(result).toEqual({
      inserted: 0,
      failed: 1,
      errors: [{ rowIndex: 0, message: "Cliente não encontrado: Ausente" }],
    });
    expect(schedulingMock.insertAppointment).not.toHaveBeenCalled();
  });

  it("rejeita unidade ambígua e data inválida sem gravar linhas", async () => {
    const lookupResults: Result[] = [
      { data: [{ id: "client-1", full_name: "Cliente" }], error: null },
      { data: [{ id: "pro-1", display_name: "Profissional" }], error: null },
      { data: [{ id: "service-1", name: "Serviço", duration_minutes: 30 }], error: null },
      { data: [], error: null },
      { data: [
        { id: "unit-1", name: "Norte", is_active: true },
        { id: "unit-2", name: "Sul", is_active: true },
      ], error: null },
    ];
    for (const result of lookupResults) supabaseMock.from.mockReturnValueOnce(makeQuery(result));

    const result = await importAppointments([
      { clientName: "Cliente", professionalName: "Profissional", serviceName: "Serviço", startsAt: "2026-10-06T12:00:00Z" },
      { clientName: "Cliente", professionalName: "Profissional", serviceName: "Serviço", unitName: "Norte", startsAt: "inválida" },
    ], { tenantId: "tenant-synthetic" });

    expect(result).toEqual({
      inserted: 0,
      failed: 2,
      errors: [
        {
          rowIndex: 0,
          message: "Informe a unidade na planilha ou deixe apenas uma unidade ativa no tenant para importação guiada.",
        },
        { rowIndex: 1, message: "Data/hora inválida: inválida" },
      ],
    });
    expect(schedulingMock.insertAppointment).not.toHaveBeenCalled();
  });

  it("aborta a importação de agendamentos quando uma leitura de referência falha", async () => {
    const readError = { message: "consulta negada" };
    const lookupResults: Result[] = [
      { data: null, error: readError },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];
    for (const result of lookupResults) supabaseMock.from.mockReturnValueOnce(makeQuery(result));

    await expect(importAppointments([], { tenantId: "tenant-synthetic" })).rejects.toBe(readError);
    expect(schedulingMock.insertAppointment).not.toHaveBeenCalled();
  });

  it("propaga falha de cada leitura de referência sem iniciar importação parcial", async () => {
    for (let failedRead = 0; failedRead < 5; failedRead += 1) {
      vi.resetAllMocks();
      const readError = { message: `falha ${failedRead}` };
      for (let read = 0; read < 5; read += 1) {
        const result: Result = read === failedRead
          ? { data: null, error: readError }
          : { data: [], error: null };
        supabaseMock.from.mockReturnValueOnce(makeQuery(result));
      }

      await expect(importAppointments([], { tenantId: "tenant-synthetic" })).rejects.toBe(readError);
      expect(schedulingMock.insertAppointment).not.toHaveBeenCalled();
    }
  });

  it("escolhe a única unidade ativa, ignorando unidades inativas", async () => {
    const lookupResults: Result[] = [
      { data: [{ id: "client-1", full_name: "Cliente" }], error: null },
      { data: [{ id: "pro-1", display_name: "Profissional" }], error: null },
      { data: [{ id: "service-1", name: "Serviço", duration_minutes: 30 }], error: null },
      { data: [], error: null },
      { data: [
        { id: "unit-active", name: "Ativa", is_active: true },
        { id: "unit-inactive", name: "Inativa", is_active: false },
      ], error: null },
    ];
    for (const result of lookupResults) supabaseMock.from.mockReturnValueOnce(makeQuery(result));
    schedulingMock.insertAppointment.mockResolvedValue(undefined);

    const result = await importAppointments([{
      clientName: "Cliente",
      professionalName: "Profissional",
      serviceName: "Serviço",
      startsAt: "2026-10-06T12:00:00.000Z",
    }], { tenantId: "tenant-synthetic" });

    expect(schedulingMock.insertAppointment).toHaveBeenCalledWith(expect.objectContaining({ unitId: "unit-active" }));
    expect(result).toEqual({ inserted: 1, failed: 0, errors: [] });
  });

  it("retorna vazio quando as consultas válidas não têm dados nem linhas para importar", async () => {
    for (let read = 0; read < 5; read += 1) {
      supabaseMock.from.mockReturnValueOnce(makeQuery({ data: null, error: null }));
    }

    await expect(importAppointments([], { tenantId: "tenant-synthetic" })).resolves.toEqual({
      inserted: 0,
      failed: 0,
      errors: [],
    });
    expect(schedulingMock.insertAppointment).not.toHaveBeenCalled();
  });

  it("converte falhas da RPC de agendamento em erro isolado da linha", async () => {
    const lookupResults: Result[] = [
      { data: [{ id: "client-1", full_name: "Cliente" }], error: null },
      { data: [{ id: "pro-1", display_name: "Profissional" }], error: null },
      { data: [{ id: "service-1", name: "Serviço", duration_minutes: 30 }], error: null },
      { data: [], error: null },
      { data: [{ id: "unit-1", name: "Única", is_active: true }], error: null },
    ];
    for (const result of lookupResults) supabaseMock.from.mockReturnValueOnce(makeQuery(result));
    schedulingMock.insertAppointment.mockRejectedValue(new Error("horário ocupado"));

    const result = await importAppointments([{
      clientName: "Cliente",
      professionalName: "Profissional",
      serviceName: "Serviço",
      startsAt: "2026-10-06T12:00:00.000Z",
    }], { tenantId: "tenant-synthetic" });

    expect(result).toEqual({
      inserted: 0,
      failed: 1,
      errors: [{ rowIndex: 0, message: "horário ocupado" }],
    });
  });
});
