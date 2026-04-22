/**
 * useAnalytics — orquestra filtros + carregamento + cálculo de métricas.
 *
 * Mantém um único ponto de verdade para o módulo Analytics. As métricas em si
 * vivem em `@/domain/analytics` (funções puras), o que torna fácil testar.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  averageTicket,
  applyFilters,
  attendanceRate,
  avgHoursToConfirm,
  brandLoyalty,
  cancellationRate,
  cativaIndex,
  confirmationRate,
  crmCompleteness,
  futureBookedValue,
  futureRevenueAtRisk,
  idealWindowAdherence,
  newVsReturning,
  nextBestActions,
  noShowRate,
  noShowRecoveryRate,
  occupancyRate,
  professionalLoyalty,
  rangeFromPreset,
  reactivationRate,
  rebookingRate,
  retentionRate,
  sourceBreakdown,
  ticketByGroup,
  visitConversion,
  waitlistConversionRate,
  packageCompletionRate,
  type AnalyticsFilters,
  type AnalyticsPreset,
  type ApptFact,
  type ClientFact,
} from "@/domain/analytics";
import {
  fetchAppointments,
  fetchAvailability,
  fetchClients,
  fetchClientPackages,
  fetchFutureAppointments,
  fetchLabels,
  fetchWaitlistMetrics,
} from "@/repositories/analytics";

const DEFAULT_PRESET: AnalyticsPreset = "last_30d";
const RETENTION_WINDOW_DAYS = 60;
const CONVERSION_WINDOW_DAYS = 60;
const REBOOKING_WINDOW_DAYS = 60;
const NOSHOW_RECOVERY_WINDOW_DAYS = 30;
const IDEAL_WINDOW = { min: 21, max: 45 };
const HIGH_VALUE_CENTS = 30000; // R$ 300

export function useAnalytics() {
  const { currentTenant } = useTenant();

  // ----- filters -----
  const [preset, setPreset] = useState<AnalyticsPreset>(DEFAULT_PRESET);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [source, setSource] = useState<AnalyticsFilters["source"]>(null);

  // ----- raw -----
  const [appts, setAppts] = useState<ApptFact[]>([]);
  const [futureAppts, setFutureAppts] = useState<ApptFact[]>([]);
  const [clients, setClients] = useState<ClientFact[]>([]);
  const [availableMinutes, setAvailableMinutes] = useState(0);
  const [packages, setPackages] = useState<Array<{ used: number; total: number; clientId: string; expiresAt: string | null }>>([]);
  const [waitlist, setWaitlist] = useState({ totalOpen: 0, worked: 0, scheduled: 0 });
  const [labels, setLabels] = useState<{ units: Map<string, string>; pros: Map<string, string>; services: Map<string, string> } | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => rangeFromPreset(preset), [preset]);

  const filters: AnalyticsFilters = useMemo(
    () => ({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      unitId,
      professionalId,
      serviceId,
      source,
    }),
    [range, unitId, professionalId, serviceId, source],
  );

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const [appts, future, clients, av, packs, wl, lbls] = await Promise.all([
        fetchAppointments({ tenantId: currentTenant.id, start: filters.start, end: filters.end }),
        fetchFutureAppointments(currentTenant.id),
        fetchClients(currentTenant.id),
        fetchAvailability({
          tenantId: currentTenant.id,
          start: filters.start,
          end: filters.end,
          unitId: filters.unitId,
          professionalId: filters.professionalId,
        }),
        fetchClientPackages(currentTenant.id),
        fetchWaitlistMetrics({ tenantId: currentTenant.id, start: filters.start, end: filters.end }),
        fetchLabels(currentTenant.id),
      ]);
      setAppts(appts);
      setFutureAppts(future);
      setClients(clients);
      setAvailableMinutes(av.availableMinutes);
      setPackages(packs);
      setWaitlist(wl);
      setLabels(lbls);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, filters.start, filters.end, filters.unitId, filters.professionalId]);

  useEffect(() => {
    void load();
  }, [load]);

  // -------------------- COMPUTED --------------------
  const filteredAppts = useMemo(() => applyFilters(appts, filters), [appts, filters]);
  const filteredFuture = useMemo(() => applyFilters(futureAppts, filters), [futureAppts, filters]);

  // métricas operacionais
  const attendance = useMemo(() => attendanceRate(filteredAppts), [filteredAppts]);
  const noShow = useMemo(() => noShowRate(filteredAppts), [filteredAppts]);
  const cancellation = useMemo(() => cancellationRate(filteredAppts), [filteredAppts]);
  const confirmation = useMemo(() => confirmationRate(filteredAppts), [filteredAppts]);
  const bookedMinutes = useMemo(
    () =>
      filteredAppts
        .filter((a) => a.status !== "canceled" && a.status !== "no_show")
        .reduce((acc, a) => acc + a.durationMinutes, 0),
    [filteredAppts],
  );
  const occupancy = useMemo(
    () => occupancyRate({ availableMinutes, bookedMinutes, completedMinutes: 0 }),
    [availableMinutes, bookedMinutes],
  );

  const ticketAvg = useMemo(() => averageTicket(filteredAppts), [filteredAppts]);
  const ticketByService = useMemo(
    () =>
      ticketByGroup(
        filteredAppts,
        (r) => r.serviceId ?? "unknown",
        (k) => (k === "unknown" ? "Sem serviço" : labels?.services.get(k) ?? "Serviço"),
      ),
    [filteredAppts, labels],
  );
  const ticketByPro = useMemo(
    () =>
      ticketByGroup(
        filteredAppts,
        (r) => r.professionalId,
        (k) => labels?.pros.get(k) ?? "—",
      ),
    [filteredAppts, labels],
  );
  const ticketByUnit = useMemo(
    () =>
      ticketByGroup(
        filteredAppts,
        (r) => r.unitId,
        (k) => labels?.units.get(k) ?? "—",
      ),
    [filteredAppts, labels],
  );

  const futureValue = useMemo(() => futureBookedValue(filteredFuture), [filteredFuture]);
  const futureRisk = useMemo(() => futureRevenueAtRisk(filteredFuture), [filteredFuture]);

  const retention = useMemo(
    () => retentionRate(clients, appts, RETENTION_WINDOW_DAYS, range),
    [clients, appts, range],
  );
  const conv1to2 = useMemo(
    () => visitConversion(appts, 1, CONVERSION_WINDOW_DAYS, range),
    [appts, range],
  );
  const conv2to3 = useMemo(
    () => visitConversion(appts, 2, CONVERSION_WINDOW_DAYS, range),
    [appts, range],
  );
  const rebook = useMemo(() => rebookingRate(appts, REBOOKING_WINDOW_DAYS), [appts]);
  const noShowRecovery = useMemo(
    () => noShowRecoveryRate(appts, NOSHOW_RECOVERY_WINDOW_DAYS),
    [appts],
  );
  const ideal = useMemo(() => idealWindowAdherence(appts, IDEAL_WINDOW), [appts]);
  const newReturning = useMemo(() => newVsReturning(filteredAppts, clients, range), [filteredAppts, clients, range]);
  const sources = useMemo(() => sourceBreakdown(filteredAppts), [filteredAppts]);
  const proLoyalty = useMemo(() => professionalLoyalty(appts), [appts]);
  const brand = useMemo(() => brandLoyalty(appts), [appts]);
  const crm = useMemo(() => crmCompleteness(clients), [clients]);
  const avgConfirmHours = useMemo(() => avgHoursToConfirm(filteredAppts), [filteredAppts]);

  const waitlistConv = useMemo(
    () => waitlistConversionRate(waitlist),
    [waitlist],
  );

  const inactivePool = useMemo(() => {
    const cutoff = Date.now() - 90 * 86_400_000;
    return clients.filter(
      (c) => c.lastVisitAt && new Date(c.lastVisitAt).getTime() < cutoff,
    ).length;
  }, [clients]);

  const reactivation = useMemo(
    () =>
      reactivationRate({
        reactivated: clients.filter(
          (c) =>
            c.lastVisitAt &&
            new Date(c.lastVisitAt) >= range.start &&
            new Date(c.lastVisitAt) <= range.end &&
            c.completedVisits >= 2,
        ).length,
        inactives: inactivePool,
      }),
    [clients, range, inactivePool],
  );

  const packageCompletion = useMemo(() => packageCompletionRate(packages), [packages]);

  // Índice Cativa
  const futureRef = useMemo(() => {
    // referência saudável: ticket médio × média de visitas concluídas/dia × 30 dias
    const completed = filteredAppts.filter((a) => a.status === "completed").length;
    const days = Math.max(
      1,
      Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000),
    );
    const visitsPerDay = completed / days;
    return Math.max(
      100_000, // mínimo R$1k
      Math.round((ticketAvg * 100) * visitsPerDay * 30),
    );
  }, [filteredAppts, range, ticketAvg]);

  const cativa = useMemo(
    () =>
      cativaIndex({
        retentionPct: retention.rate,
        rebookingPct: rebook.rate,
        confirmationPct: confirmation.rate,
        noShowRecoveryPct: noShowRecovery.rate,
        occupancyPct: occupancy.rate,
        idealWindowPct: ideal.rate,
        crmCompletenessPct: crm,
        futureBookedValueCents: futureValue * 100,
        futureBookedReferenceCents: futureRef,
      }),
    [retention, rebook, confirmation, noShowRecovery, occupancy, ideal, crm, futureValue, futureRef],
  );

  const highValueUnconfirmed = useMemo(
    () =>
      filteredFuture.filter(
        (a) =>
          a.totalPriceCents >= HIGH_VALUE_CENTS &&
          a.status !== "canceled" &&
          a.confirmedAt === null &&
          !["confirmed", "arrived", "in_service", "completed", "reminded"].includes(a.status),
      ).length,
    [filteredFuture],
  );

  const pendingPackages = useMemo(
    () => packages.filter((p) => p.total > 0 && p.used < p.total).length,
    [packages],
  );

  const nba = useMemo(
    () =>
      nextBestActions({
        confirmationPct: confirmation.rate,
        conv1to2Pct: conv1to2.rate,
        occupancyPct: occupancy.rate,
        idealWindowPct: ideal.rate,
        pendingPackages,
        highValueUnconfirmed,
        reactivableClients: inactivePool,
      }),
    [confirmation, conv1to2, occupancy, ideal, pendingPackages, highValueUnconfirmed, inactivePool],
  );

  return {
    loading,
    labels,
    filters,
    range,
    setPreset,
    preset,
    setUnitId,
    setProfessionalId,
    setServiceId,
    setSource,

    // raw
    appts: filteredAppts,
    futureAppts: filteredFuture,
    clients,
    waitlist,

    // metrics
    metrics: {
      attendance,
      noShow,
      cancellation,
      confirmation,
      occupancy,
      bookedMinutes,
      availableMinutes,
      ticketAvg,
      ticketByPro,
      ticketByUnit,
      ticketByService,
      futureValue,
      futureRisk,
      retention,
      conv1to2,
      conv2to3,
      rebook,
      noShowRecovery,
      ideal,
      newReturning,
      sources,
      proLoyalty,
      brand,
      crm,
      avgConfirmHours,
      waitlistConv,
      inactivePool,
      reactivation,
      packageCompletion,
      pendingPackages,
      highValueUnconfirmed,
    },
    cativa,
    nba,
  };
}
