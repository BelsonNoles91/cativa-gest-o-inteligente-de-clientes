/**
 * Configurações: avaliação pós-atendimento (link do Google Meu Negócio).
 */
import { useEffect, useState } from "react";
import { Save, Star } from "lucide-react";

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
  defaultReviewSettings,
  fetchReviewSettings,
  saveReviewSettings,
  type ReviewSettings as Rules,
} from "@/repositories/reviews";

export function ReviewSettings() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id ?? null;
  const [rules, setRules] = useState<Rules>(defaultReviewSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setLoading(true);
    fetchReviewSettings(tenantId)
      .then((r) => alive && setRules(r))
      .catch(() => alive && setRules(defaultReviewSettings))
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
      await saveReviewSettings(tenantId, rules, user?.id ?? null);
      toast({ title: "Avaliação salva" });
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
        <Star className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-semibold">Avaliação pós-atendimento</h2>
          <p className="text-sm text-muted-foreground">
            Depois do atendimento, a recepção envia o convite de avaliação pelo WhatsApp.
          </p>
        </div>
      </header>

      <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium">Convite ativo</p>
          <p className="text-xs text-muted-foreground">
            Mostra a fila de convites na tela Avaliações.
          </p>
        </div>
        <Switch
          checked={rules.enabled}
          onCheckedChange={(v) => set("enabled", v)}
          aria-label="Convite ativo"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="grurl">Link de avaliação do Google</Label>
        <Input
          id="grurl"
          value={rules.googleReviewUrl ?? ""}
          placeholder="https://g.page/r/..."
          onChange={(e) => set("googleReviewUrl", e.target.value)}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          No perfil do Google do seu negócio, use a opção de pedir avaliações e copie o link.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tpl">Mensagem</Label>
        <Textarea
          id="tpl"
          value={rules.messageTemplate ?? ""}
          onChange={(e) => set("messageTemplate", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Use {"{cliente}"}, {"{negocio}"} e {"{link}"} para preencher automaticamente.
        </p>
      </div>

      <Button onClick={() => void handleSave()} disabled={saving} className="min-h-[44px] gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </Card>
  );
}
