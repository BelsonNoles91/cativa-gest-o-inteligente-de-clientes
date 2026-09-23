/**
 * PortalAnamnesis — o cliente responde e assina a ficha de anamnese (/portal/anamnese).
 */
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { usePortalClient } from "@/features/portal/PortalClientProvider";
import {
  listAnamnesisResponses,
  listAnamnesisTemplates,
  submitAnamnesis,
  type AnamnesisResponse,
  type AnamnesisTemplate,
} from "@/repositories/anamnesis";

export default function PortalAnamnesis() {
  const { activeLink, profile } = usePortalClient();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<AnamnesisTemplate[]>([]);
  const [responses, setResponses] = useState<AnamnesisResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<AnamnesisTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeLink) return;
    setLoading(true);
    try {
      const [t, r] = await Promise.all([
        listAnamnesisTemplates(activeLink.tenantId, true),
        listAnamnesisResponses(activeLink.tenantId, activeLink.clientId),
      ]);
      setTemplates(t);
      setResponses(r);
    } finally {
      setLoading(false);
    }
  }, [activeLink]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (profile?.fullName && !signature) setSignature(profile.fullName);
  }, [profile?.fullName, signature]);

  async function handleSubmit() {
    if (!activeLink || !current) return;
    const missing = current.questions.filter((q) => q.required && !answers[q.id]?.trim());
    if (missing.length > 0) {
      toast({ title: "Responda as perguntas obrigatórias", variant: "destructive" });
      return;
    }
    if (signature.trim().length < 3) {
      toast({ title: "Assine com seu nome completo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await submitAnamnesis({
        tenantId: activeLink.tenantId,
        templateId: current.id,
        clientId: activeLink.clientId,
        answers,
        signatureName: signature.trim(),
      });
      toast({ title: "Ficha assinada", description: "Obrigado! Já está com a equipe." });
      setCurrent(null);
      setAnswers({});
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar";
      toast({ title: "Não foi possível enviar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-80 rounded-2xl" />;

  if (current) {
    return (
      <div className="space-y-4">
        <Card className="space-y-4 rounded-2xl p-4">
          <h1 className="font-display text-xl font-semibold">{current.name}</h1>
          {current.intro && <p className="text-sm text-muted-foreground">{current.intro}</p>}

          {current.questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <Label htmlFor={q.id}>
                {q.label}
                {q.required && " *"}
              </Label>
              {q.type === "yesno" ? (
                <div className="flex gap-2">
                  {["Sim", "Não"].map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={answers[q.id] === opt ? "default" : "outline"}
                      className="min-h-[44px]"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              ) : (
                <Textarea
                  id={q.id}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="signature">Assinatura (seu nome completo)</Label>
            <Input
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Ao enviar, você confirma que as informações são verdadeiras.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void handleSubmit()} disabled={saving} className="min-h-[44px]">
              {saving ? "Enviando…" : "Assinar e enviar"}
            </Button>
            <Button variant="ghost" className="min-h-[44px]" onClick={() => setCurrent(null)}>
              Voltar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl font-semibold">Minhas fichas</h1>
      </header>

      {templates.length === 0 ? (
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          Nenhuma ficha para preencher no momento.
        </Card>
      ) : (
        templates.map((t) => {
          const signed = responses.find((r) => r.templateId === t.id);
          return (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
              <div className="min-w-0">
                <p className="font-medium">{t.name}</p>
                {signed ? (
                  <p className="text-xs text-muted-foreground">
                    Assinada em {new Date(signed.signedAt).toLocaleDateString("pt-BR")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t.questions.length} perguntas</p>
                )}
              </div>
              {signed ? (
                <StatusBadge tone="success">
                  <Check className="mr-1 inline h-3 w-3" />
                  Assinada
                </StatusBadge>
              ) : (
                <Button
                  className="min-h-[44px]"
                  onClick={() => {
                    setCurrent(t);
                    setAnswers({});
                  }}
                >
                  Preencher
                </Button>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
