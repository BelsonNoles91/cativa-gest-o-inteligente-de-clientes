import { useEffect, useState } from "react";
import {
  Building2,
  Flag,
  Loader2,
  Package,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  AlertCircle,
  Activity,
  FileStack,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { TrialLogsTab } from "@/features/admin/TrialLogsTab";
import { MembersTab } from "@/features/admin/MembersTab";
import { AuditLogsTab } from "@/features/admin/AuditLogsTab";
import { IncidentsTab as AdminIncidentsTab } from "@/features/admin/IncidentsTab";
import { FeatureFlagsConsole } from "@/features/admin/FeatureFlagsConsole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  listTenantsWithSubscriptions,
  type TenantWithSub,
} from "@/repositories/billing";

export default function SuperAdmin() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantWithSub[]>([]);

  async function reload() {
    setLoading(true);
    const tenantRows = await listTenantsWithSubscriptions();
    setTenants(tenantRows);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <PageHeader
        title="Super Admin Console"
        description="Gestão multi-tenant, auditoria global e incidentes."
        icon={<ShieldCheck className="h-6 w-6 text-primary" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => reload()}>
              <Activity className="h-4 w-4" /> Atualizar
            </Button>
            <StatusBadge tone="brand">{tenants.length} tenants</StatusBadge>
          </div>
        }
      />

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="members" className="space-y-6">
          <div className="border-b border-border/60">
            <TabsList className="h-auto p-0 bg-transparent gap-6 overflow-x-auto scrollbar-none flex-nowrap flex justify-start">
              <TabsTrigger value="members" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 font-semibold text-sm whitespace-nowrap">
                <Users className="mr-1.5 h-3.5 w-3.5" /> Membros
              </TabsTrigger>
              <TabsTrigger value="audit" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 font-semibold text-sm whitespace-nowrap">
                <ScrollText className="mr-1.5 h-3.5 w-3.5" /> Auditoria
              </TabsTrigger>
              <TabsTrigger value="incidents" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 font-semibold text-sm whitespace-nowrap">
                <AlertCircle className="mr-1.5 h-3.5 w-3.5" /> Incidentes
              </TabsTrigger>
              <TabsTrigger value="plans" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 font-semibold text-sm whitespace-nowrap">
                <Package className="mr-1.5 h-3.5 w-3.5" /> Planos
              </TabsTrigger>
              <TabsTrigger value="console" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 font-semibold text-sm whitespace-nowrap">
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Console
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="members" className="mt-0 focus-visible:ring-0">
            <MembersTab />
          </TabsContent>

          <TabsContent value="audit" className="mt-0 focus-visible:ring-0">
            <AuditLogsTab tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} />
          </TabsContent>

          <TabsContent value="incidents" className="mt-0 focus-visible:ring-0">
            <AdminIncidentsTab />
          </TabsContent>

          <TabsContent value="plans" className="mt-0 focus-visible:ring-0">
            <TrialLogsTab tenants={tenants} />
          </TabsContent>

          <TabsContent value="console" className="mt-0 focus-visible:ring-0">
            <FeatureFlagsConsole />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
