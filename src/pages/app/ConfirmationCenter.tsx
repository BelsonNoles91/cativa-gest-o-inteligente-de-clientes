/**
import { useRealtimeRefresh } from "@/features/realtime/TenantRealtimeSync";
 * Página principal: Central de Confirmação.
 * Filas por etapa, ações rápidas, geração de fila a partir dos
 * agendamentos e dialog de ação por item.
 */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageActionCluster, PrimaryAction } from "@/components/shell/PageActionCluster";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useConfirmationCenter } from "@/features/confirmation/useConfirmationCenter";
import { QueueItemCard } from "@/features/confirmation/QueueItemCard";
import { ConfirmationActionDialog } from "@/features/confirmation/ConfirmationActionDialog";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useToast } from "@/hooks/use-toast";
import {
  channelLabels,
  stageDescriptions,
  stageLabels,
  templateStageLabels,
  type ConfirmationRule,
  type ConfirmationStage,
  type MessageChannel,
  type MessageTemplateStage,
} from "@/domain/confirmation";
import {
  createRule,
  createTemplate,
  deleteRule,
  deleteTemplate,
  listRules,
  listTemplates,
  updateRule,
  updateTemplate,
} from "@/repositories/confirmation";
import type { MessageTemplate } from "@/domain/confirmation";
import type { QueueItemHydrated } from "@/repositories/confirmation";

const STAGE_ORDER: ConfirmationStage[] = [
  "today",
  "tomorrow",
  "upcoming",
  "high_risk",
  "premium",
  "reschedule",
  "recovery",
];

type TemplateFormState = {
  name: string;
  stage: MessageTemplateStage;
  channel: MessageChannel;
  body: string;
  isDefault: boolean;
};

type RuleFormState = {
  name: string;
  stage: ConfirmationStage;
  hoursBeforeAppointment: string;
  basePriority: string;
  appliesToVip: boolean;
  appliesToHighRisk: boolean;
  appliesToProtocol: boolean;
  minAppointmentValueCents: string;
  skipIfAlreadyConfirmed: boolean;
  isActive: boolean;
};

const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  name: "",
  stage: "confirmation",
  channel: "whatsapp",
  body: "Olá {{cliente_primeiro_nome}}, confirmando seu horário de {{servico_nome}} em {{data}} às {{hora}}. Pode me confirmar, por favor?",
  isDefault: false,
};

const EMPTY_RULE_FORM: RuleFormState = {
  name: "",
  stage: "today",
  hoursBeforeAppointment: "24",
  basePriority: "50",
  appliesToVip: false,
  appliesToHighRisk: false,
  appliesToProtocol: false,
  minAppointmentValueCents: "",
  skipIfAlreadyConfirmed: true,
  isActive: true,
};

