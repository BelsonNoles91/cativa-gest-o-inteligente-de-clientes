/**
 * Insights de retenção com IA — disponível para gestão (owner/manager/super admin).
 * O gestor descreve o contexto do negócio; a função `retention-insights` agrega os
 * dados reais de atendimentos, agendamentos e clientes do tenant e o modelo devolve
 * um plano priorizado de retenção e recorrência.
 */
import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/features/tenant/TenantProvider";

const PLACEHOLDER =
  "Ex.: temos 2 profissionais de sobrancelha, a agenda de terça está vazia, muitos clientes de coloração não voltam depois da primeira visita, queremos aumentar pacotes mensais...";

export function RetentionInsightsCard() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [insights, setInsights] = useState("");
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!currentTenant?.id) return;
    setGenerating(true);
    setInsights("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retention-insights`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ tenantId: currentTenant.id, goal, context }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Falha ao gerar os insights.");
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
                setInsights(answer);
              }
            } catch {
              // ignora eventos parciais
            }
          }
        }
      }
      if (!answer.trim()) {
        setInsights("A IA não retornou texto. Descreva um pouco mais o contexto e tente novamente.");
      }
    } catch (error) {
      toast({
        title: "Insights indisponíveis",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(insights);
      toast({ title: "Insights copiados" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Insights de retenção com IA
        </CardTitle>
        <CardDescription>
          A IA lê os atendimentos, agendamentos e clientes dos últimos 180 dias deste estabelecimento e junta
          ao seu contexto para sugerir um plano de retenção e recorrência.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="retention-goal">Meta do período (opcional)</Label>
          <Input
            id="retention-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Ex.: aumentar em 20% o retorno em 60 dias"
            className="rounded-2xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="retention-context">Contexto e observações do gestor</Label>
          <Textarea
            id="retention-context"
            rows={5}
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder={PLACEHOLDER}
            className="rounded-2xl"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleGenerate()}
            disabled={generating || !currentTenant?.id}
            className="min-h-[48px] w-full rounded-2xl sm:w-auto"
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar insights de retenção
          </Button>
          {insights && (
            <Button
              variant="outline"
              onClick={() => void handleCopy()}
              className="min-h-[48px] w-full rounded-2xl sm:w-auto"
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
          )}
        </div>

        {insights && (
          <Textarea
            readOnly
            value={insights}
            rows={18}
            aria-label="Insights gerados"
            className="rounded-2xl font-mono text-xs"
          />
        )}
      </CardContent>
    </Card>
  );
}
