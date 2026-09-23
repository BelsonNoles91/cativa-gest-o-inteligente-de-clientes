/**
 * Configurações: regras de autoatendimento do cliente.
 * Define o que o cliente pode fazer sozinho (confirmar, remarcar, cancelar)
 * e os limites de segurança que evitam abusos.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  fetchSelfServiceRules,
  saveSelfServiceRules,
} from "@/repositories/self-service-rules";
import { defaultSelfServiceRules, type SelfServiceRules } from "@/domain/self-service";

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="h-11"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

export function SelfServiceSettings() {
  const { currentTenant } = useTenant();
  const activeTenantId = currentTenant?.id ?? null;
  const { toast } = useToast();
  const [rules, setRules] = useState<SelfServiceRules>(defaultSelfServiceRules);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!activeTenantId) return;
    setLoading(true);
    fetchSelfServiceRules(activeTenantId)
      .then((r) => alive && setRules(r))
      .catch(() => alive && setRules(defaultSelfServiceRules))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [activeTenantId]);

  const set = <K extends keyof SelfServiceRules>(key: K, value: SelfServiceRules[K]) =>
    setRules((r) => ({ ...r, [key]: value }));

  async function handleSave() {
    if (!activeTenantId) return;
    setSaving(true);
    try {
      await saveSelfServiceRules(activeTenantId, rules);
      toast({ title: "Regras salvas" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast({ title: "Não foi possível salvar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <header className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-semibold">
              O que o cliente pode fazer sozinho
            </h2>
            <p className="text-sm text-muted-foreground">
              Vale para o portal do cliente e para o link público.
            </p>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <ToggleRow
            label="Confirmar presença"
            hint="O cliente confirma o próprio horário."
            checked={rules.allowConfirm}
            onChange={(v) => set("allowConfirm", v)}
          />
          <ToggleRow
            label="Remarcar"
            hint="O cliente escolhe outro horário livre."
            checked={rules.allowReschedule}
            onChange={(v) => set("allowReschedule", v)}
          />
          <ToggleRow
            label="Cancelar"
            hint="O cliente libera o horário sozinho."
            checked={rules.allowCancel}
            onChange={(v) => set("allowCancel", v)}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <header>
          <h2 className="font-display text-lg font-semibold">Limites de segurança</h2>
          <p className="text-sm text-muted-foreground">
            Use 0 para não aplicar o limite. As regras são checadas no servidor.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <NumberField
            id="min-cancel"
            label="Antecedência mínima para cancelar (horas)"
            hint="Depois desse prazo, só falando com o estabelecimento."
            value={rules.minHoursToCancel}
            onChange={(n) => set("minHoursToCancel", n)}
          />
          <NumberField
            id="min-resched"
            label="Antecedência mínima para remarcar (horas)"
            hint="Evita trocas de última hora que deixam a agenda vazia."
            value={rules.minHoursToReschedule}
            onChange={(n) => set("minHoursToReschedule", n)}
          />
          <NumberField
            id="max-resched"
            label="Remarcações por horário"
            hint="Quantas vezes o mesmo agendamento pode ser adiado."
            value={rules.maxReschedulesPerAppointment}
            onChange={(n) => set("maxReschedulesPerAppointment", n)}
          />
          <NumberField
            id="max-cancel"
            label="Cancelamentos em 30 dias"
            hint="Ao atingir, o autoatendimento é suspenso para esse cliente."
            value={rules.maxCancellationsPer30d}
            onChange={(n) => set("maxCancellationsPer30d", n)}
          />
          <NumberField
            id="max-noshow"
            label="Faltas em 90 dias"
            hint="Ao atingir, o cliente precisa falar com a recepção."
            value={rules.maxNoShowsPer90d}
            onChange={(n) => set("maxNoShowsPer90d", n)}
          />
          <NumberField
            id="block-days"
            label="Dias de suspensão após passar do limite"
            hint="Período em que o cliente marca apenas pela recepção."
            value={rules.blockDaysAfterLimit}
            onChange={(n) => set("blockDaysAfterLimit", n)}
          />
        </div>

        <ToggleRow
          label="Pedir o motivo do cancelamento"
          hint="Ajuda a entender por que os horários são liberados."
          checked={rules.requireCancelReason}
          onChange={(v) => set("requireCancelReason", v)}
        />

        <div className="space-y-1.5">
          <Label htmlFor="policy-note">Aviso mostrado ao cliente (texto livre)</Label>
          <Textarea
            id="policy-note"
            rows={3}
            value={rules.policyNote ?? ""}
            onChange={(e) => set("policyNote", e.target.value || null)}
            placeholder="Escreva com suas palavras o que o cliente precisa saber ao remarcar ou cancelar."
          />
          <p className="text-xs text-muted-foreground">
            Esse texto aparece na agenda do cliente e na confirmação de cancelamento.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Salvando…" : "Salvar regras"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
