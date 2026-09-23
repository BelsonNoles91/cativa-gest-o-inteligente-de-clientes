/**
 * useOutreach — carrega os dados de retorno e reativação do tenant.
 * Só leitura: reaproveita os fatos do módulo de analytics.
 */
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  fetchAppointments,
  fetchClients,
  fetchFutureAppointments,
} from "@/repositories/analytics";
import { listServices } from "@/repositories/catalog";
import {
  buildReactivationCandidates,
  buildReturnReminders,
  type ReactivationCandidate,
  type ReturnReminder,
} from "@/domain/retention-outreach";

const DAY = 86_400_000;
const HISTORY_DAYS = 365;

export interface OutreachData {
  reminders: ReturnReminder[];
  reactivation: ReactivationCandidate[];
  serviceNames: Record<string, string>;
}

export function useOutreach() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return useQuery<OutreachData>({
    queryKey: ["outreach", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const end = new Date();
      const start = new Date(end.getTime() - HISTORY_DAYS * DAY);

      const [appts, future, clients, services] = await Promise.all([
        fetchAppointments({ tenantId, start: start.toISOString(), end: end.toISOString() }),
        fetchFutureAppointments(tenantId),
        fetchClients(tenantId),
        listServices({ tenantId }).catch(() => []),
      ]);

      const serviceNames: Record<string, string> = {};
      for (const service of services) serviceNames[service.id] = service.name;

      return {
        reminders: buildReturnReminders(appts, clients, future),
        reactivation: buildReactivationCandidates(appts, clients, future),
        serviceNames,
      };
    },
  });
}
