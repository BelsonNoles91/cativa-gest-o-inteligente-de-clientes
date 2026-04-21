/**
 * BusinessSettings — dados básicos do tenant (nome, segmento, fuso, moeda).
 */
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/features/tenant/TenantProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { segmentLabels, type TenantSegment } from "@/domain/tenant";

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Recife", "America/Fortaleza", "America/Cuiaba"];
const CURRENCIES = ["BRL", "USD", "EUR"];

export function BusinessSettings() {
  const { currentTenant, refresh } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [segment, setSegment] = useState<TenantSegment>("salao");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [currency, setCurrency] = useState("BRL");

  useEffect(() => {
    if (!currentTenant) return;
    setLoading(true);
    supabase
      .from("tenants")
      .select("name, segment, timezone, currency")
      .eq("id", currentTenant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.name);
          setSegment(data.segment);
          setTimezone(data.timezone);
          setCurrency(data.currency);
        }
        setLoading(false);
      });
  }, [currentTenant?.id]);

  const onSave = async () => {
    if (!currentTenant) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({ name, segment, timezone, currency })
      .eq("id", currentTenant.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Dados atualizados");
    await refresh();
  };

  if (!currentTenant) return null;
  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="surface-card p-5 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Nome do estabelecimento</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Segmento</Label>
          <Select value={segment} onValueChange={(v) => setSegment(v as TenantSegment)}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(segmentLabels) as TenantSegment[]).map((s) => <SelectItem key={s} value={s}>{segmentLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fuso horário</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Moeda</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onSave} disabled={saving} className="h-11 rounded-xl bg-gradient-brand">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="mr-2 h-4 w-4" /> Salvar alterações</>)}
        </Button>
      </div>
    </div>
  );
}
