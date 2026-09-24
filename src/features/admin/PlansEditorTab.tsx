import { useEffect, useState } from "react";
import { Loader2, Save, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PLAN_FEATURE_CATALOG, isFeatureOn } from "@/domain/plan-catalog";

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
type Meta = { show_on_landing?: boolean; highlight?: boolean; landing_bullets?: string[]; [k: string]: unknown };

interface Draft {
  name: string;
  description: string;
  price: string;
  trialDays: string;
  maxProfessionals: string;
  maxUnits: string;
  maxClients: string;
  maxAppointments: string;
  features: Record<string, boolean>;
  showOnLanding: boolean;
  highlight: boolean;
  bullets: string;
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))));
const str = (n: number | null) => (n === null || n === undefined ? "" : String(n));

function toDraft(p: PlanRow): Draft {
  const meta = (p.metadata ?? {}) as Meta;
  const f = (p.features ?? {}) as Record<string, unknown>;
  return {
    name: p.name,
    description: p.description ?? "",
    price: (p.price_cents / 100).toFixed(2),
    trialDays: String(p.trial_days ?? 0),
    maxProfessionals: str(p.max_professionals),
    maxUnits: str(p.max_units),
    maxClients: str(p.max_active_clients),
    maxAppointments: str(p.max_appointments_month),
    features: Object.fromEntries(PLAN_FEATURE_CATALOG.map((c) => [c.key, isFeatureOn(f, c.key)])),
    showOnLanding: meta.show_on_landing === true,
    highlight: meta.highlight === true,
    bullets: (meta.landing_bullets ?? []).join("\n"),
  };
}

export function PlansEditorTab() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("plans").select("*").order("display_order");
    if (error) toast({ title: "Erro ao carregar planos", description: error.message, variant: "destructive" });
    const rows = data ?? [];
    setPlans(rows);
    setDrafts(Object.fromEntries(rows.map((p) => [p.id, toDraft(p)])));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const patch = (id: string, v: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...v } }));

  async function save(plan: PlanRow) {
    const d = drafts[plan.id];
    if (!d.name.trim()) return toast({ title: "Informe o nome do plano", variant: "destructive" });
    const price = Number(d.price.replace(",", "."));
    if (Number.isNaN(price) || price < 0) return toast({ title: "Preço inválido", variant: "destructive" });
    setSaving(plan.id);
    const features = { ...((plan.features ?? {}) as Record<string, unknown>), ...d.features };
    const metadata: Meta = {
      ...((plan.metadata ?? {}) as Meta),
      show_on_landing: d.showOnLanding,
      highlight: d.highlight,
      landing_bullets: d.bullets.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    const { error } = await supabase
      .from("plans")
      .update({
        name: d.name.trim(),
        description: d.description.trim() || null,
        price_cents: Math.round(price * 100),
        trial_days: Math.max(0, Math.round(Number(d.trialDays) || 0)),
        max_professionals: numOrNull(d.maxProfessionals),
        max_units: numOrNull(d.maxUnits),
        max_active_clients: numOrNull(d.maxClients),
        max_appointments_month: numOrNull(d.maxAppointments),
        features: features as Json,
        metadata: metadata as Json,
      })
      .eq("id", plan.id);
    // Mantém a tabela detalhada de funções coerente com o plano.
    if (!error) {
      const rows = PLAN_FEATURE_CATALOG.map((c, i) => ({
        plan_id: plan.id,
        feature_key: c.key,
        label: c.label,
        value_type: "boolean" as const,
        value: d.features[c.key] as Json,
        display_order: i,
      }));
      await supabase.from("plan_features").upsert(rows, { onConflict: "plan_id,feature_key" });
    }
    setSaving(null);
    if (error) return toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    toast({ title: "Plano salvo", description: "A página inicial já mostra a nova versão." });
    void load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Planos e funções</h2>
        <p className="text-sm text-muted-foreground">Ative ou desative cada função por plano. Ao salvar, o app dos clientes e a página inicial são atualizados na hora. Deixe um limite vazio para ilimitado.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const d = drafts[plan.id];
          if (!d) return null;
          return (
            <div key={plan.id} className="surface-card space-y-4 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{plan.name}</span>
                  <Badge variant="secondary">{plan.code}</Badge>
                  {plan.status !== "public" && <Badge variant="outline">{plan.status}</Badge>}
                </div>
                {d.highlight && <Star className="h-4 w-4 fill-accent text-accent" />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1"><Label>Nome</Label><Input value={d.name} onChange={(e) => patch(plan.id, { name: e.target.value })} /></div>
                <div className="col-span-2 space-y-1"><Label>Descrição</Label><Textarea rows={2} value={d.description} onChange={(e) => patch(plan.id, { description: e.target.value })} /></div>
                <div className="space-y-1"><Label>Preço mensal (R$)</Label><Input inputMode="decimal" value={d.price} onChange={(e) => patch(plan.id, { price: e.target.value })} /></div>
                <div className="space-y-1"><Label>Dias de teste</Label><Input inputMode="numeric" value={d.trialDays} onChange={(e) => patch(plan.id, { trialDays: e.target.value })} /></div>
                <div className="space-y-1"><Label>Profissionais</Label><Input inputMode="numeric" placeholder="Ilimitado" value={d.maxProfessionals} onChange={(e) => patch(plan.id, { maxProfessionals: e.target.value })} /></div>
                <div className="space-y-1"><Label>Unidades</Label><Input inputMode="numeric" placeholder="Ilimitado" value={d.maxUnits} onChange={(e) => patch(plan.id, { maxUnits: e.target.value })} /></div>
                <div className="space-y-1"><Label>Clientes ativos</Label><Input inputMode="numeric" placeholder="Ilimitado" value={d.maxClients} onChange={(e) => patch(plan.id, { maxClients: e.target.value })} /></div>
                <div className="space-y-1"><Label>Agendamentos/mês</Label><Input inputMode="numeric" placeholder="Ilimitado" value={d.maxAppointments} onChange={(e) => patch(plan.id, { maxAppointments: e.target.value })} /></div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funções</p>
                {PLAN_FEATURE_CATALOG.map((c) => (
                  <label key={c.key} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.description}</span>
                    </span>
                    <Switch checked={d.features[c.key]} onCheckedChange={(v) => patch(plan.id, { features: { ...d.features, [c.key]: v } })} />
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Página inicial</p>
                <label className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">Mostrar na página inicial<Switch checked={d.showOnLanding} onCheckedChange={(v) => patch(plan.id, { showOnLanding: v })} /></label>
                <label className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">Plano em destaque<Switch checked={d.highlight} onCheckedChange={(v) => patch(plan.id, { highlight: v })} /></label>
                <div className="space-y-1"><Label>Benefícios extras (um por linha)</Label><Textarea rows={2} value={d.bullets} onChange={(e) => patch(plan.id, { bullets: e.target.value })} /></div>
              </div>

              <Button className="w-full" disabled={saving === plan.id} onClick={() => void save(plan)}>
                {saving === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar plano
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
