/**
 * Página principal: Central de Confirmação.
 * Filas por etapa, ações rápidas, geração de fila a partir dos
 * agendamentos e dialog de ação por item.
 */
import { useState } from "react";
import { CheckCircle2, RefreshCcw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useConfirmationCenter } from "@/features/confirmation/useConfirmationCenter";
import { QueueItemCard } from "@/features/confirmation/QueueItemCard";
import { ConfirmationActionDialog } from "@/features/confirmation/ConfirmationActionDialog";
import { stageDescriptions, stageLabels, type ConfirmationStage } from "@/domain/confirmation";
import type { QueueItemHydrated } from "@/repositories/confirmation";

const STAGE_ORDER: ConfirmationStage[] = [
  "today",
  "tomorrow",
  "upcoming",
  "high_risk",
  "premium",
  "reschedule",
  "recovery",
];

export default function ConfirmationCenter() {
  const center = useConfirmationCenter();
  const [active, setActive] = useState<QueueItemHydrated | null>(null);
  const [open, setOpen] = useState(false);

  const handleOpen = (item: QueueItemHydrated) => {
    setActive(item);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Confirmação"
        description="Confirme atendimentos com velocidade. Mensagens prontas, sem WhatsApp API."
        icon={<CheckCircle2 className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => center.refresh()}
              disabled={center.loading}
            >
              <RefreshCcw className="mr-1.5 h-4 w-4" /> Atualizar
            </Button>
            <Button
              onClick={() => center.generate()}
              disabled={center.generating}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {center.generating ? "Gerando…" : "Gerar fila"}
            </Button>
          </div>
        }
      />

      <Tabs
        value={center.stage}
        onValueChange={(v) => center.setStage(v as ConfirmationStage)}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {STAGE_ORDER.map((s) => {
            const count = center.counts[s] ?? 0;
            return (
              <TabsTrigger
                key={s}
                value={s}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {stageLabels[s]}
                {count > 0 && (
                  <span className="rounded-full bg-background/20 px-1.5 text-xs font-semibold">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <p className="text-sm text-muted-foreground">{stageDescriptions[center.stage]}</p>

        {center.loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : center.items.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Nenhum item nesta fila"
            description='Clique em "Gerar fila" para criar itens a partir dos próximos agendamentos.'
            action={
              <Button onClick={() => center.generate()} disabled={center.generating}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Gerar fila
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {center.items.map((item) => (
              <QueueItemCard key={item.id} item={item} onOpen={handleOpen} />
            ))}
          </div>
        )}
      </Tabs>

      <ConfirmationActionDialog
        item={active}
        open={open}
        onOpenChange={setOpen}
        templates={center.templates}
        center={center}
      />
    </div>
  );
}
