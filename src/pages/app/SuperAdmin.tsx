/**
 * SuperAdmin — painel administrativo SaaS.
 *
 * Abas:
 *  - Tenants: lista todos com plano e status da assinatura
 *  - Planos: CRUD de planos + features
 *  - Feature flags: globais e por tenant
 *  - Templates: por segmento
 */
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Loader2, Building2, Package, Flag, FileStack, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PlanCard } from "@/features/billing/PlanCard";
import { useToast } from "@/hooks/use-toast";
import { segmentLabels } from "@/domain/tenant";
import {
  billingPeriodLabels,
  formatPrice,
  subscriptionStatusLabels,
  subscriptionStatusTone,
  type Plan,
  type PlanFeature,
  type FeatureFlag,
  type SegmentTemplate,
} from "@/domain/billing";
import {
  changeSubscriptionPlan,
  extendTrial,
  listAllFeatureFlags,
  listAllSubscriptions,
  listPlanFeatures,
  listPlans,
  listSegmentTemplates,
  listTenantsWithSubscriptions,
  setFeatureFlagValue,
  setSubscriptionStatus,
  type TenantWithSub,
} from "@/repositories/billing";

export default function SuperAdmin() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantWithSub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [templates, setTemplates] = useState<SegmentTemplate[]>([]);

  async function reload() {
    setLoading(true);
    const [t, p, fl, tpl] = await Promise.all([
      listTenantsWithSubscriptions(),
      listPlans(),
      listAllFeatureFlags(),
      listSegmentTemplates(),
    ]);
    const ft = p.length > 0 ? await listPlanFeatures(p.map((x) => x.id)) : [];
    setTenants(t);
    setPlans(p);
    setFeatures(ft);
    setFlags(fl);
    setTemplates(tpl);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <>
      <PageHeader
        title="Super Admin"
        description="Painel administrativo SaaS. Apenas para super administradores."
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={<StatusBadge tone="brand">{tenants.length} tenants</StatusBadge>}
      />

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="tenants" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="tenants"><Building2 className="mr-1.5 h-3.5 w-3.5" />Tenants</TabsTrigger>
            <TabsTrigger value="plans"><Package className="mr-1.5 h-3.5 w-3.5" />Planos</TabsTrigger>
            <TabsTrigger value="flags"><Flag className="mr-1.5 h-3.5 w-3.5" />Feature flags</TabsTrigger>
            <TabsTrigger value="templates"><FileStack className="mr-1.5 h-3.5 w-3.5" />Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-3">
            <TenantsTab tenants={tenants} plans={plans} onChange={reload} />
          </TabsContent>

          <TabsContent value="plans" className="space-y-3">
            <PlansTab plans={plans} features={features} />
          </TabsContent>

          <TabsContent value="flags" className="space-y-3">
            <FlagsTab flags={flags} onChange={reload} />
          </TabsContent>

          <TabsContent value="templates" className="space-y-3">
            <TemplatesTab templates={templates} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

// ---------------- TENANTS ----------------
function TenantsTab({
  tenants,
  plans,
  onChange,
}: {
  tenants: TenantWithSub[];
  plans: Plan[];
  onChange: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.subscription?.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tenants, search, statusFilter]);

  async function handleChangePlan(tenant: TenantWithSub, toPlanId: string) {
    if (!tenant.subscription) return;
    const fromPlan = plans.find((p) => p.id === tenant.subscription!.planId);
    const toPlan = plans.find((p) => p.id === toPlanId);
    if (!fromPlan || !toPlan) return;
    try {
      await changeSubscriptionPlan({
        subscriptionId: tenant.subscription.id,
        tenantId: tenant.id,
        fromPlanId: fromPlan.id,
        toPlanId: toPlan.id,
        isUpgrade: toPlan.priceCents > fromPlan.priceCents,
      });
      toast({ title: "Plano alterado", description: `${tenant.name}: ${fromPlan.name} → ${toPlan.name}` });
      onChange();
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    }
  }

  async function handleStatus(tenant: TenantWithSub, newStatus: "active" | "suspended" | "canceled") {
    if (!tenant.subscription) return;
    try {
      await setSubscriptionStatus({
        subscriptionId: tenant.subscription.id,
        tenantId: tenant.id,
        fromStatus: tenant.subscription.status,
        newStatus,
      });
      toast({ title: "Status atualizado" });
      onChange();
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    }
  }

  async function handleExtendTrial(tenant: TenantWithSub) {
    if (!tenant.subscription) return;
    const newEnd = new Date(Date.now() + 14 * 86_400_000).toISOString();
    try {
      await extendTrial({ subscriptionId: tenant.subscription.id, tenantId: tenant.id, newTrialEndsAt: newEnd, notes: "+14d via super admin" });
      toast({ title: "Trial estendido", description: "+14 dias" });
      onChange();
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tenant…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="trialing">Em trial</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="overdue">Em atraso</SelectItem>
            <SelectItem value="suspended">Suspensa</SelectItem>
            <SelectItem value="canceled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="Nenhum tenant" description="Ajuste os filtros." />
      ) : (
        <div className="surface-card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {filtered.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {segmentLabels[t.segment]} · {t.slug}
                    {t.planName && ` · ${t.planName}`}
                  </p>
                </div>
                {t.subscription ? (
                  <>
                    <StatusBadge tone={subscriptionStatusTone[t.subscription.status]}>
                      {subscriptionStatusLabels[t.subscription.status]}
                    </StatusBadge>
                    <Select value={t.subscription.planId} onValueChange={(v) => handleChangePlan(t, v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {plans.filter((p) => p.status !== "archived").map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1.5">
                      {t.subscription.status === "trialing" && (
                        <Button size="sm" variant="outline" onClick={() => handleExtendTrial(t)}>+14d trial</Button>
                      )}
                      {t.subscription.status !== "active" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatus(t, "active")}>Ativar</Button>
                      )}
                      {t.subscription.status !== "suspended" && t.subscription.status !== "canceled" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatus(t, "suspended")}>Suspender</Button>
                      )}
                      {t.subscription.status !== "canceled" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatus(t, "canceled")}>Cancelar</Button>
                      )}
                    </div>
                  </>
                ) : (
                  <StatusBadge tone="neutral">Sem assinatura</StatusBadge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// ---------------- PLANS ----------------
function PlansTab({ plans, features }: { plans: Plan[]; features: PlanFeature[] }) {
  if (plans.length === 0) {
    return <EmptyState icon={<Package className="h-6 w-6" />} title="Sem planos" description="Crie planos via migrations ou API." />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {plans.map((p) => (
        <PlanCard key={p.id} plan={p} features={features.filter((f) => f.planId === p.id)} highlight={p.isDefault} />
      ))}
    </div>
  );
}

// ---------------- FLAGS ----------------
function FlagsTab({ flags, onChange }: { flags: FeatureFlag[]; onChange: () => void }) {
  const { toast } = useToast();

  async function toggleFlag(flag: FeatureFlag) {
    const newValue = !(flag.value === true);
    try {
      await setFeatureFlagValue(flag.id, newValue);
      toast({ title: "Flag atualizada", description: `${flag.label}: ${newValue ? "ativa" : "inativa"}` });
      onChange();
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    }
  }

  if (flags.length === 0) {
    return <EmptyState icon={<Flag className="h-6 w-6" />} title="Nenhuma flag" description="Adicione flags via SQL." />;
  }

  const globals = flags.filter((f) => f.isGlobal);
  const tenantSpecific = flags.filter((f) => !f.isGlobal);

  return (
    <div className="space-y-4">
      <FlagSection title="Globais (todos os tenants)" flags={globals} onToggle={toggleFlag} />
      <FlagSection title="Por tenant" flags={tenantSpecific} onToggle={toggleFlag} />
    </div>
  );
}

function FlagSection({
  title,
  flags,
  onToggle,
}: {
  title: string;
  flags: FeatureFlag[];
  onToggle: (f: FeatureFlag) => void;
}) {
  if (flags.length === 0) return null;
  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</header>
      <ul className="divide-y divide-border/60">
        {flags.map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">
                <code className="text-[10px]">{f.flagKey}</code>
                {f.description && ` · ${f.description}`}
              </p>
            </div>
            {f.valueType === "boolean" ? (
              <Switch checked={f.value === true} onCheckedChange={() => onToggle(f)} />
            ) : (
              <code className="rounded bg-muted px-2 py-1 text-xs">{JSON.stringify(f.value)}</code>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------- TEMPLATES ----------------
function TemplatesTab({ templates }: { templates: SegmentTemplate[] }) {
  if (templates.length === 0) {
    return <EmptyState icon={<FileStack className="h-6 w-6" />} title="Sem templates" description="Adicione templates por segmento." />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <article key={t.id} className="surface-card p-4">
          <header className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{segmentLabels[t.segment]}</p>
              <h3 className="font-display text-base font-semibold">{t.name}</h3>
            </div>
            {t.isDefault && <StatusBadge tone="brand">padrão</StatusBadge>}
          </header>
          {t.description && <p className="mb-2 text-xs text-muted-foreground">{t.description}</p>}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver payload</summary>
            <pre className="mt-2 overflow-auto rounded bg-muted/50 p-2 text-[10px]">{JSON.stringify(t.payload, null, 2)}</pre>
          </details>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Periodicidade aplicável: {Object.values(billingPeriodLabels).join(", ")} · {formatPrice(0)}
          </p>
        </article>
      ))}
    </div>
  );
}
