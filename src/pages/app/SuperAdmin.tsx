import { useEffect, useState } from "react";
import {
  Loader2,
  Package,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  AlertCircle,
  Activity,
  Building2,
  UserRoundCog,
  Clock3,
  Gift,
  CreditCard,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { TrialLogsTab } from "@/features/admin/TrialLogsTab";
import { MembersTab } from "@/features/admin/MembersTab";
import { AuditLogsTab } from "@/features/admin/AuditLogsTab";
import { IncidentsTab as AdminIncidentsTab } from "@/features/admin/IncidentsTab";
import { FeatureFlagsConsole } from "@/features/admin/FeatureFlagsConsole";
import { SecurityScansTab } from "@/features/admin/SecurityScansTab";
import { PlansEditorTab } from "@/features/admin/PlansEditorTab";
import { ClientMembershipsTab } from "@/features/admin/ClientMembershipsTab";
import { TenantSubscriptionsTab } from "@/features/admin/TenantSubscriptionsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  listTenantsWithSubscriptions,
  type TenantWithSub,
} from "@/repositories/billing";
import { handleError } from "@/lib/error-handler";

export default function SuperAdmin() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantWithSub[]>([]);

  async function reload() {
    setLoading(true);
    try {
      const tenantRows = await listTenantsWithSubscriptions();
      setTenants(tenantRows);
    } catch (err) {
      handleError(err, { category: "DATABASE", context: { source: "SuperAdmin.reload" } });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <PageHeader
        title="Painel Administrativo"
        description="Administração da plataforma, contas e acessos em áreas separadas."
        icon={<ShieldCheck className="h-6 w-6 text-primary" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => reload()}>
              <Activity className="h-4 w-4" /> Atualizar
            </Button>
            <StatusBadge tone="brand">{tenants.length} contas</StatusBadge>
          </div>
        }
      />

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="platform" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/60 p-1">
            <TabsTrigger value="platform" className="min-h-12 gap-2 px-3 py-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold">Sistema Cativa</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:block">Configurações globais</span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="min-h-12 gap-2 px-3 py-2">
              <UserRoundCog className="h-4 w-4 shrink-0" />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold">Contas e acessos</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:block">Perfis por estabelecimento</span>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="platform" className="mt-0 focus-visible:ring-0">
            <section aria-labelledby="platform-admin-title" className="space-y-5">
              <div className="flex items-start gap-3 border-b border-border/60 pb-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 id="platform-admin-title" className="font-display text-lg font-semibold">Administração global</h2>
                  <p className="text-sm text-muted-foreground">Alterações aplicadas à plataforma, aos planos e à operação geral.</p>
                </div>
              </div>

              <Tabs defaultValue="plans" className="space-y-6">
                <div className="overflow-x-auto border-b border-border/60">
                  <TabsList className="flex h-auto w-max min-w-full flex-nowrap justify-start gap-5 bg-transparent p-0">
                    <TabsTrigger value="plans" className="gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <Package className="h-3.5 w-3.5" /> Planos
                    </TabsTrigger>
                    <TabsTrigger value="console" className="gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Recursos
                    </TabsTrigger>
                    <TabsTrigger value="incidents" className="gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <AlertCircle className="h-3.5 w-3.5" /> Incidentes
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <ShieldCheck className="h-3.5 w-3.5" /> Segurança
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <ScrollText className="h-3.5 w-3.5" /> Auditoria
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="plans" className="mt-0 focus-visible:ring-0"><PlansEditorTab /></TabsContent>
                <TabsContent value="console" className="mt-0 focus-visible:ring-0"><FeatureFlagsConsole /></TabsContent>
                <TabsContent value="incidents" className="mt-0 focus-visible:ring-0"><AdminIncidentsTab /></TabsContent>
                <TabsContent value="security" className="mt-0 focus-visible:ring-0"><SecurityScansTab /></TabsContent>
                <TabsContent value="audit" className="mt-0 focus-visible:ring-0">
                  <AuditLogsTab tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} />
                </TabsContent>
              </Tabs>
            </section>
          </TabsContent>

          <TabsContent value="accounts" className="mt-0 focus-visible:ring-0">
            <section aria-labelledby="account-admin-title" className="space-y-5">
              <div className="flex items-start gap-3 border-b border-border/60 pb-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent/15 text-accent-strong">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 id="account-admin-title" className="font-display text-lg font-semibold">Estabelecimentos e perfis</h2>
                  <p className="text-sm text-muted-foreground">Ações restritas a uma conta, seus usuários e seu período de teste.</p>
                </div>
              </div>

              <Tabs defaultValue="members" className="space-y-6">
                <div className="overflow-x-auto border-b border-border/60">
                  <TabsList className="flex h-auto w-max min-w-full flex-nowrap justify-start gap-5 bg-transparent p-0">
                    <TabsTrigger value="members" className="gap-1.5 rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <Users className="h-3.5 w-3.5" /> Perfis e acessos
                    </TabsTrigger>
                    <TabsTrigger value="subscriptions" className="gap-1.5 rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <CreditCard className="h-3.5 w-3.5" /> Assinaturas
                    </TabsTrigger>
                    <TabsTrigger value="client-plans" className="gap-1.5 rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <Gift className="h-3.5 w-3.5" /> Planos de clientes
                    </TabsTrigger>
                    <TabsTrigger value="account-settings" className="gap-1.5 rounded-none border-b-2 border-transparent px-0 pb-3 text-sm font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustes por conta
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="members" className="mt-0 focus-visible:ring-0"><MembersTab /></TabsContent>
                <TabsContent value="subscriptions" className="mt-0 space-y-8 focus-visible:ring-0">
                  <TenantSubscriptionsTab tenants={tenants} onChanged={reload} />
                  <div className="space-y-3 border-t border-border/60 pt-6">
                    <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Tentativas de ativação de teste</h3></div>
                    <TrialLogsTab tenants={tenants} />
                  </div>
                </TabsContent>
                <TabsContent value="client-plans" className="mt-0 focus-visible:ring-0">
                  <ClientMembershipsTab tenants={tenants.map((tenant) => ({ id: tenant.id, name: tenant.name }))} />
                </TabsContent>
                <TabsContent value="account-settings" className="mt-0 focus-visible:ring-0"><FeatureFlagsConsole mode="accounts" /></TabsContent>
              </Tabs>
            </section>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
