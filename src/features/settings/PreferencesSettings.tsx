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

export function PreferencesSettings() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [buffer, setBuffer] = useState(0);
  const [policy, setPolicy] = useState("");

  useEffect(() => {
    if (!currentTenant) return;
    setLoading(true);
    supabase
      .from("tenant_settings")
      .select("appointment_buffer_minutes, cancellation_policy")
      .eq("tenant_id", currentTenant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBuffer(data.appointment_buffer_minutes ?? 0);
          setPolicy(data.cancellation_policy ?? "");
        }
        setLoading(false);
      });
  }, [currentTenant?.id]);

  const onSave = async () => {
    if (!currentTenant) return;
    setSaving(true);
    const { error } = await supabase.from("tenant_settings").upsert({
      tenant_id: currentTenant.id,
      appointment_buffer_minutes: buffer,
      cancellation_policy: policy || null,
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
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="h-11 rounded-xl bg-gradient-brand">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="mr-2 h-4 w-4" /> Salvar</>)}
        </Button>
      </div>
    </div>
  );
}
