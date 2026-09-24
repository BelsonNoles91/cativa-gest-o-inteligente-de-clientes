/**
 * PreferencesSettings — preferências básicas (buffer entre atendimentos, política).
 */
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/features/tenant/TenantProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export function PreferencesSettings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [buffer, setBuffer] = useState(0);
  const [policy, setPolicy] = useState("");
  const [proSeesAll, setProSeesAll] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    supabase
      .from("tenant_settings")
      .select("appointment_buffer_minutes, cancellation_policy, professional_sees_all")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBuffer(data.appointment_buffer_minutes ?? 0);
          setPolicy(data.cancellation_policy ?? "");
          setProSeesAll(data.professional_sees_all ?? true);
        }
        setLoading(false);
      });
  }, [tenantId]);

  const onSave = async () => {
    if (!currentTenant) return;
    setSaving(true);
    const { error } = await supabase.from("tenant_settings").upsert({
      tenant_id: currentTenant.id,
      appointment_buffer_minutes: buffer,
      cancellation_policy: policy || null,
      professional_sees_all: proSeesAll,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar", { description: error.message }); return; }
    toast.success("Preferências salvas");
  };

  if (!currentTenant) return null;
  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="surface-card p-5 md:p-6 space-y-4">
      <div className="space-y-2 max-w-xs">
        <Label>Intervalo entre atendimentos (min)</Label>
        <Input type="number" min={0} max={180} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className="h-11 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label>Política de cancelamento</Label>
        <Textarea value={policy} onChange={(e) => setPolicy(e.target.value)} rows={5} className="rounded-xl" placeholder="Ex.: Cancelamentos com até 24h não geram custos…" />
      </div>
      <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
        <div className="space-y-1">
          <Label htmlFor="pro-sees-all">Profissionais veem a agenda e os clientes de toda a equipe</Label>
          <p className="text-sm text-muted-foreground">Desligado: cada profissional vê apenas os próprios atendimentos e os clientes que já atendeu.</p>
        </div>
        <Switch id="pro-sees-all" checked={proSeesAll} onCheckedChange={setProSeesAll} />
      </div>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="h-11 rounded-xl bg-gradient-brand">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="mr-2 h-4 w-4" /> Salvar</>)}
        </Button>
      </div>
    </div>
  );
}
