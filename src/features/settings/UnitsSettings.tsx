/**
 * UnitsSettings — listar, criar e editar unidades.
 */
import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";

interface UnitRow {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  city: string | null;
  phone: string | null;
}

export function UnitsSettings() {
  const { currentTenant, refresh } = useTenant();
  const { limits, usage, hasFeature } = useTenantBilling();
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!currentTenant) return;
    setLoading(true);
    const { data } = await supabase
      .from("units")
      .select("id, name, is_default, is_active, city, phone")
      .eq("tenant_id", currentTenant.id)
      .order("is_default", { ascending: false });
    setUnits((data ?? []) as UnitRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [currentTenant?.id]);

  const onCreate = async () => {
    if (!currentTenant || !name.trim()) return;
    if (!hasFeature("multi_unit") && usage.unitsCount >= 1) {
      toast.error("Seu plano não permite múltiplas unidades.");
      return;
    }
    if (limits?.maxUnits !== null && limits?.maxUnits !== undefined && usage.unitsCount >= limits.maxUnits) {
      toast.error("Limite de unidades atingido", { description: "Ajuste o plano ou os overrides antes de criar outra unidade." });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("units").insert({
      tenant_id: currentTenant.id,
      name: name.trim(),
      city: city.trim() || null,
      phone: phone.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao criar unidade", { description: error.message }); return; }
    toast.success("Unidade criada");
    setName(""); setCity(""); setPhone("");
    setOpen(false);
    await load();
    await refresh();
  };

  const onSetDefault = async (id: string) => {
    if (!currentTenant) return;
    // remover default das outras
    await supabase.from("units").update({ is_default: false }).eq("tenant_id", currentTenant.id);
    const { error } = await supabase.from("units").update({ is_default: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Unidade padrão atualizada");
    await load();
  };

  const onToggleActive = async (u: UnitRow) => {
    const { error } = await supabase.from("units").update({ is_active: !u.is_active }).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  if (!currentTenant) return null;

  return (
    <div className="space-y-4" data-testid="units-settings">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="units-count-label">{units.length} {units.length === 1 ? "unidade" : "unidades"}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="rounded-xl bg-gradient-brand"
              data-testid="units-create-trigger"
              disabled={
                (!hasFeature("multi_unit") && usage.unitsCount >= 1) ||
                (limits?.maxUnits !== null && limits?.maxUnits !== undefined && usage.unitsCount >= limits.maxUnits)
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Nova unidade
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova unidade</DialogTitle>
              <DialogDescription>
                Cadastre uma nova unidade operacional para organizar agenda, equipe e atendimento.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" placeholder="Ex.: Filial Jardins" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Cidade</Label><Input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-xl" /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={onCreate} disabled={saving || !name.trim()} className="rounded-xl bg-gradient-brand">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar unidade"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !hasFeature("multi_unit") && usage.unitsCount >= 1 ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground" data-testid="units-limit-warning">
          Seu plano atual permite apenas uma unidade. Faça upgrade para liberar operação multi-unidade.
        </div>
      ) : limits?.maxUnits !== null && limits?.maxUnits !== undefined && usage.unitsCount >= limits.maxUnits ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground" data-testid="units-limit-warning">
          Limite de unidades atingido. Ajuste o plano ou os overrides antes de criar outra unidade.
        </div>
      ) : units.length === 0 ? (
        <EmptyState icon={<MapPin className="h-6 w-6" />} title="Nenhuma unidade" description="Cadastre sua primeira unidade para começar a operar." />
      ) : (
        <div className="surface-card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {units.map((u) => (
              <li key={u.id} className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary"><MapPin className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    {u.is_default && <StatusBadge tone="brand" dot={false} className="text-[10px]">Padrão</StatusBadge>}
                    {!u.is_active && <StatusBadge tone="neutral" dot={false} className="text-[10px]">Inativa</StatusBadge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{[u.city, u.phone].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {!u.is_default && (
                  <Button variant="ghost" size="sm" onClick={() => onSetDefault(u.id)} className="text-xs"><Star className="mr-1 h-3.5 w-3.5" /> Tornar padrão</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onToggleActive(u)} className="text-xs">
                  {u.is_active ? "Desativar" : "Ativar"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
