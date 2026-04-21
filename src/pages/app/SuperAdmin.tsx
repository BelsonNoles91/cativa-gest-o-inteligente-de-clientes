/**
 * SuperAdmin — visão global da plataforma (apenas usuários com is_super_admin).
 * Etapa 2: lista todos os tenants (RLS permite leitura total para super admin).
 */
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { segmentLabels, type TenantSegment } from "@/domain/tenant";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  segment: TenantSegment;
  status: string;
  created_at: string;
}

export default function SuperAdmin() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);

  useEffect(() => {
    supabase
      .from("tenants")
      .select("id, name, slug, segment, status, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTenants((data ?? []) as TenantRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <PageHeader
        title="Super Admin"
        description="Visão global da plataforma. Apenas para super administradores."
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={<StatusBadge tone="brand">{tenants.length} tenants</StatusBadge>}
      />

      {loading ? (
        <div className="flex h-60 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : tenants.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="Nenhum tenant ainda" description="Os primeiros estabelecimentos aparecerão aqui." />
      ) : (
        <div className="surface-card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {tenants.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary"><Building2 className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{segmentLabels[t.segment]} · {t.slug}</p>
                </div>
                <StatusBadge tone={t.status === "active" ? "success" : t.status === "trialing" ? "brand" : "warning"}>{t.status}</StatusBadge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
