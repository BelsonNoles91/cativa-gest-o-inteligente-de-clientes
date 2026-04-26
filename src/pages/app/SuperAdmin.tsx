import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CreditCard,
  FileStack,
  Flag,
  Loader2,
  LogIn,
  Package,
  Pencil,
  Plus,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { TrialLogsTab } from "@/features/admin/TrialLogsTab";
import { MembersTab } from "@/features/admin/MembersTab";
import { ProvisionTestUsersCard } from "@/features/admin/ProvisionTestUsersCard";
import { ClientMembershipsTab } from "@/features/admin/ClientMembershipsTab";
import { AuditLogsTab } from "@/features/admin/AuditLogsTab";
import { FeatureFlagsConsole } from "@/features/admin/FeatureFlagsConsole";
import { useTenant } from "@/features/tenant/TenantProvider";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PlanCard } from "@/features/billing/PlanCard";
import { useToast } from "@/hooks/use-toast";
import {
  billingPeriodLabels,
  eventLabels,
  planStatusLabels,
  subscriptionStatusLabels,
  subscriptionStatusTone,
  type FeatureFlag,
  type Plan,
  type PlanFeature,
  type SegmentTemplate,
  type SubscriptionEvent,
} from "@/domain/billing";
import { segmentLabels, type TenantSegment } from "@/domain/tenant";
import {
  archivePlan,
  changeSubscriptionPlan,
  deleteFeatureFlag,
  deletePlanFeature,
  deleteSegmentTemplate,
  extendTrial,
  listAllFeatureFlags,
  listPlanFeatures,
  listPlans,
  listSegmentTemplates,
  listSubscriptionEvents,
  listTenantsWithSubscriptions,
  setDiscount,
  setFeatureFlagValue,
  setOverrideLimits,
  setSubscriptionStatus,
  upsertFeatureFlag,
  upsertPlan,
  upsertPlanFeature,
  upsertSegmentTemplate,
  type TenantWithSub,
} from "@/repositories/billing";

const TENANT_SEGMENTS: TenantSegment[] = [
  "salao",
  "barbearia",
  "clinica_estetica",
  "lash_brow",
  "esmalteria",
  "wellness",
];

const FEATURE_VALUE_TYPES: Array<PlanFeature["valueType"]> = ["boolean", "number", "string", "json"];
const PLAN_STATUSES: Array<Plan["status"]> = ["public", "private", "archived"];
const SUBSCRIPTION_STATUSES = ["trialing", "active", "overdue", "suspended", "canceled"] as const;

type PlanFormState = {
  code: string;
  name: string;
  description: string;
  billingPeriod: Plan["billingPeriod"];
  priceCents: string;
  trialDays: string;
  gracePeriodDays: string;
  maxUnits: string;
  maxProfessionals: string;
  maxActiveClients: string;
  maxStorageMb: string;
  maxAppointmentsMonth: string;
  status: Plan["status"];
  isDefault: boolean;
  features: Record<string, boolean>;
  displayOrder: string;
};

type FeatureFormState = {
  featureKey: string;
  label: string;
  valueType: PlanFeature["valueType"];
  valueRaw: string;
  displayOrder: string;
};

type FlagFormState = {
  tenantId: string;
  flagKey: string;
  label: string;
  description: string;
  valueType: FeatureFlag["valueType"];
  valueRaw: string;
  isGlobal: boolean;
};

type TemplateFormState = {
  segment: TenantSegment;
  name: string;
  description: string;
  payloadRaw: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: string;
};

const EMPTY_PLAN_FORM: PlanFormState = {
  code: "",
  name: "",
  description: "",
  billingPeriod: "monthly",
  priceCents: "0",
  trialDays: "14",
  gracePeriodDays: "7",
  maxUnits: "",
  maxProfessionals: "",
  maxActiveClients: "",
  maxStorageMb: "",
  maxAppointmentsMonth: "",
  status: "public",
  isDefault: false,
  features: {
    online_scheduling: false,
    custom_logo: false,
    advanced_reports: false
  },
  displayOrder: "0",
};

const EMPTY_FEATURE_FORM: FeatureFormState = {
  featureKey: "",
  label: "",
  valueType: "boolean",
  valueRaw: "true",
  displayOrder: "0",
};

const EMPTY_FLAG_FORM: FlagFormState = {
  tenantId: "global",
  flagKey: "",
  label: "",
  description: "",
  valueType: "boolean",
  valueRaw: "false",
  isGlobal: true,
};

const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  segment: "salao",
  name: "",
  description: "",
  payloadRaw: "{}",
  isDefault: false,
  isActive: true,
  displayOrder: "0",
};

