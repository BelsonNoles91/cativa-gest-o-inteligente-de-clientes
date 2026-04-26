import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/TenantProvider";
import { listAppointmentsHydrated } from "@/repositories/scheduling";
import { countQueueByStage } from "@/repositories/confirmation";
import { fetchAvailability } from "@/repositories/analytics";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardData() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["dashboard-data", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) throw new Error("Tenant not found");

      const today = localDayRange(new Date());
      const weekStart = startOfWeek(new Date());

      const [appointmentsToday, queueCounts, availability, newClients] = await Promise.all([
        listAppointmentsHydrated({
          tenantId: currentTenant.id,
          rangeStart: today.start.toISOString(),
          rangeEnd: today.end.toISOString(),
        }),
        countQueueByStage(currentTenant.id),
        fetchAvailability({
          tenantId: currentTenant.id,
          start: today.start.toISOString(),
          end: today.end.toISOString(),
        }),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", currentTenant.id)
          .gte("created_at", weekStart.toISOString()),
      ]);

      const bookedMinutes = appointmentsToday
        .filter((item) => !["canceled", "no_show"].includes(item.appointment.status))
        .reduce((total, item) => total + item.appointment.durationMinutes, 0);

      const occupancyToday =
        availability.availableMinutes > 0
          ? Math.round((bookedMinutes / availability.availableMinutes) * 100)
          : 0;

      const pendingConfirmations = Object.values(queueCounts).reduce((total, value) => total + value, 0);

      const upcoming = appointmentsToday
        .filter((item) => new Date(item.appointment.startsAt).getTime() >= Date.now())
        .slice(0, 6);

      return {
        appointmentsToday: appointmentsToday.length,
        occupancyToday,
        pendingConfirmations,
        newClientsWeek: newClients.count ?? 0,
        upcoming,
      };
    },
    enabled: !!currentTenant,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

function localDayRange(base: Date) {
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function startOfWeek(base: Date) {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}
