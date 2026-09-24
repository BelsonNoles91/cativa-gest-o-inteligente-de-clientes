import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemFlags {
  enable_signups: boolean;
  maintenance_mode: boolean;
  show_cativa_index: boolean;
}

const DEFAULTS: SystemFlags = { enable_signups: true, maintenance_mode: false, show_cativa_index: true };

const asBool = (v: unknown, d: boolean) => (v === true || v === "true" ? true : v === false || v === "false" ? false : d);

/** Opções globais do painel administrativo, legíveis por qualquer visitante. */
export function useSystemFlags() {
  const q = useQuery({
    queryKey: ["system-flags"],
    queryFn: async (): Promise<SystemFlags> => {
      const { data, error } = await supabase.rpc("get_public_system_flags");
      if (error) throw error;
      const d = (data ?? {}) as Record<string, unknown>;
      return {
        enable_signups: asBool(d.enable_signups, true),
        maintenance_mode: asBool(d.maintenance_mode, false),
        show_cativa_index: asBool(d.show_cativa_index, true),
      };
    },
    staleTime: 30_000,
  });
  return { flags: q.data ?? DEFAULTS, loading: q.isLoading };
}
