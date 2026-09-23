/**
 * Configurações: fidelidade por pontos.
 */
import { useEffect, useState } from "react";
import { Gift, Save } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  defaultLoyaltySettings,
  fetchLoyaltySettings,
  saveLoyaltySettings,
  type LoyaltySettings as Rules,
} from "@/repositories/loyalty";

export function LoyaltySettings() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id ?? null;
  const [rules, setRules] = useState<Rules>(defaultLoyaltySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setLoading(true);
    fetchLoyaltySettings(tenantId)
      .then((r) => alive && setRules(r))
      .catch(() => alive && setRules(defaultLoyaltySettings))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tenantId]);

  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => setRules((r) => ({ ...r, [k]: v }));

  async function handleSave() {
    if (!tenantId) return;
    setSaving(true);
    try {
      await saveLoyaltySettings(tenantId, rules, user?.id ?? null);
      toast({ title: "Fidelidade salva" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast({ title: "Não foi possível salvar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-80 rounded-2xl" />;

  return (
    <Card className="space-y-4 rounded-2xl p-4">
      <header className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-semibold">Fidelidade</h2>
          <p className="text-sm text-muted-foreground">
            Cada atendimento concluído vira pontos para o cliente trocar por uma recompensa.
          </p>
        </div>
      </header>

      <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium">Programa ativo</p>
          <p className="text-xs text-muted-foreground">
            Quando ligado, o cliente vê os pontos no portal.
          </p>
        </div>
        <Switch
          checked={rules.enabled}
          onCheckedChange={(v) => set("enabled", v)}
          aria-label="Programa ativo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ppv">Pontos por visita</Label>
          <Input
            id="ppv"
            type="number"
            min={0}
            value={rules.pointsPerVisit}
            onChange={(e) => set("pointsPerVisit", Math.max(0, Number(e.target.value) || 0))}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ppr">Pontos por real gasto</Label>
          <Input
            id="ppr"
            type="number"
            min={0}
            value={rules.pointsPerReal}
            onChange={(e) => set("pointsPerReal", Math.max(0, Number(e.target.value) || 0))}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="thr">Pontos para a recompensa</Label>
          <Input
            id="thr"
            type="number"
            min={1}
            value={rules.rewardThresholdPoints}
            onChange={(e) =>
              set("rewardThresholdPoints", Math.max(1, Number(e.target.value) || 1))
            }
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reward">Recompensa</Label>
        <Textarea
          id="reward"
          value={rules.rewardDescription ?? ""}
          placeholder="Ex.: um atendimento simples por conta da casa"
          onChange={(e) => set("rewardDescription", e.target.value)}
        />
      </div>

      <Button onClick={() => void handleSave()} disabled={saving} className="min-h-[44px] gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </Card>
  );
}
