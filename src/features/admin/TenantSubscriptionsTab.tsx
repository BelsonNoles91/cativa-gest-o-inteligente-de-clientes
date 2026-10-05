import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  Loader2,
  Pencil,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/hooks/use-toast";
import {
  eventLabels,
  formatPrice,
  subscriptionStatusLabels,
  subscriptionStatusTone,
  type Plan,
  type SubscriptionEvent,
  type SubscriptionStatus,
} from "@/domain/billing";
import {
  listPlans,
  listSubscriptionEvents,
  manageTenantSubscription,
  type TenantWithSub,
} from "@/repositories/billing";

const STATUSES: SubscriptionStatus[] = ["trialing", "active", "overdue", "suspended", "canceled"];

const LIMITS = [
  { key: "max_units", label: "Unidades" },
  { key: "max_professionals", label: "Profissionais" },
  { key: "max_active_clients", label: "Clientes ativos" },
  { key: "max_storage_mb", label: "Armazenamento (MB)" },
  { key: "max_appointments_month", label: "Agendamentos/mês" },
] as const;

type LimitKey = (typeof LIMITS)[number]["key"];

interface FormState {
  planId: string;
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  discount: string;
  discountReason: string;
  limits: Record<LimitKey, string>;
  notes: string;
  reason: string;
}

const emptyLimits = (): Record<LimitKey, string> => ({
  max_units: "",
  max_professionals: "",
  max_active_clients: "",
  max_storage_mb: "",
  max_appointments_month: "",
});

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function initialForm(tenant: TenantWithSub, plans: Plan[]): FormState {
  const sub = tenant.subscription;
  const defaultPlan = plans.find((plan) => plan.isDefault) ?? plans[0];
  const overrides = sub?.overrideLimits ?? {};
  const limits = emptyLimits();
  for (const item of LIMITS) {
    const value = overrides[item.key];
    limits[item.key] = typeof value === "number" ? String(value) : "";
  }
  return {
    planId: sub?.planId ?? defaultPlan?.id ?? "",
    status: sub?.status ?? "trialing",
    trialStartedAt: toLocalInput(sub?.trialStartedAt ?? new Date().toISOString()),
    trialEndsAt: toLocalInput(sub?.trialEndsAt ?? null),
    currentPeriodStart: toLocalInput(sub?.currentPeriodStart ?? new Date().toISOString()),
    currentPeriodEnd: toLocalInput(sub?.currentPeriodEnd ?? null),
    discount: sub ? (sub.discountCents / 100).toFixed(2).replace(".", ",") : "0,00",
    discountReason: sub?.discountReason ?? "",
    limits,
    notes: sub?.notes ?? "",
    reason: "",
  };
}

