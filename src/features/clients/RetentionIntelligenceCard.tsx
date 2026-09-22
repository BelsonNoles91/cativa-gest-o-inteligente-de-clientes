import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { InfoItem } from "@/features/clients/retention-ui";
import { evaluateRetentionWithJev } from "@/services/intelligence/retentionAdvisor";
import type { Client } from "@/domain/client";
import type { RetentionAdvice } from "@/domain/retentionIntelligence";

export function RetentionIntelligenceCard({ client }: { client: Client }) {
  const [advice, setAdvice] = useState<RetentionAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAdvice(null);
    setError(null);
  }, [client.id]);

  async function evaluate() {
    setLoading(true);
    setError(null);
    try {
      setAdvice(await evaluateRetentionWithJev({ tenantId: client.tenantId, clientId: client.id }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar o Jev.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" /> Inteligência de Retenção
          </CardTitle>
          <CardDescription>
            Métricas do sistema e recomendação estruturada do Jev. A decisão e qualquer contato continuam humanos.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={evaluate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : advice ? <RefreshCcw className="mr-2 h-4 w-4" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
          {advice ? "Reavaliar com Jev" : "Avaliar com Jev"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoItem
            label="Ciclo Médio"
            value={client.averageCycleDays ? `${client.averageCycleDays} dias` : "Não calculado"}
          />
          <InfoItem
            label="Risco de Churn"
            value={
              <div className="flex items-center gap-2">
                <Progress value={client.churnRiskScore} className="h-2 w-24" />
                <span className="text-xs font-medium">{client.churnRiskScore}%</span>
              </div>
            }
          />
          <InfoItem label="Regra do sistema" value={client.nextBestAction || "Nenhuma sugestão"} />
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error} A sugestão determinística acima permanece disponível.
          </div>
        )}

        {advice && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{advice.actionLabel}</p>
              <StatusBadge tone={advice.status === "suggested" ? "info" : "warning"}>
                {advice.status === "suggested" ? "Sugestão Jev" : "Revisão necessária"}
              </StatusBadge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{advice.description}</p>
            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
              <span>Urgência: {advice.urgency}%</span>
              <span>Confiança: {Math.round(advice.confidence * 100)}%</span>
              <span>Dados suficientes: {Math.round(advice.evidenceSufficiency * 100)}%</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Nenhuma mensagem é enviada e nenhum dado é alterado automaticamente · {advice.model}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
