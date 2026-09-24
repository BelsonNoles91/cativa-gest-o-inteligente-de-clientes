/**
 * Console de Feature Flags & Limites (Super Admin).
 *
 * Diferente da aba Flags clássica, este console:
 * - usa RPCs com auditoria (admin_upsert_feature_flag, admin_toggle_feature_flag, ...)
 * - mostra impacto estimado (tenants/usuários afetados) antes de aplicar
 * - permite ajuste rápido de limites de plano com confirmação
 * - permite override por tenant com pré-visualização do delta
 *
 * Mobile-first.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Flag, Globe, Loader2, Pencil, Plus, RefreshCw, Shield, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/hooks/use-toast";
import {
  listAllFeatureFlags,
  listPlans,
  listTenantsWithSubscriptions,
  type TenantWithSub,
} from "@/repositories/billing";
import type { FeatureFlag, Plan } from "@/domain/billing";

type ImpactInfo = {
  flag_key?: string;
  has_global_flag?: boolean;
  tenant_overrides_count?: number;
  estimated_affected_tenants?: number;
  estimated_affected_users?: number;
  plan_id?: string;
  total_subscriptions?: number;
  active_or_trial?: number;
  tenants_with_override?: number;
};

const VALUE_TYPES = ["boolean", "number", "string", "json"] as const;

export function FeatureFlagsConsole({ mode = "platform" }: { mode?: "platform" | "accounts" }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<TenantWithSub[]>([]);
  const [scopeFilter, setScopeFilter] = useState<"all" | "global" | "tenant">("all");
  const [search, setSearch] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const [f, p, t] = await Promise.all([
        listAllFeatureFlags(),
        listPlans(),
        listTenantsWithSubscriptions(),
      ]);
      setFlags(f);
      setPlans(p);
      setTenants(t);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filteredFlags = useMemo(() => {
    return flags.filter((flag) => {
      if (mode === "platform" && !flag.isGlobal) return false;
      if (mode === "accounts" && flag.isGlobal) return false;
      if (scopeFilter === "global" && !flag.isGlobal) return false;
      if (scopeFilter === "tenant" && flag.isGlobal) return false;
      if (search && !flag.flagKey.toLowerCase().includes(search.toLowerCase()) && !flag.label.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [flags, mode, scopeFilter, search]);

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {mode === "platform" ? "Recursos e limites globais" : "Ajustes por estabelecimento"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {mode === "platform"
              ? "Configure recursos da plataforma, limites dos planos e veja o impacto antes de aplicar."
              : "Personalize recursos somente para a conta selecionada, sem alterar os demais estabelecimentos."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void reload()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="flags" className="space-y-4">
        {mode === "platform" && (
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="flags"><Flag className="mr-1.5 h-3.5 w-3.5" />Recursos globais</TabsTrigger>
            <TabsTrigger value="limits"><Shield className="mr-1.5 h-3.5 w-3.5" />Limites dos planos</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="flags" className="space-y-4">
          <FlagsConsolePanel
            flags={filteredFlags}
            tenants={tenants}
            search={search}
            onSearch={setSearch}
            scope={scopeFilter}
            onScope={setScopeFilter}
            showScopeFilter={false}
            defaultScope={mode === "accounts" ? "tenant" : "global"}
            onChanged={reload}
            toast={toast}
          />
        </TabsContent>

        {mode === "platform" && (
          <TabsContent value="limits" className="space-y-4">
            <LimitsConsolePanel plans={plans} tenants={tenants} onChanged={reload} toast={toast} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============================================================================
// Flags panel
// ============================================================================
function FlagsConsolePanel({
  flags,
  tenants,
  search,
  onSearch,
  scope,
  onScope,
  showScopeFilter,
  defaultScope,
  onChanged,
  toast,
}: {
  flags: FeatureFlag[];
  tenants: TenantWithSub[];
  search: string;
  onSearch: (v: string) => void;
  scope: "all" | "global" | "tenant";
  onScope: (v: "all" | "global" | "tenant") => void;
  showScopeFilter: boolean;
  defaultScope: "global" | "tenant";
  onChanged: () => Promise<void>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<{ flag: FeatureFlag; nextEnabled: boolean; impact: ImpactInfo | null } | null>(null);
  const [deleting, setDeleting] = useState<FeatureFlag | null>(null);

  async function handleToggle(flag: FeatureFlag, nextEnabled: boolean) {
    // Carregar impacto antes de aplicar
    const { data, error } = await supabase.rpc("admin_feature_flag_impact", { _flag_key: flag.flagKey });
    if (error) {
      toast({ title: "Erro ao calcular impacto", description: error.message, variant: "destructive" });
      return;
    }
    setConfirm({ flag, nextEnabled, impact: (data as ImpactInfo) ?? null });
  }

  async function applyToggle() {
    if (!confirm) return;
    const { error } = await supabase.rpc("admin_toggle_feature_flag", {
      _flag_id: confirm.flag.id,
      _enabled: confirm.nextEnabled,
    });
    if (error) {
      toast({ title: "Erro ao alternar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: confirm.nextEnabled ? "Recurso ativado" : "Recurso desativado" });
    void queryClient.invalidateQueries({ queryKey: ["system-flags"] });
    setConfirm(null);
    await onChanged();
  }

  async function applyDelete() {
    if (!deleting) return;
    const { error } = await supabase.rpc("admin_delete_feature_flag", { _flag_id: deleting.id });
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Flag removida" });
    setDeleting(null);
    await onChanged();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por chave ou rótulo..."
          className="min-w-[200px] flex-1"
        />
        {showScopeFilter && (
          <Select value={scope} onValueChange={(v) => onScope(v as typeof scope)}>
            <SelectTrigger className="w-full min-w-0 sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos escopos</SelectItem>
              <SelectItem value="global">Globais</SelectItem>
              <SelectItem value="tenant">Por tenant</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" />Novo
        </Button>
      </div>

      {flags.length === 0 ? (
        <EmptyState icon={<Flag className="h-6 w-6" />} title="Nenhuma flag" description="Crie a primeira para começar." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {flags.map((flag) => {
            const isBoolean = flag.valueType === "boolean";
            const enabled = flag.value === true || flag.value === "true";
            const tenantName = flag.tenantId ? tenants.find((t) => t.id === flag.tenantId)?.name : null;
            return (
              <div key={flag.id} className="surface-card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{flag.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{flag.flagKey}</p>
                  </div>
                  <Badge variant={flag.isGlobal ? "default" : "secondary"} className="shrink-0">
                    {flag.isGlobal ? <><Globe className="mr-1 h-3 w-3" />Global</> : <><Users className="mr-1 h-3 w-3" />{tenantName ?? "Tenant"}</>}
                  </Badge>
                </div>
                {flag.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{flag.description}</p>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  {isBoolean ? (
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={enabled} onCheckedChange={(v) => void handleToggle(flag, v)} />
                      {enabled ? "Ativo" : "Inativo"}
                    </label>
                  ) : (
                    <code className="truncate rounded bg-muted px-2 py-1 text-xs">{JSON.stringify(flag.value)}</code>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(flag); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(flag)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FlagEditorDialog
        open={open}
        onClose={() => setOpen(false)}
        flag={editing}
        tenants={tenants}
        defaultScope={defaultScope}
        onSaved={async () => {
          setOpen(false);
          await onChanged();
        }}
        toast={toast}
      />

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.nextEnabled ? "Ativar recurso?" : "Desativar recurso?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>{confirm?.flag.label}</strong> ({confirm?.flag.flagKey})
                </p>
                {confirm?.impact && (
                  <div className="rounded-lg border border-border/60 bg-muted/50 p-3 text-xs">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Impacto estimado
                    </p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>Flag global definida: <strong>{confirm.impact.has_global_flag ? "sim" : "não"}</strong></li>
                      <li>Overrides por tenant: <strong>{confirm.impact.tenant_overrides_count ?? 0}</strong></li>
                      <li>Tenants alcançados: <strong>{confirm.impact.estimated_affected_tenants ?? 0}</strong></li>
                      <li>Usuários alcançados: <strong>{confirm.impact.estimated_affected_users ?? 0}</strong></li>
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">A ação é registrada em audit logs.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyToggle()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover flag {deleting?.flagKey}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e será registrada em auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyDelete()}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FlagEditorDialog({
  open,
  onClose,
  flag,
  tenants,
  defaultScope,
  onSaved,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  flag: FeatureFlag | null;
  tenants: TenantWithSub[];
  defaultScope: "global" | "tenant";
  onSaved: () => Promise<void>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [flagKey, setFlagKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [valueType, setValueType] = useState<typeof VALUE_TYPES[number]>("boolean");
  const [valueRaw, setValueRaw] = useState("false");
  const [scope, setScope] = useState<"global" | "tenant">("global");
  const [tenantId, setTenantId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (flag) {
        setFlagKey(flag.flagKey);
        setLabel(flag.label);
        setDescription(flag.description ?? "");
        setValueType(flag.valueType);
        setValueRaw(typeof flag.value === "string" ? flag.value : JSON.stringify(flag.value));
        setScope(flag.isGlobal ? "global" : "tenant");
        setTenantId(flag.tenantId ?? "");
      } else {
        setFlagKey("");
        setLabel("");
        setDescription("");
        setValueType("boolean");
        setValueRaw("false");
        setScope(defaultScope);
        setTenantId("");
      }
    }
  }, [open, flag, defaultScope]);

  async function handleSave() {
    if (!flagKey.trim() || !label.trim()) {
      toast({ title: "Preencha chave e rótulo", variant: "destructive" });
      return;
    }
    if (scope === "tenant" && !tenantId) {
      toast({ title: "Selecione um tenant", variant: "destructive" });
      return;
    }
    let parsed: unknown = valueRaw;
    try {
      if (valueType === "boolean") parsed = valueRaw === "true" || valueRaw === "1";
      else if (valueType === "number") parsed = Number(valueRaw);
      else if (valueType === "json") parsed = JSON.parse(valueRaw);
    } catch (err) {
      toast({ title: "Valor inválido", description: String(err), variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("admin_upsert_feature_flag", {
      _flag_key: flagKey.trim(),
      _label: label.trim(),
      _value: parsed as never,
      _value_type: valueType,
      _description: description.trim() || null,
      _tenant_id: scope === "tenant" ? tenantId : null,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: flag ? "Flag atualizada" : "Flag criada" });
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{flag ? "Editar flag" : "Nova flag"}</DialogTitle>
          <DialogDescription>Recursos podem ser globais ou específicos de um tenant.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Chave</Label>
            <Input value={flagKey} onChange={(e) => setFlagKey(e.target.value)} placeholder="ex: portal_advanced_booking" />
          </div>
          <div className="grid gap-1.5">
            <Label>Rótulo</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Agendamento avançado no portal" />
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={valueType} onValueChange={(v) => setValueType(v as typeof VALUE_TYPES[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Escopo</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "global" | "tenant")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="tenant">Por tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {scope === "tenant" && (
            <div className="grid gap-1.5">
              <Label>Tenant</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Valor</Label>
            {valueType === "boolean" ? (
              <Select value={valueRaw} onValueChange={setValueRaw}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">true</SelectItem>
                  <SelectItem value="false">false</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Textarea value={valueRaw} onChange={(e) => setValueRaw(e.target.value)} rows={3} className="font-mono text-xs" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Limits panel
// ============================================================================
function LimitsConsolePanel({
  plans,
  tenants,
  onChanged,
  toast,
}: {
  plans: Plan[];
  tenants: TenantWithSub[];
  onChanged: () => Promise<void>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    maxUnits: "",
    maxProfessionals: "",
    maxActiveClients: "",
    maxStorageMb: "",
  });
  const [impact, setImpact] = useState<ImpactInfo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function openPlan(p: Plan) {
    setSelectedPlan(p);
    setForm({
      maxUnits: p.maxUnits?.toString() ?? "",
      maxProfessionals: p.maxProfessionals?.toString() ?? "",
      maxActiveClients: p.maxActiveClients?.toString() ?? "",
      maxStorageMb: p.maxStorageMb?.toString() ?? "",
    });
    setImpact(null);
  }

  async function previewImpact() {
    if (!selectedPlan) return;
    const { data, error } = await supabase.rpc("admin_plan_limit_impact", { _plan_id: selectedPlan.id });
    if (error) {
      toast({ title: "Erro ao calcular impacto", description: error.message, variant: "destructive" });
      return;
    }
    setImpact((data as ImpactInfo) ?? null);
    setConfirmOpen(true);
  }

  async function applyChange() {
    if (!selectedPlan) return;
    const parse = (v: string) => (v.trim() === "" ? null : parseInt(v, 10));
    const { error } = await supabase.rpc("admin_update_plan_limits", {
      _plan_id: selectedPlan.id,
      _max_units: parse(form.maxUnits),
      _max_professionals: parse(form.maxProfessionals),
      _max_active_clients: parse(form.maxActiveClients),
      _max_storage_mb: parse(form.maxStorageMb),
    });
    if (error) {
      toast({ title: "Erro ao salvar limites", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Limites do plano atualizados" });
    setConfirmOpen(false);
    await onChanged();
    setSelectedPlan(null);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const subs = tenants.filter((t) => t.subscription?.planId === p.id).length;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openPlan(p)}
              className={`surface-card text-left transition hover:border-primary ${selectedPlan?.id === p.id ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-base font-semibold">{p.name}</p>
                  <Badge variant="secondary">{subs} tenants</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.code}</p>
                <ul className="space-y-1 text-xs">
                  <li>Unidades: <strong>{p.maxUnits ?? "∞"}</strong></li>
                  <li>Profissionais: <strong>{p.maxProfessionals ?? "∞"}</strong></li>
                  <li>Clientes ativos: <strong>{p.maxActiveClients ?? "∞"}</strong></li>
                  <li>Storage: <strong>{p.maxStorageMb ? `${p.maxStorageMb} MB` : "∞"}</strong></li>
                </ul>
              </div>
            </button>
          );
        })}
      </div>

      <div className="surface-card space-y-3 p-4">
        <h3 className="font-display text-base font-semibold">
          {selectedPlan ? `Editar limites · ${selectedPlan.name}` : "Selecione um plano"}
        </h3>
        {selectedPlan ? (
          <>
            <p className="text-xs text-muted-foreground">
              Deixe vazio para ilimitado. Mudanças afetam todos os tenants nesse plano.
            </p>
            <div className="grid gap-2">
              <Label className="text-xs">Unidades</Label>
              <Input value={form.maxUnits} onChange={(e) => setForm((f) => ({ ...f, maxUnits: e.target.value }))} placeholder="Ilimitado" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Profissionais</Label>
              <Input value={form.maxProfessionals} onChange={(e) => setForm((f) => ({ ...f, maxProfessionals: e.target.value }))} placeholder="Ilimitado" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Clientes ativos</Label>
              <Input value={form.maxActiveClients} onChange={(e) => setForm((f) => ({ ...f, maxActiveClients: e.target.value }))} placeholder="Ilimitado" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Storage (MB)</Label>
              <Input value={form.maxStorageMb} onChange={(e) => setForm((f) => ({ ...f, maxStorageMb: e.target.value }))} placeholder="Ilimitado" />
            </div>
            <Button onClick={() => void previewImpact()} className="w-full">
              Validar impacto e salvar
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Escolha um plano à esquerda para ajustar os limites.</p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de limites</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-sm">Plano: <strong>{selectedPlan?.name}</strong></p>
                {impact && (
                  <div className="rounded-lg border border-border/60 bg-muted/50 p-3 text-xs">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Impacto estimado
                    </p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>Assinaturas no plano: <strong>{impact.total_subscriptions ?? 0}</strong></li>
                      <li>Ativas/Em trial: <strong>{impact.active_or_trial ?? 0}</strong></li>
                      <li>Com override de limite: <strong>{impact.tenants_with_override ?? 0}</strong></li>
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  A mudança é registrada em auditoria com valores antes/depois.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyChange()}>Aplicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
