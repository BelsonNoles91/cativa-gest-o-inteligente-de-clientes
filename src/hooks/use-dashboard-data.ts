/**
 * @file use-dashboard-data.ts
 * @description Aggregated data hook for the main dashboard view.
 * Consolidates appointments, queue status, availability metrics, and client growth.
 */
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/TenantProvider";
import { listAppointmentsHydrated } from "@/repositories/scheduling";
import { countQueueByStage } from "@/repositories/confirmation";
import { fetchAvailability } from "@/repositories/analytics";
import { supabase } from "@/integrations/supabase/client";

/**
 * @hook useDashboardData
 * @description Fetches and computes key performance indicators (KPIs) for the dashboard.
 * 
 * Data points resolved:
 * - Number of appointments today
 * - Current occupancy percentage (booked vs available minutes)
 * - Pending confirmation queue counts
 * - New clients acquired within the current week
 * - List of upcoming appointments for the day
 * 
 * @returns {QueryResult} TanStack Query result containing dashboard metrics.
 */
export function useDashboardData() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["dashboard-data", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) throw new Error("Tenant not found");

      const today = getDayTimeRange(new Date());
      const weekStart = getStartOfWeek(new Date());

      // Concurrent fetch for all dashboard components
      const [appointmentsToday, queueCounts, availability, newClients, ltvQuery] = await Promise.all([
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
        supabase.rpc("get_tenant_ltv_estimate", { _tenant_id: currentTenant.id }),
      ]);

      // Calculate aggregated metrics
      const bookedMinutes = appointmentsToday
        .filter((item) => !["canceled", "no_show"].includes(item.appointment.status))
        .reduce((total, item) => total + item.appointment.durationMinutes, 0);

      const occupancyToday =
        availability.availableMinutes > 0
          ? Math.round((bookedMinutes / availability.availableMinutes) * 100)
          : 0;

      const pendingConfirmations = Object.values(queueCounts).reduce((total, value) => total + (value as number), 0);

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
    staleTime: 1000 * 60 * 5, // 5 minutes - dashboard data is slightly volatile
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Returns the start and end of a single day.
 * @internal
 */
function getDayTimeRange(baseDate: Date) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Calculates the start of the week (Monday) for growth metrics.
 * @internal
 */
function getStartOfWeek(baseDate: Date) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  const diff = (date.getDay() + 6) % 7; // Adjust to make Monday the first day
  date.setDate(date.getDate() - diff);
  return date;
}