export default function SuperAdmin() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantWithSub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [templates, setTemplates] = useState<SegmentTemplate[]>([]);

  async function reload() {
    setLoading(true);
    const [tenantRows, planRows, flagRows, templateRows] = await Promise.all([
      listTenantsWithSubscriptions(),
      listPlans(),
      listAllFeatureFlags(),
      listSegmentTemplates(),
    ]);
    const featureRows = planRows.length > 0 ? await listPlanFeatures(planRows.map((item) => item.id)) : [];
    setTenants(tenantRows);
    setPlans(planRows);
    setFeatures(featureRows);
    setFlags(flagRows);
    setTemplates(templateRows);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <>
      <PageHeader
        title="Super Admin"
        description="Gestão SaaS de tenants, planos, limites, feature flags e templates por segmento."
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={<StatusBadge tone="brand">{tenants.length} tenants</StatusBadge>}
      />

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="tenants" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-9">
            <TabsTrigger value="tenants"><Building2 className="mr-1.5 h-3.5 w-3.5" />Tenants</TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members"><Users className="mr-1.5 h-3.5 w-3.5" />Membros</TabsTrigger>
            <TabsTrigger value="client-memberships" data-testid="tab-client-memberships"><Package className="mr-1.5 h-3.5 w-3.5" />Memberships</TabsTrigger>
            <TabsTrigger value="plans"><Package className="mr-1.5 h-3.5 w-3.5" />Planos</TabsTrigger>
            <TabsTrigger value="console" data-testid="tab-console"><SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Console</TabsTrigger>
            <TabsTrigger value="flags"><Flag className="mr-1.5 h-3.5 w-3.5" />Flags</TabsTrigger>
            <TabsTrigger value="templates"><FileStack className="mr-1.5 h-3.5 w-3.5" />Templates</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit"><ScrollText className="mr-1.5 h-3.5 w-3.5" />Auditoria</TabsTrigger>
            <TabsTrigger value="trial-logs" data-testid="tab-trial-logs"><CreditCard className="mr-1.5 h-3.5 w-3.5" />Trial</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants">
            <TenantsTab tenants={tenants} plans={plans} onReload={reload} />
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <ProvisionTestUsersCard />
            <MembersTab />
          </TabsContent>

          <TabsContent value="client-memberships">
            <ClientMembershipsTab tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} />
          </TabsContent>

          <TabsContent value="plans">
            <PlansTab plans={plans} features={features} onReload={reload} />
          </TabsContent>

          <TabsContent value="console">
            <FeatureFlagsConsole />
          </TabsContent>

          <TabsContent value="flags">
            <FlagsTab flags={flags} tenants={tenants} onReload={reload} />
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesTab templates={templates} onReload={reload} />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogsTab tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} />
          </TabsContent>

          <TabsContent value="trial-logs">
            <TrialLogsTab tenants={tenants} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function TenantsTab({
  tenants,
  plans,
  onReload,
}: {
  tenants: TenantWithSub[];
  plans: Plan[];
  onReload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const { impersonateTenant, refresh: refreshTenantContext } = useTenant();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTenant, setSelectedTenant] = useState<TenantWithSub | null>(null);
  const [editingTenant, setEditingTenant] = useState<TenantWithSub | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", segment: "salao" as TenantSegment });
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    maxUnits: "",
    maxProfessionals: "",
    maxActiveClients: "",
    maxStorageMb: "",
    discountCents: "0",
    discountReason: "",
  });

  function openEdit(tenant: TenantWithSub) {
    setEditingTenant(tenant);
    setEditForm({ 
      name: tenant.name, 
      slug: tenant.slug, 
      segment: tenant.segment
    });
  }

  const [metadataForm, setMetadataForm] = useState({
    feature_overrides: {} as Record<string, boolean>
  });

  function toggleMetadataOverride(featureKey: string, value: boolean) {
    setMetadataForm(prev => ({
      ...prev,
      feature_overrides: {
        ...prev.feature_overrides,
        [featureKey]: value
      }
    }));
  }

  async function saveEdit() {
    if (!editingTenant) return;
    try {
      const { error } = await supabase.rpc("admin_update_tenant", {
        _tenant_id: editingTenant.id,
        _name: editForm.name.trim() || null,
        _slug: editForm.slug.trim() || null,
        _segment: editForm.segment,
      });
      if (error) throw error;
      toast({ title: "Tenant atualizado" });
      setEditingTenant(null);
      await Promise.all([onReload(), refreshTenantContext()]);
    } catch (err) {
      toast({
        title: "Erro ao atualizar tenant",
        description: String(err instanceof Error ? err.message : err),
        variant: "destructive",
      });
    }
  }

  async function handleImpersonate(tenant: TenantWithSub) {
    try {
      await impersonateTenant(tenant.id, "switcher-tenants-tab");
      toast({ title: `Impersonando ${tenant.name}`, description: "Acesso registrado em audit logs." });
    } catch (err) {
      toast({
        title: "Erro ao impersonar",
        description: String(err instanceof Error ? err.message : err),
        variant: "destructive",
      });
    }
  }

  const filtered = useMemo(
    () =>
      tenants.filter((tenant) => {
        const matchSearch =
          !search ||
          tenant.name.toLowerCase().includes(search.toLowerCase()) ||
          tenant.slug.toLowerCase().includes(search.toLowerCase());
        const matchStatus =
          statusFilter === "all" || tenant.subscription?.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [search, statusFilter, tenants],
  );

  useEffect(() => {
    if (!selectedTenant?.subscription) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoadingEvents(true);
    void (async () => {
      try {
        const loaded = await listSubscriptionEvents(selectedTenant.subscription!.id);
        if (!cancelled) setEvents(loaded);
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTenant?.subscription?.id]);

  function openTenantDialog(tenant: TenantWithSub) {
    setSelectedTenant(tenant);
    setOverrideForm({
      maxUnits: numberField(tenant.subscription?.overrideLimits.max_units),
      maxProfessionals: numberField(tenant.subscription?.overrideLimits.max_professionals),
      maxActiveClients: numberField(tenant.subscription?.overrideLimits.max_active_clients),
      maxStorageMb: numberField(tenant.subscription?.overrideLimits.max_storage_mb),
      discountCents: String(tenant.subscription?.discountCents ?? 0),
      discountReason: tenant.subscription?.discountReason ?? "",
    });
    // @ts-ignore - metadata existe no BD após migração
    setMetadataForm({
      feature_overrides: (tenant.metadata?.feature_overrides as Record<string, boolean>) ?? {}
    });
  }

  async function handleChangePlan(tenant: TenantWithSub, nextPlanId: string) {
    if (!tenant.subscription) return;
    const currentPlan = plans.find((plan) => plan.id === tenant.subscription?.planId);
    const nextPlan = plans.find((plan) => plan.id === nextPlanId);
    if (!currentPlan || !nextPlan) return;
    try {
      await changeSubscriptionPlan({
        subscriptionId: tenant.subscription.id,
        tenantId: tenant.id,
        fromPlanId: currentPlan.id,
        toPlanId: nextPlan.id,
        isUpgrade: nextPlan.priceCents > currentPlan.priceCents,
      });
      toast({ title: "Plano alterado" });
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao trocar plano", description: String(error), variant: "destructive" });
    }
  }

  async function handleStatus(tenant: TenantWithSub, newStatus: (typeof SUBSCRIPTION_STATUSES)[number]) {
    if (!tenant.subscription) return;
    try {
      await setSubscriptionStatus({
        subscriptionId: tenant.subscription.id,
        tenantId: tenant.id,
        fromStatus: tenant.subscription.status,
        newStatus,
      });
      toast({ title: "Status atualizado" });
      await onReload();
      openTenantDialog({ ...tenant, subscription: { ...tenant.subscription, status: newStatus } });
    } catch (error) {
      toast({ title: "Erro ao atualizar status", description: String(error), variant: "destructive" });
    }
  }

  async function handleSaveTenantAdjustments() {
    if (!selectedTenant?.subscription) return;
    try {
      await Promise.all([
        setOverrideLimits({
          subscriptionId: selectedTenant.subscription.id,
          tenantId: selectedTenant.id,
          override: {
            max_units: parseNullableNumber(overrideForm.maxUnits),
            max_professionals: parseNullableNumber(overrideForm.maxProfessionals),
            max_active_clients: parseNullableNumber(overrideForm.maxActiveClients),
            max_storage_mb: parseNullableNumber(overrideForm.maxStorageMb),
          },
        }),
        setDiscount({
          subscriptionId: selectedTenant.subscription.id,
          tenantId: selectedTenant.id,
          discountCents: parseInt(overrideForm.discountCents || "0", 10) || 0,
          discountReason: overrideForm.discountReason.trim() || null,
        }),
        // Salvar metadata (overrides de recursos)
        supabase.from("tenants").update({
          metadata: metadataForm
        }).eq("id", selectedTenant.id)
      ]);
      toast({ title: "Ajustes salvos" });
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao salvar ajustes", description: String(error), variant: "destructive" });
    }
  }

  async function handleExtendTrial(tenant: TenantWithSub) {
    if (!tenant.subscription) return;
    try {
      await extendTrial({
        subscriptionId: tenant.subscription.id,
        tenantId: tenant.id,
        newTrialEndsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        notes: "+14d via super admin",
      });
      toast({ title: "Trial estendido" });
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao estender trial", description: String(error), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tenant..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {SUBSCRIPTION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>{subscriptionStatusLabels[status]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="Nenhum tenant" description="Ajuste os filtros." />
      ) : (
        <div className="surface-card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {filtered.map((tenant) => (
              <li key={tenant.id} className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tenant.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {segmentLabels[tenant.segment]} · {tenant.slug} · {tenant.planName ?? "Sem plano"}
                  </p>
                </div>
                {tenant.subscription ? (
                  <>
                    <StatusBadge tone={subscriptionStatusTone[tenant.subscription.status]}>
                      {subscriptionStatusLabels[tenant.subscription.status]}
                    </StatusBadge>
                    <Select
                      value={tenant.subscription.planId}
                      onValueChange={(value) => void handleChangePlan(tenant, value)}
                    >
                      <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {plans.filter((plan) => plan.status !== "archived").map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      {tenant.subscription.status === "trialing" && (
                        <Button size="sm" variant="outline" onClick={() => void handleExtendTrial(tenant)}>
                          +14d trial
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openTenantDialog(tenant)}>
                        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Ajustes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(tenant)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleImpersonate(tenant)}>
                        <LogIn className="mr-1.5 h-3.5 w-3.5" /> Entrar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="neutral">Sem assinatura</StatusBadge>
                    <Button size="sm" variant="outline" onClick={() => openEdit(tenant)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void handleImpersonate(tenant)}>
                      <LogIn className="mr-1.5 h-3.5 w-3.5" /> Entrar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedTenant?.name ?? "Tenant"}</DialogTitle>
            <DialogDescription>
              Revise assinatura, limites efetivos, overrides e eventos recentes deste tenant.
            </DialogDescription>
          </DialogHeader>
          {selectedTenant?.subscription ? (
            <div className="grid gap-6 overflow-y-auto pr-2 md:grid-cols-[1fr_1fr]">
              <div className="space-y-4">
                <div className="grid gap-3">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {SUBSCRIPTION_STATUSES.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={selectedTenant.subscription?.status === status ? "default" : "outline"}
                        onClick={() => void handleStatus(selectedTenant, status)}
                      >
                        {subscriptionStatusLabels[status]}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Override unidades">
                    <Input value={overrideForm.maxUnits} onChange={(e) => setOverrideForm((current) => ({ ...current, maxUnits: e.target.value }))} placeholder="Sem override" />
                  </Field>
                  <Field label="Override profissionais">
                    <Input value={overrideForm.maxProfessionals} onChange={(e) => setOverrideForm((current) => ({ ...current, maxProfessionals: e.target.value }))} placeholder="Sem override" />
                  </Field>
                  <Field label="Override clientes ativos">
                    <Input value={overrideForm.maxActiveClients} onChange={(e) => setOverrideForm((current) => ({ ...current, maxActiveClients: e.target.value }))} placeholder="Sem override" />
                  </Field>
                  <Field label="Override storage MB">
                    <Input value={overrideForm.maxStorageMb} onChange={(e) => setOverrideForm((current) => ({ ...current, maxStorageMb: e.target.value }))} placeholder="Sem override" />
                  </Field>
                  <Field label="Desconto em centavos">
                    <Input value={overrideForm.discountCents} onChange={(e) => setOverrideForm((current) => ({ ...current, discountCents: e.target.value }))} />
                  </Field>
                  <Field label="Motivo do desconto">
                    <Input value={overrideForm.discountReason} onChange={(e) => setOverrideForm((current) => ({ ...current, discountReason: e.target.value }))} />
                  </Field>
                </div>

                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-medium">Liberações esporádicas (Pulo do Gato)</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: "online_scheduling", label: "Agendamento Online" },
                      { key: "custom_logo", label: "Logo Personalizada" },
                      { key: "advanced_reports", label: "Relatórios Avançados" }
                    ].map(feat => (
                      <label key={feat.key} className="flex items-center gap-2 text-xs">
                        <Switch 
                          checked={metadataForm.feature_overrides[feat.key] || false} 
                          onCheckedChange={(val) => toggleMetadataOverride(feat.key, val)} 
                        />
                        {feat.label}
                      </label>
                    ))}
                  </div>
                </div>

                <Button className="mt-4" onClick={() => void handleSaveTenantAdjustments()}>
                  Salvar ajustes
                </Button>
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-lg font-semibold">Eventos recentes</h3>
                {loadingEvents ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : events.length === 0 ? (
                  <EmptyState icon={<CreditCard className="h-6 w-6" />} title="Sem eventos" description="Nenhuma movimentação registrada." />
                ) : (
                  <ul className="space-y-2">
                    {events.map((event) => (
                      <li key={event.id} className="rounded-xl border border-border/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{eventLabels[event.eventType]}</p>
                          <span className="text-[11px] text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                        </div>
                        {event.notes && <p className="mt-1 text-xs text-muted-foreground">{event.notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <EmptyState icon={<CreditCard className="h-6 w-6" />} title="Sem assinatura" description="Este tenant ainda não possui assinatura vinculada." />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTenant} onOpenChange={(open) => !open && setEditingTenant(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar tenant</DialogTitle>
            <DialogDescription>
              Ajuste os dados cadastrais básicos usados para identificação e segmentação do tenant.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Nome">
              <Input value={editForm.name} onChange={(e) => setEditForm((c) => ({ ...c, name: e.target.value }))} />
            </Field>
            <Field label="Slug">
              <Input value={editForm.slug} onChange={(e) => setEditForm((c) => ({ ...c, slug: e.target.value }))} />
            </Field>
            <Field label="Segmento">
              <Select value={editForm.segment} onValueChange={(v) => setEditForm((c) => ({ ...c, segment: v as TenantSegment }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TENANT_SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>{segmentLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button onClick={() => void saveEdit()}>Salvar alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlansTab({
  plans,
  features,
  onReload,
}: {
  plans: Plan[];
  features: PlanFeature[];
  onReload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(EMPTY_PLAN_FORM);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [featureForm, setFeatureForm] = useState<FeatureFormState>(EMPTY_FEATURE_FORM);
  const [editingFeature, setEditingFeature] = useState<PlanFeature | null>(null);

  function openPlanEditor(plan?: Plan) {
    setEditingPlan(plan ?? null);
    setPlanForm(
      plan
        ? {
            code: plan.code,
            name: plan.name,
            description: plan.description ?? "",
            billingPeriod: plan.billingPeriod,
            priceCents: String(plan.priceCents),
            trialDays: String(plan.trialDays),
            gracePeriodDays: String(plan.gracePeriodDays),
            maxUnits: numberField(plan.maxUnits),
            maxProfessionals: numberField(plan.maxProfessionals),
            maxActiveClients: numberField(plan.maxActiveClients),
            maxStorageMb: numberField(plan.maxStorageMb),
            maxAppointmentsMonth: numberField(plan.maxAppointmentsMonth),
            status: plan.status,
            isDefault: plan.isDefault,
            features: plan.features ?? {},
            displayOrder: String(plan.displayOrder),
          }
        : EMPTY_PLAN_FORM,
    );
    setOpenPlanDialog(true);
  }

  function openFeatureEditor(plan: Plan, feature?: PlanFeature) {
    setSelectedPlan(plan);
    setEditingFeature(feature ?? null);
    setFeatureForm(
      feature
        ? {
            featureKey: feature.featureKey,
            label: feature.label,
            valueType: feature.valueType,
            valueRaw: stringifyValue(feature.valueType, feature.value),
            displayOrder: String(feature.displayOrder),
          }
        : EMPTY_FEATURE_FORM,
    );
  }

  async function savePlan() {
    try {
      await upsertPlan({
        code: planForm.code.trim(),
        name: planForm.name.trim(),
        description: planForm.description.trim() || null,
        billingPeriod: planForm.billingPeriod,
        priceCents: parseInt(planForm.priceCents || "0", 10) || 0,
        trialDays: parseInt(planForm.trialDays || "14", 10) || 14,
        gracePeriodDays: parseInt(planForm.gracePeriodDays || "7", 10) || 7,
        maxUnits: parseNullableNumber(planForm.maxUnits),
        maxProfessionals: parseNullableNumber(planForm.maxProfessionals),
        maxActiveClients: parseNullableNumber(planForm.maxActiveClients),
        maxStorageMb: parseNullableNumber(planForm.maxStorageMb),
        maxAppointmentsMonth: parseNullableNumber(planForm.maxAppointmentsMonth),
        status: planForm.status,
        isDefault: planForm.isDefault,
        // @ts-ignore
        features: planForm.features,
        displayOrder: parseInt(planForm.displayOrder || "0", 10) || 0,
      } as any);
      toast({ title: editingPlan ? "Plano atualizado" : "Plano criado" });
      setOpenPlanDialog(false);
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao salvar plano", description: String(error), variant: "destructive" });
    }
  }

  async function saveFeature() {
    if (!selectedPlan) return;
    try {
      await upsertPlanFeature({
        id: editingFeature?.id,
        planId: selectedPlan.id,
        featureKey: featureForm.featureKey.trim(),
        label: featureForm.label.trim(),
        valueType: featureForm.valueType,
        value: parseFeatureValue(featureForm.valueType, featureForm.valueRaw),
        displayOrder: parseInt(featureForm.displayOrder || "0", 10) || 0,
      });
      toast({ title: editingFeature ? "Feature atualizada" : "Feature criada" });
      setEditingFeature(null);
      setFeatureForm(EMPTY_FEATURE_FORM);
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao salvar feature", description: String(error), variant: "destructive" });
    }
  }

  async function removeFeature(featureId: string) {
    try {
      await deletePlanFeature(featureId);
      toast({ title: "Feature removida" });
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao remover feature", description: String(error), variant: "destructive" });
    }
  }

  async function archive(planId: string) {
    try {
      await archivePlan(planId);
      toast({ title: "Plano arquivado" });
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao arquivar plano", description: String(error), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openPlanEditor()}>
          <Plus className="mr-2 h-4 w-4" /> Novo plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6" />} title="Sem planos" description="Cadastre o primeiro plano do SaaS." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.id} className="space-y-3">
                <PlanCard plan={plan} features={features.filter((feature) => feature.planId === plan.id)} highlight={plan.isDefault} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openPlanEditor(plan)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openFeatureEditor(plan)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Feature
                  </Button>
                  {plan.status !== "archived" && (
                    <Button size="sm" variant="ghost" onClick={() => void archive(plan.id)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Arquivar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="surface-card space-y-4 p-5">
            <h3 className="font-display text-lg font-semibold">
              {selectedPlan ? `Features de ${selectedPlan.name}` : "Editor de features"}
            </h3>
            {selectedPlan ? (
              <>
                <div className="grid gap-3">
                  <Field label="Chave">
                    <Input value={featureForm.featureKey} onChange={(e) => setFeatureForm((current) => ({ ...current, featureKey: e.target.value }))} />
                  </Field>
                  <Field label="Rótulo">
                    <Input value={featureForm.label} onChange={(e) => setFeatureForm((current) => ({ ...current, label: e.target.value }))} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tipo">
                      <Select value={featureForm.valueType} onValueChange={(value) => setFeatureForm((current) => ({ ...current, valueType: value as PlanFeature["valueType"] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FEATURE_VALUE_TYPES.map((valueType) => (
                            <SelectItem key={valueType} value={valueType}>{valueType}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Ordem">
                      <Input value={featureForm.displayOrder} onChange={(e) => setFeatureForm((current) => ({ ...current, displayOrder: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Valor">
                    <Textarea rows={3} value={featureForm.valueRaw} onChange={(e) => setFeatureForm((current) => ({ ...current, valueRaw: e.target.value }))} />
                  </Field>
                </div>
                <Button onClick={() => void saveFeature()}>
                  {editingFeature ? "Salvar feature" : "Adicionar feature"}
                </Button>

                <div className="space-y-2">
                  {features.filter((feature) => feature.planId === selectedPlan.id).map((feature) => (
                    <div key={feature.id} className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{feature.label}</p>
                          <p className="text-xs text-muted-foreground">{feature.featureKey} · {feature.valueType}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openFeatureEditor(selectedPlan, feature)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void removeFeature(feature.id)}>
                            Remover
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Escolha um plano e clique em “Feature” para editar benefícios e habilitações.</p>
            )}
          </div>
        </div>
      )}

      <Dialog open={openPlanDialog} onOpenChange={setOpenPlanDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Código">
                <Input value={planForm.code} onChange={(e) => setPlanForm((current) => ({ ...current, code: e.target.value }))} />
              </Field>
              <Field label="Nome">
                <Input value={planForm.name} onChange={(e) => setPlanForm((current) => ({ ...current, name: e.target.value }))} />
              </Field>
            </div>
            <Field label="Descrição">
              <Textarea rows={3} value={planForm.description} onChange={(e) => setPlanForm((current) => ({ ...current, description: e.target.value }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Periodicidade">
                <Select value={planForm.billingPeriod} onValueChange={(value) => setPlanForm((current) => ({ ...current, billingPeriod: value as Plan["billingPeriod"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(billingPeriodLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={planForm.status} onValueChange={(value) => setPlanForm((current) => ({ ...current, status: value as Plan["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{planStatusLabels[status]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preço em centavos">
                <Input value={planForm.priceCents} onChange={(e) => setPlanForm((current) => ({ ...current, priceCents: e.target.value }))} />
              </Field>
              <Field label="Ordem">
                <Input value={planForm.displayOrder} onChange={(e) => setPlanForm((current) => ({ ...current, displayOrder: e.target.value }))} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Trial (dias)">
                <Input value={planForm.trialDays} onChange={(e) => setPlanForm((current) => ({ ...current, trialDays: e.target.value }))} />
              </Field>
              <Field label="Grace (dias)">
                <Input value={planForm.gracePeriodDays} onChange={(e) => setPlanForm((current) => ({ ...current, gracePeriodDays: e.target.value }))} />
              </Field>
              <Field label="Unidades">
                <Input value={planForm.maxUnits} onChange={(e) => setPlanForm((current) => ({ ...current, maxUnits: e.target.value }))} placeholder="Ilimitado" />
              </Field>
              <Field label="Profissionais">
                <Input value={planForm.maxProfessionals} onChange={(e) => setPlanForm((current) => ({ ...current, maxProfessionals: e.target.value }))} placeholder="Ilimitado" />
              </Field>
              <Field label="Clientes ativos">
                <Input value={planForm.maxActiveClients} onChange={(e) => setPlanForm((current) => ({ ...current, maxActiveClients: e.target.value }))} placeholder="Ilimitado" />
              </Field>
              <Field label="Storage MB">
                <Input value={planForm.maxStorageMb} onChange={(e) => setPlanForm((current) => ({ ...current, maxStorageMb: e.target.value }))} placeholder="Ilimitado" />
              </Field>
              <Field label="Agendamentos/mês">
                <Input value={planForm.maxAppointmentsMonth} onChange={(e) => setPlanForm((current) => ({ ...current, maxAppointmentsMonth: e.target.value }))} placeholder="Ilimitado" />
              </Field>
            </div>
            
            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <h4 className="text-sm font-semibold">Recursos Habilitados</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: "online_scheduling", label: "Agendamento Online" },
                  { key: "custom_logo", label: "Logo Personalizada" },
                  { key: "advanced_reports", label: "Relatórios Avançados" }
                ].map(feat => (
                  <label key={feat.key} className="flex items-center gap-2 text-xs">
                    <Switch 
                      checked={planForm.features[feat.key] || false} 
                      onCheckedChange={(val) => setPlanForm(prev => ({
                        ...prev,
                        features: { ...prev.features, [feat.key]: val }
                      }))} 
                    />
                    {feat.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={planForm.isDefault} onCheckedChange={(checked) => setPlanForm((current) => ({ ...current, isDefault: checked }))} />
              Plano padrão
            </label>
            <Button onClick={() => void savePlan()}>
              {editingPlan ? "Salvar plano" : "Criar plano"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlagsTab({
  flags,
  tenants,
  onReload,
}: {
  flags: FeatureFlag[];
  tenants: TenantWithSub[];
  onReload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [form, setForm] = useState<FlagFormState>(EMPTY_FLAG_FORM);

  function openEditor(flag?: FeatureFlag) {
    setEditingFlag(flag ?? null);
    setForm(
      flag
        ? {
            tenantId: flag.isGlobal ? "global" : (flag.tenantId ?? "global"),
            flagKey: flag.flagKey,
            label: flag.label,
            description: flag.description ?? "",
            valueType: flag.valueType,
            valueRaw: stringifyValue(flag.valueType, flag.value),
            isGlobal: flag.isGlobal,
          }
        : EMPTY_FLAG_FORM,
    );
  }

  async function saveFlag() {
    try {
      await upsertFeatureFlag({
        id: editingFlag?.id,
        tenantId: form.isGlobal ? null : form.tenantId === "global" ? null : form.tenantId,
        flagKey: form.flagKey.trim(),
        label: form.label.trim(),
        description: form.description.trim() || null,
        valueType: form.valueType,
        value: parseFeatureValue(form.valueType, form.valueRaw),
        isGlobal: form.isGlobal,
      });
      toast({ title: editingFlag ? "Flag atualizada" : "Flag criada" });
      setEditingFlag(null);
      setForm(EMPTY_FLAG_FORM);
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao salvar flag", description: String(error), variant: "destructive" });
    }
  }

  async function removeFlag(flagId: string) {
    try {
      await deleteFeatureFlag(flagId);
      toast({ title: "Flag removida" });
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao remover flag", description: String(error), variant: "destructive" });
    }
  }

  async function toggleFlag(flag: FeatureFlag) {
    try {
      await setFeatureFlagValue(flag.id, !(flag.value === true));
      toast({ title: "Flag atualizada" });
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao alternar flag", description: String(error), variant: "destructive" });
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="surface-card space-y-4 p-5">
        <h3 className="font-display text-lg font-semibold">{editingFlag ? "Editar flag" : "Nova flag"}</h3>
        <Field label="Chave">
          <Input value={form.flagKey} onChange={(e) => setForm((current) => ({ ...current, flagKey: e.target.value }))} />
        </Field>
        <Field label="Rótulo">
          <Input value={form.label} onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))} />
        </Field>
        <Field label="Descrição">
          <Textarea rows={3} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={form.valueType} onValueChange={(value) => setForm((current) => ({ ...current, valueType: value as FeatureFlag["valueType"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEATURE_VALUE_TYPES.map((valueType) => (
                  <SelectItem key={valueType} value={valueType}>{valueType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Escopo">
            <Select value={form.isGlobal ? "global" : "tenant"} onValueChange={(value) => setForm((current) => ({ ...current, isGlobal: value === "global", tenantId: value === "global" ? "global" : current.tenantId }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="tenant">Por tenant</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {!form.isGlobal && (
          <Field label="Tenant">
            <Select value={form.tenantId} onValueChange={(value) => setForm((current) => ({ ...current, tenantId: value }))}>
              <SelectTrigger><SelectValue placeholder="Escolha o tenant" /></SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Valor">
          <Textarea rows={3} value={form.valueRaw} onChange={(e) => setForm((current) => ({ ...current, valueRaw: e.target.value }))} />
        </Field>
        <Button onClick={() => void saveFlag()}>{editingFlag ? "Salvar flag" : "Criar flag"}</Button>
      </div>

      <div className="space-y-4">
        {flags.length === 0 ? (
          <EmptyState icon={<Flag className="h-6 w-6" />} title="Sem flags" description="Cadastre a primeira flag do ambiente." />
        ) : (
          <div className="surface-card overflow-hidden">
            <ul className="divide-y divide-border/60">
              {flags.map((flag) => (
                <li key={flag.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{flag.label}</p>
                      <StatusBadge tone={flag.isGlobal ? "brand" : "info"} dot={false}>
                        {flag.isGlobal ? "global" : "tenant"}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {flag.flagKey} · {flag.valueType}
                      {flag.description ? ` · ${flag.description}` : ""}
                    </p>
                  </div>
                  {flag.valueType === "boolean" ? (
                    <Switch checked={flag.value === true} onCheckedChange={() => void toggleFlag(flag)} />
                  ) : (
                    <code className="rounded bg-muted px-2 py-1 text-xs">{stringifyValue(flag.valueType, flag.value)}</code>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditor(flag)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => void removeFlag(flag.id)}>Remover</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatesTab({
  templates,
  onReload,
}: {
  templates: SegmentTemplate[];
  onReload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<SegmentTemplate | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);

  function openEditor(template?: SegmentTemplate) {
    setEditingTemplate(template ?? null);
    setForm(
      template
        ? {
            segment: template.segment,
            name: template.name,
            description: template.description ?? "",
            payloadRaw: JSON.stringify(template.payload, null, 2),
            isDefault: template.isDefault,
            isActive: template.isActive,
            displayOrder: String(template.displayOrder),
          }
        : EMPTY_TEMPLATE_FORM,
    );
  }

  async function saveTemplate() {
    try {
      await upsertSegmentTemplate({
        id: editingTemplate?.id,
        segment: form.segment,
        name: form.name.trim(),
        description: form.description.trim() || null,
        payload: JSON.parse(form.payloadRaw || "{}") as Record<string, unknown>,
        isDefault: form.isDefault,
        isActive: form.isActive,
        displayOrder: parseInt(form.displayOrder || "0", 10) || 0,
      });
      toast({ title: editingTemplate ? "Template atualizado" : "Template criado" });
      setEditingTemplate(null);
      setForm(EMPTY_TEMPLATE_FORM);
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao salvar template", description: String(error), variant: "destructive" });
    }
  }

  async function removeTemplate(templateId: string) {
    try {
      await deleteSegmentTemplate(templateId);
      toast({ title: "Template removido" });
      await onReload();
    } catch (error) {
      toast({ title: "Erro ao remover template", description: String(error), variant: "destructive" });
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div className="surface-card space-y-4 p-5">
        <h3 className="font-display text-lg font-semibold">{editingTemplate ? "Editar template" : "Novo template"}</h3>
        <Field label="Segmento">
          <Select value={form.segment} onValueChange={(value) => setForm((current) => ({ ...current, segment: value as TenantSegment }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TENANT_SEGMENTS.map((segment) => (
                <SelectItem key={segment} value={segment}>{segmentLabels[segment]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Nome">
          <Input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
        </Field>
        <Field label="Descrição">
          <Textarea rows={3} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
        </Field>
        <Field label="Payload JSON">
          <Textarea rows={10} value={form.payloadRaw} onChange={(e) => setForm((current) => ({ ...current, payloadRaw: e.target.value }))} className="font-mono text-xs" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ordem">
            <Input value={form.displayOrder} onChange={(e) => setForm((current) => ({ ...current, displayOrder: e.target.value }))} />
          </Field>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isDefault} onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: checked }))} />
              Template padrão
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
              Ativo
            </label>
          </div>
        </div>
        <Button onClick={() => void saveTemplate()}>{editingTemplate ? "Salvar template" : "Criar template"}</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.length === 0 ? (
          <EmptyState icon={<FileStack className="h-6 w-6" />} title="Sem templates" description="Cadastre o primeiro template por segmento." />
        ) : (
          templates.map((template) => (
            <article key={template.id} className="surface-card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{segmentLabels[template.segment]}</p>
                  <h3 className="font-display text-base font-semibold">{template.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {template.isDefault && <StatusBadge tone="brand" dot={false}>padrão</StatusBadge>}
                  {!template.isActive && <StatusBadge tone="neutral" dot={false}>inativo</StatusBadge>}
                </div>
              </div>
              {template.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted/50 p-3 text-[10px]">{JSON.stringify(template.payload, null, 2)}</pre>
              <div className="mt-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditor(template)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => void removeTemplate(template.id)}>Remover</Button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseFeatureValue(valueType: PlanFeature["valueType"], raw: string): unknown {
  if (valueType === "boolean") return raw.trim().toLowerCase() === "true";
  if (valueType === "number") return Number(raw || 0);
  if (valueType === "json") return JSON.parse(raw || "{}");
  return raw;
}

function stringifyValue(valueType: PlanFeature["valueType"], value: unknown): string {
  if (valueType === "json") return JSON.stringify(value ?? {}, null, 2);
  if (typeof value === "string") return value;
  return String(value ?? "");
}

function numberField(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