export default function ConfirmationCenter() {
  const center = useConfirmationCenter();
  useRealtimeRefresh(center.refresh);
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [active, setActive] = useState<QueueItemHydrated | null>(null);
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<ConfirmationRule[]>([]);
  const [templatesAdmin, setTemplatesAdmin] = useState<MessageTemplate[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);

  const handleOpen = (item: QueueItemHydrated) => {
    setActive(item);
    setOpen(true);
  };

  useEffect(() => {
    if (!currentTenant) return;
    let ignore = false;
    setLoadingAdmin(true);
    void (async () => {
      try {
        const [loadedRules, loadedTemplates] = await Promise.all([
          listRules(currentTenant.id),
          listTemplates(currentTenant.id),
        ]);
        if (!ignore) {
          setRules(loadedRules);
          setTemplatesAdmin(loadedTemplates);
        }
      } catch (error) {
        if (!ignore) {
          toast({
            title: "Erro ao carregar regras",
            description: error instanceof Error ? error.message : "Erro inesperado.",
            variant: "destructive",
          });
        }
      } finally {
        if (!ignore) setLoadingAdmin(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentTenant, toast]);

  const metrics = useMemo(() => {
    const pending = center.items.filter((item) => item.status === "pending").length;
    const inProgress = center.items.filter((item) => item.status === "in_progress").length;
    const followUp = center.items.filter((item) => item.status === "follow_up_scheduled").length;
    return { pending, inProgress, followUp };
  }, [center.items]);

  async function refreshAdmin() {
    if (!currentTenant) return;
    setLoadingAdmin(true);
    try {
      const [loadedRules, loadedTemplates] = await Promise.all([
        listRules(currentTenant.id),
        listTemplates(currentTenant.id),
      ]);
      setRules(loadedRules);
      setTemplatesAdmin(loadedTemplates);
      await center.refresh();
    } finally {
      setLoadingAdmin(false);
    }
  }

  async function handleCreateTemplate() {
    if (!currentTenant || !templateForm.name.trim() || !templateForm.body.trim()) return;
    setSavingTemplate(true);
    try {
      await createTemplate({
        tenantId: currentTenant.id,
        name: templateForm.name.trim(),
        body: templateForm.body.trim(),
        stage: templateForm.stage,
        channel: templateForm.channel,
        isDefault: templateForm.isDefault,
      });
      setTemplateForm(EMPTY_TEMPLATE_FORM);
      toast({ title: "Template criado" });
      await center.refresh();
    } catch (error) {
      toast({
        title: "Falha ao criar template",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleToggleTemplate(templateId: string, isActive: boolean) {
    try {
      await updateTemplate(templateId, { isActive: !isActive });
      await center.refresh();
    } catch (error) {
      toast({
        title: "Falha ao atualizar template",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    try {
      await deleteTemplate(templateId);
      await center.refresh();
    } catch (error) {
      toast({
        title: "Falha ao remover template",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleCreateRule() {
    if (!currentTenant || !ruleForm.name.trim()) return;
    setSavingRule(true);
    try {
      await createRule({
        tenantId: currentTenant.id,
        name: ruleForm.name.trim(),
        stage: ruleForm.stage,
        hoursBeforeAppointment: parseInt(ruleForm.hoursBeforeAppointment || "24", 10) || 24,
        basePriority: parseInt(ruleForm.basePriority || "50", 10) || 50,
        appliesToVip: ruleForm.appliesToVip,
        appliesToHighRisk: ruleForm.appliesToHighRisk,
        appliesToProtocol: ruleForm.appliesToProtocol,
        minAppointmentValueCents: ruleForm.minAppointmentValueCents.trim()
          ? parseInt(ruleForm.minAppointmentValueCents, 10)
          : null,
        skipIfAlreadyConfirmed: ruleForm.skipIfAlreadyConfirmed,
        isActive: ruleForm.isActive,
      });
      setRuleForm(EMPTY_RULE_FORM);
      toast({ title: "Regra criada" });
      await refreshAdmin();
    } catch (error) {
      toast({
        title: "Falha ao criar regra",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingRule(false);
    }
  }

  async function handleToggleRule(rule: ConfirmationRule) {
    try {
      await updateRule(rule.id, { isActive: !rule.isActive });
      await refreshAdmin();
    } catch (error) {
      toast({
        title: "Falha ao atualizar regra",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteRule(ruleId: string) {
    try {
      await deleteRule(ruleId);
      await refreshAdmin();
    } catch (error) {
      toast({
        title: "Falha ao remover regra",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Confirmação"
        description="Confirme atendimentos com velocidade. Mensagens prontas, sem WhatsApp API."
        icon={<CheckCircle2 className="h-5 w-5" />}
        actions={
          <PageActionCluster
            secondary={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: RefreshCcw,
                tooltip: center.loading ? "Atualizando…" : "Recarregar fila",
                loading: center.loading,
                onClick: () => void center.refresh(),
              },
            ]}
            primary={
              <PrimaryAction
                data-critical-action
                data-testid="confirmation-generate-cta"
                onClick={() => center.generate()}
                disabled={center.generating}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {center.generating ? "Gerando…" : "Gerar fila"}
              </PrimaryAction>
            }
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Itens abertos" value={String(center.totalOpen)} helper="Fila ativa do tenant" />
        <MetricCard label="Pendentes" value={String(metrics.pending)} helper="Ainda sem ação" />
        <MetricCard label="Em andamento / retorno" value={String(metrics.inProgress + metrics.followUp)} helper="Operação já tocando" />
      </div>

      {center.selectedIds.size > 0 && (
        <div className="sticky top-14 z-20 -mx-4 mb-4 flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground shadow-lg animate-in slide-in-from-top-4 md:mx-0 md:rounded-xl">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{center.selectedIds.size} selecionados</span>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-primary-foreground hover:bg-white/10" onClick={() => center.clearSelection()}>
              Limpar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="h-8 text-xs bg-white text-primary hover:bg-white/90" onClick={() => center.setBatchStatus("confirmed")}>
              Confirmar todos
            </Button>
          </div>
        </div>
      )}

      <Tabs
        value={center.stage}
        onValueChange={(v) => center.setStage(v as ConfirmationStage)}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {STAGE_ORDER.map((s) => {
            const count = center.counts[s] ?? 0;
            return (
              <TabsTrigger
                key={s}
                value={s}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {stageLabels[s]}
                {count > 0 && (
                  <span className="rounded-full bg-background/20 px-1.5 text-xs font-semibold">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <p className="text-sm text-muted-foreground">{stageDescriptions[center.stage]}</p>

        {center.loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : center.items.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Nenhum item nesta fila"
            description='Clique em "Gerar fila" para criar itens a partir dos próximos agendamentos.'
            action={
              <Button onClick={() => center.generate()} disabled={center.generating}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Gerar fila
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {center.items.map((item) => (
              <QueueItemCard 
                key={item.id} 
                item={item} 
                onOpen={handleOpen} 
                onConfirmQuick={(item) => center.setItemStatus(item.id, "confirmed")}
                selection={{
                  selectedIds: center.selectedIds,
                  toggleSelection: center.toggleSelection
                }}
              />
            ))}
          </div>

        )}
      </Tabs>

      <ConfirmationActionDialog
        item={active}
        open={open}
        onOpenChange={setOpen}
        templates={center.templates}
        center={center}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
            <CardDescription>
              Cadastre modelos por etapa e canal, com ativacao e desativacao manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome" required>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm((current) => ({ ...current, name: e.target.value }))} />
              </Field>
              <Field label="Etapa">
                <Select value={templateForm.stage} onValueChange={(value) => setTemplateForm((current) => ({ ...current, stage: value as MessageTemplateStage }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(templateStageLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Canal">
                <Select value={templateForm.channel} onValueChange={(value) => setTemplateForm((current) => ({ ...current, channel: value as MessageChannel }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(channelLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={templateForm.isDefault} onCheckedChange={(checked) => setTemplateForm((current) => ({ ...current, isDefault: checked }))} />
                Template padrão
              </label>
            </div>
            <Field label="Mensagem" required>
              <Textarea
                rows={5}
                value={templateForm.body}
                onChange={(e) => setTemplateForm((current) => ({ ...current, body: e.target.value }))}
              />
            </Field>
            <Button onClick={() => void handleCreateTemplate()} disabled={savingTemplate}>
              <Plus className="mr-2 h-4 w-4" /> Criar template
            </Button>

            <Separator />

            <div className="space-y-2">
              {loadingAdmin ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full" />
                  ))}
                </div>
              ) : templatesAdmin.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
              ) : (
                templatesAdmin.map((template) => (
                  <div key={template.id} className="rounded-2xl border border-border/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {templateStageLabels[template.stage]} • {channelLabels[template.channel]}
                        </p>
                      </div>
                      <StatusBadge tone={template.isActive ? "success" : "neutral"}>
                        {template.isActive ? "ativo" : "inativo"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{template.body}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void handleToggleTemplate(template.id, template.isActive)}>
                        {template.isActive ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDeleteTemplate(template.id)}>
                        <Trash2 className="mr-1.5 h-4 w-4" /> Remover
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regras de geração de fila</CardTitle>
            <CardDescription>
              Defina antecedência, prioridade e filtros operacionais por etapa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome" required>
                <Input value={ruleForm.name} onChange={(e) => setRuleForm((current) => ({ ...current, name: e.target.value }))} />
              </Field>
              <Field label="Etapa">
                <Select value={ruleForm.stage} onValueChange={(value) => setRuleForm((current) => ({ ...current, stage: value as ConfirmationStage }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGE_ORDER.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stageLabels[stage]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Horas antes">
                <Input type="number" value={ruleForm.hoursBeforeAppointment} onChange={(e) => setRuleForm((current) => ({ ...current, hoursBeforeAppointment: e.target.value }))} />
              </Field>
              <Field label="Prioridade base">
                <Input type="number" value={ruleForm.basePriority} onChange={(e) => setRuleForm((current) => ({ ...current, basePriority: e.target.value }))} />
              </Field>
              <Field label="Valor mínimo (centavos)">
                <Input type="number" value={ruleForm.minAppointmentValueCents} onChange={(e) => setRuleForm((current) => ({ ...current, minAppointmentValueCents: e.target.value }))} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InlineSwitch label="VIP" checked={ruleForm.appliesToVip} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, appliesToVip: checked }))} />
              <InlineSwitch label="Alto risco" checked={ruleForm.appliesToHighRisk} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, appliesToHighRisk: checked }))} />
              <InlineSwitch label="Protocolos" checked={ruleForm.appliesToProtocol} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, appliesToProtocol: checked }))} />
              <InlineSwitch label="Pular confirmados" checked={ruleForm.skipIfAlreadyConfirmed} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, skipIfAlreadyConfirmed: checked }))} />
              <InlineSwitch label="Regra ativa" checked={ruleForm.isActive} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, isActive: checked }))} />
            </div>

            <Button onClick={() => void handleCreateRule()} disabled={savingRule}>
              <Plus className="mr-2 h-4 w-4" /> Criar regra
            </Button>

            <Separator />

            {loadingAdmin ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))}
              </div>
            ) : rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="rounded-2xl border border-border/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stageLabels[rule.stage]} • {rule.hoursBeforeAppointment}h antes • prio {rule.basePriority}
                        </p>
                      </div>
                      <StatusBadge tone={rule.isActive ? "success" : "neutral"}>
                        {rule.isActive ? "ativa" : "inativa"}
                      </StatusBadge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {rule.appliesToVip ? <span>VIP</span> : null}
                      {rule.appliesToHighRisk ? <span>alto risco</span> : null}
                      {rule.appliesToProtocol ? <span>protocolos</span> : null}
                      {rule.minAppointmentValueCents ? <span>mín. {rule.minAppointmentValueCents}c</span> : null}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void handleToggleRule(rule)}>
                        {rule.isActive ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDeleteRule(rule.id)}>
                        <Trash2 className="mr-1.5 h-4 w-4" /> Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function InlineSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