export function TenantSubscriptionsTab({
  tenants,
  onChanged,
}: {
  tenants: TenantWithSub[];
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus | "all" | "none">("all");
  const [planId, setPlanId] = useState("all");
  const [editing, setEditing] = useState<TenantWithSub | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    listPlans()
      .then((rows) => {
        if (active) setPlans(rows.filter((plan) => plan.status !== "archived"));
      })
      .catch((error) => toast({ title: "Erro ao carregar planos", description: String(error), variant: "destructive" }))
      .finally(() => { if (active) setLoadingPlans(false); });
    return () => { active = false; };
  }, [toast]);

  const stats = useMemo(() => {
    const counts: Record<SubscriptionStatus | "none", number> = {
      trialing: 0, active: 0, overdue: 0, suspended: 0, canceled: 0, none: 0,
    };
    tenants.forEach((tenant) => { counts[tenant.subscription?.status ?? "none"] += 1; });
    return counts;
  }, [tenants]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return tenants.filter((tenant) => {
      const currentStatus = tenant.subscription?.status ?? "none";
      if (status !== "all" && currentStatus !== status) return false;
      if (planId !== "all" && tenant.subscription?.planId !== planId) return false;
      if (!query) return true;
      return tenant.name.toLocaleLowerCase("pt-BR").includes(query) || tenant.slug.toLocaleLowerCase("pt-BR").includes(query);
    });
  }, [planId, search, status, tenants]);

  async function openEditor(tenant: TenantWithSub) {
    setEditing(tenant);
    setForm(initialForm(tenant, plans));
    setEvents([]);
    if (!tenant.subscription) return;
    setLoadingEvents(true);
    try {
      setEvents(await listSubscriptionEvents(tenant.subscription.id));
    } catch (error) {
      toast({ title: "Erro ao carregar histórico", description: String(error), variant: "destructive" });
    } finally {
      setLoadingEvents(false);
    }
  }

  function validate(): string | null {
    if (!form?.planId) return "Escolha o plano.";
    if (!form.reason.trim()) return "Informe o motivo da alteração.";
    if (!toIso(form.currentPeriodStart)) return "Informe uma data válida para o início do ciclo.";
    if (form.status === "trialing") {
      const trialStart = toIso(form.trialStartedAt);
      const trialEnd = toIso(form.trialEndsAt);
      if (!trialStart) return "Informe uma data válida para o início do período de teste.";
      if (!trialEnd) return "Informe quando o período de teste termina.";
      if (new Date(trialEnd) <= new Date(trialStart)) return "O término do período de teste deve ser posterior ao início.";
    }
    const discount = Number(form.discount.replace(",", "."));
    if (!Number.isFinite(discount) || discount < 0) return "Informe um desconto válido.";
    const selectedPlan = plans.find((plan) => plan.id === form.planId);
    if (selectedPlan && Math.round(discount * 100) > selectedPlan.priceCents) return "O desconto não pode superar o valor do plano.";
    const currentPeriodStart = toIso(form.currentPeriodStart);
    const currentPeriodEnd = toIso(form.currentPeriodEnd);
    if (currentPeriodEnd && currentPeriodStart && new Date(currentPeriodEnd) <= new Date(currentPeriodStart)) {
      return "O término do ciclo deve ser posterior ao início.";
    }
    for (const item of LIMITS) {
      const value = form.limits[item.key];
      if (value && (!Number.isInteger(Number(value)) || Number(value) < 0)) return `${item.label}: use um número inteiro não negativo.`;
    }
    return null;
  }

  async function save() {
    if (!editing || !form) return;
    const validation = validate();
    if (validation) {
      toast({ title: "Revise os dados", description: validation, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const overrideLimits: Record<string, number> = {};
      for (const item of LIMITS) {
        const value = form.limits[item.key];
        if (value !== "") overrideLimits[item.key] = Number(value);
      }
      await manageTenantSubscription({
        tenantId: editing.id,
        planId: form.planId,
        status: form.status,
        trialStartedAt: toIso(form.trialStartedAt),
        trialEndsAt: toIso(form.trialEndsAt),
        currentPeriodStart: toIso(form.currentPeriodStart) ?? new Date().toISOString(),
        currentPeriodEnd: toIso(form.currentPeriodEnd),
        discountCents: Math.round(Number(form.discount.replace(",", ".")) * 100),
        discountReason: form.discountReason.trim() || null,
        overrideLimits,
        notes: form.notes.trim() || null,
        reason: form.reason.trim(),
      });
      await onChanged();
      toast({ title: editing.subscription ? "Assinatura atualizada" : "Assinatura criada", description: `${editing.name} já está com as novas condições.` });
      setConfirming(false);
      setEditing(null);
      setForm(null);
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: String((error as Error)?.message ?? error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function requestSave() {
    const validation = validate();
    if (validation) {
      toast({ title: "Revise os dados", description: validation, variant: "destructive" });
      return;
    }
    if (form?.status === "suspended" || form?.status === "canceled") setConfirming(true);
    else void save();
  }

  const selectedPlan = plans.find((plan) => plan.id === form?.planId);

  return (
    <div className="space-y-5" data-testid="tenant-subscriptions-tab">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Summary label="Em teste" value={stats.trialing} tone="brand" icon={<Clock3 className="h-4 w-4" />} />
        <Summary label="Ativas" value={stats.active} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Summary label="Em atraso" value={stats.overdue} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <Summary label="Suspensas" value={stats.suspended} tone="danger" icon={<AlertTriangle className="h-4 w-4" />} />
        <Summary label="Canceladas" value={stats.canceled} tone="neutral" icon={<CreditCard className="h-4 w-4" />} />
        <Summary label="Sem assinatura" value={stats.none} tone="neutral" icon={<CreditCard className="h-4 w-4" />} />
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estabelecimento" className="pl-9" aria-label="Buscar estabelecimento" />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger aria-label="Filtrar situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {STATUSES.map((item) => <SelectItem key={item} value={item}>{subscriptionStatusLabels[item]}</SelectItem>)}
            <SelectItem value="none">Sem assinatura</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger aria-label="Filtrar plano"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os planos</SelectItem>{plans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loadingPlans ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-6 w-6" />} title="Nenhuma assinatura encontrada" description="Ajuste os filtros para encontrar outro estabelecimento." />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <div className="hidden grid-cols-[minmax(220px,1.4fr)_120px_120px_150px_110px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
            <span>Estabelecimento</span><span>Plano</span><span>Situação</span><span>Próxima data</span><span className="text-right">Ação</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((tenant) => {
              const sub = tenant.subscription;
              const nextDate = sub?.status === "trialing" ? sub.trialEndsAt : sub?.currentPeriodEnd;
              return (
                <li key={tenant.id} className="grid gap-3 p-4 md:grid-cols-[minmax(220px,1.4fr)_120px_120px_150px_110px] md:items-center">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{tenant.name}</p><p className="truncate text-xs text-muted-foreground">{tenant.slug}</p></div>
                  <div><p className="text-sm font-medium">{tenant.planName ?? "Sem plano"}</p>{sub && sub.discountCents > 0 && <p className="text-xs text-success-foreground">-{formatPrice(sub.discountCents)}</p>}</div>
                  <div>{sub ? <StatusBadge tone={subscriptionStatusTone[sub.status]}>{subscriptionStatusLabels[sub.status]}</StatusBadge> : <StatusBadge tone="neutral">Sem assinatura</StatusBadge>}</div>
                  <div className="text-xs text-muted-foreground">{nextDate ? new Date(nextDate).toLocaleDateString("pt-BR") : "—"}{sub && Object.keys(sub.overrideLimits).length > 0 && <span className="mt-1 block">Limites próprios</span>}</div>
                  <Button variant="outline" size="sm" onClick={() => void openEditor(tenant)} className="w-full gap-1.5 md:w-auto"><Pencil className="h-3.5 w-3.5" /> Gerenciar</Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Dialog open={Boolean(editing && form)} onOpenChange={(open) => { if (!open && !saving) { setEditing(null); setForm(null); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl p-0">
          {editing && form && (
            <>
              <DialogHeader className="border-b px-5 py-4 pr-12">
                <DialogTitle>{editing.name}</DialogTitle>
                <DialogDescription>{editing.subscription ? "Gerencie plano, situação e condições individuais." : "Este estabelecimento ainda não possui assinatura. Defina as condições iniciais."}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 px-5 pb-2">
                <section className="space-y-3">
                  <SectionTitle icon={<CreditCard className="h-4 w-4" />} title="Plano e situação" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldLabel label="Plano"><Select value={form.planId} onValueChange={(value) => setForm({ ...form, planId: value })}><SelectTrigger><SelectValue placeholder="Escolha um plano" /></SelectTrigger><SelectContent>{plans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name} · {formatPrice(plan.priceCents)}</SelectItem>)}</SelectContent></Select></FieldLabel>
                    <FieldLabel label="Situação"><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as SubscriptionStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((item) => <SelectItem key={item} value={item}>{subscriptionStatusLabels[item]}</SelectItem>)}</SelectContent></Select></FieldLabel>
                  </div>
                  {selectedPlan && <p className="text-xs text-muted-foreground">Valor de tabela: {formatPrice(selectedPlan.priceCents)} · {selectedPlan.billingPeriod === "monthly" ? "mensal" : selectedPlan.billingPeriod}</p>}
                </section>

                <section className="space-y-3">
                  <SectionTitle icon={<CalendarDays className="h-4 w-4" />} title="Teste e ciclo" />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DateField label="Início do teste" value={form.trialStartedAt} onChange={(value) => setForm({ ...form, trialStartedAt: value })} />
                    <DateField label="Fim do teste" value={form.trialEndsAt} onChange={(value) => setForm({ ...form, trialEndsAt: value })} />
                    <DateField label="Início do ciclo" value={form.currentPeriodStart} onChange={(value) => setForm({ ...form, currentPeriodStart: value })} required />
                    <DateField label="Próxima renovação" value={form.currentPeriodEnd} onChange={(value) => setForm({ ...form, currentPeriodEnd: value })} />
                  </div>
                </section>

                <section className="space-y-3">
                  <SectionTitle icon={<SlidersHorizontal className="h-4 w-4" />} title="Condições personalizadas" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldLabel label="Desconto mensal (R$)"><Input inputMode="decimal" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} /></FieldLabel>
                    <FieldLabel label="Motivo do desconto"><Input value={form.discountReason} onChange={(event) => setForm({ ...form, discountReason: event.target.value })} placeholder="Ex.: condição comercial" /></FieldLabel>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {LIMITS.map((item) => <FieldLabel key={item.key} label={item.label}><Input type="number" min="0" step="1" value={form.limits[item.key]} onChange={(event) => setForm({ ...form, limits: { ...form.limits, [item.key]: event.target.value } })} placeholder="Do plano" /></FieldLabel>)}
                  </div>
                  <p className="text-xs text-muted-foreground">Deixe um limite vazio para usar o valor definido no plano.</p>
                </section>

                <section className="space-y-3">
                  <SectionTitle icon={<Pencil className="h-4 w-4" />} title="Registro administrativo" />
                  <FieldLabel label="Observação da assinatura"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Informação permanente sobre esta conta" /></FieldLabel>
                  <FieldLabel label="Motivo desta alteração"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Obrigatório; ficará registrado no histórico" /></FieldLabel>
                </section>

                <section className="space-y-3">
                  <SectionTitle icon={<History className="h-4 w-4" />} title="Histórico" />
                  {loadingEvents ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : events.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma alteração registrada até o momento.</p> : <ul className="divide-y rounded-md border">{events.map((event) => <li key={event.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[140px_1fr_auto]"><span className="font-medium">{eventLabels[event.eventType]}</span><span className="text-muted-foreground">{event.notes || "Sem observação"}</span><span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("pt-BR")}</span></li>)}</ul>}
                </section>
              </div>
              <DialogFooter className="sticky bottom-0 border-t bg-background px-5 py-4">
                <Button variant="outline" onClick={() => { setEditing(null); setForm(null); }} disabled={saving}>Cancelar</Button>
                <Button onClick={requestSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing.subscription ? "Salvar alterações" : "Criar assinatura"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{form?.status === "canceled" ? "Cancelar esta assinatura?" : "Suspender esta assinatura?"}</AlertDialogTitle><AlertDialogDescription>Essa mudança afeta o acesso do estabelecimento. O motivo e os valores anteriores ficarão registrados.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void save(); }} disabled={saving}>{saving ? "Salvando…" : "Confirmar alteração"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Summary({ label, value, tone, icon }: { label: string; value: number; tone: "brand" | "success" | "warning" | "danger" | "neutral"; icon: React.ReactNode }) {
  return <div className="rounded-md border bg-card p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{label}</span><StatusBadge tone={tone}>{icon}</StatusBadge></div><p className="mt-2 font-display text-2xl font-semibold">{value}</p></div>;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">{icon}{title}</h3>;
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function DateField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <FieldLabel label={label}><Input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} required={required} /></FieldLabel>;
}
