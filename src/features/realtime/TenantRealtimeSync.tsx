/**
 * TenantRealtimeSync — escuta mudanças do tenant ativo (agendamentos feitos
 * pelo link público, portal do cliente, outros usuários) e avisa as telas.
 *  - invalida todas as queries do React Query
 *  - dispara o evento de janela `cativa:realtime` para telas com carga manual
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/features/tenant/TenantProvider";

export const REALTIME_EVENT = "cativa:realtime";
const TABLES = ["appointments", "appointment_items", "clients", "waitlist_entries", "confirmation_queue"];

export function TenantRealtimeSync() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id ?? null;

  useEffect(() => {
    if (!tenantId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const notify = (table: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries();
        window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: { table } }));
      }, 400);
    };
    let channel = supabase.channel(`tenant-sync-${tenantId}`);
    for (const table of TABLES) {
      const filter = table === "appointment_items" ? undefined : `tenant_id=eq.${tenantId}`;
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => notify(table),
      );
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return null;
}

/** Executa `callback` sempre que chegar uma mudança em tempo real. */
export function useRealtimeRefresh(callback: () => void) {
  useEffect(() => {
    const handler = () => callback();
    window.addEventListener(REALTIME_EVENT, handler);
    return () => window.removeEventListener(REALTIME_EVENT, handler);
  }, [callback]);
}
