import { useEffect, useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { updateAppointment } from "@/repositories/scheduling";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  serviceName?: string | null;
  clientName?: string | null;
  professionalName?: string | null;
  initialNotes?: string | null;
  onSaved?: () => void | Promise<void>;
};

export function AppointmentSummaryDialog({
  open,
  onOpenChange,
  appointmentId,
  serviceName,
  clientName,
  professionalName,
  initialNotes,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes(initialNotes ?? "");
      setSummary("");
    }
  }, [open, initialNotes]);

  async function handleGenerate() {
    if (notes.trim().length < 10) {
      toast({
        title: "Anotações muito curtas",
        description: "Descreva o que foi feito no atendimento para gerar o resumo.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    setSummary("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/appointment-summary`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({
          appointmentId,
          notes,
          serviceName: serviceName ?? "",
          clientName: clientName ?? "",
          professionalName: professionalName ?? "",
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Falha ao gerar o resumo.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const event = JSON.parse(raw);
              if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
                answer += event.delta;
                setSummary(answer);
              }
            } catch {
              // ignora eventos parciais
            }
          }
        }
      }
      if (!answer.trim()) {
        setSummary("A IA não retornou texto. Detalhe um pouco mais as anotações e tente novamente.");
      }
    } catch (error) {
      toast({
        title: "Resumo indisponível",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      await updateAppointment(appointmentId, { internalNotes: summary.trim() });
      toast({ title: "Resumo salvo nas observações internas" });
      await onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Falha ao salvar o resumo",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summary);
      toast({ title: "Resumo copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resumo do atendimento</DialogTitle>
          <DialogDescription>
            Escreva as anotações livres e gere um resumo padronizado com procedimentos, recomendações e próximos passos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appointment-free-notes">Anotações livres da recepção</Label>
            <Textarea
              id="appointment-free-notes"
              rows={6}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: limpeza de pele + hidratação, pele sensível na região do queixo, cliente pediu retorno em 30 dias..."
            />
          </div>

          <Button onClick={() => void handleGenerate()} disabled={generating} className="w-full sm:w-auto">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar resumo padronizado
          </Button>

          {summary ? (
            <div className="space-y-3">
              <Label htmlFor="appointment-summary-output">Resumo gerado (edite se precisar)</Label>
              <Textarea
                id="appointment-summary-output"
                rows={12}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar em observações internas
                </Button>
                <Button variant="outline" onClick={() => void handleCopy()}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
