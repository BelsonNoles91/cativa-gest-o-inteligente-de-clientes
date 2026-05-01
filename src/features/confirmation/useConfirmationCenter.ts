/**
 * Hook para a página da Central de Confirmação.
 * Centraliza queries (fila, contagens, templates) e ações de mutação.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import {
  bumpQueueAttempt,
  countQueueByStage,
  listQueueHydrated,
  listTemplates,
  recordAttempt,
  recordCall,
  updateQueueStatus,
  type QueueItemHydrated,
} from "@/repositories/confirmation";
import type {
  CallOutcome,
  ConfirmationQueueStatus,
  ConfirmationStage,
  ContactAttemptResult,
  MessageChannel,
  MessageTemplate,
} from "@/domain/confirmation";
import { generateQueueForTenant } from "@/services/confirmation/queueGenerator";

export function useConfirmationCenter() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  const [stage, setStage] = useState<ConfirmationStage>("today");
  const [items, setItems] = useState<QueueItemHydrated[]>([]);
  const [counts, setCounts] = useState<Record<ConfirmationStage, number>>({
    today: 0,
    tomorrow: 0,
    upcoming: 0,
    high_risk: 0,
    premium: 0,
    reschedule: 0,
    recovery: 0,
  });
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const tenantId = currentTenant?.id ?? null;

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [list, c, tmpls] = await Promise.all([
        listQueueHydrated({ tenantId, stage, excludeClosed: true }),
        countQueueByStage(tenantId),
        listTemplates(tenantId, { activeOnly: true }),
      ]);
      setItems(list);
      setCounts((prev) => ({ ...prev, ...c }));
      setTemplates(tmpls);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar fila";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenantId, stage, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generate = useCallback(async () => {
    if (!tenantId) return;
    setGenerating(true);
    try {
      const r = await generateQueueForTenant(tenantId);
      toast({
        title: "Fila atualizada",
        description: `${r.created} agendamentos • Tarefas de reativação sincronizadas`,
      });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar fila";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [tenantId, refresh, toast]);

  const logAttempt = useCallback(
    async (input: {
      item: QueueItemHydrated;
      channel: MessageChannel;
      result: ContactAttemptResult;
      messagePreview?: string | null;
      notes?: string | null;
      templateId?: string | null;
      followUpAt?: string | null;
    }) => {
      if (!tenantId) return;
      try {
        await recordAttempt({
          tenantId,
          clientId: input.item.clientId,
          appointmentId: input.item.appointmentId,
          queueId: input.item.id,
          channel: input.channel,
          result: input.result,
          messagePreview: input.messagePreview ?? null,
          notes: input.notes ?? null,
          templateId: input.templateId ?? null,
          attemptedBy: user?.id ?? null,
          followUpAt: input.followUpAt ?? null,
        });
        await bumpQueueAttempt(input.item.id);
        await refresh();
        toast({ title: "Tentativa registrada" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao registrar tentativa";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      }
    },
    [tenantId, user?.id, refresh, toast],
  );

  const logCall = useCallback(
    async (input: {
      item: QueueItemHydrated;
      outcome: CallOutcome;
      durationSeconds?: number | null;
      notes?: string | null;
    }) => {
      if (!tenantId) return;
      try {
        await recordCall({
          tenantId,
          clientId: input.item.clientId,
          appointmentId: input.item.appointmentId,
          queueId: input.item.id,
          outcome: input.outcome,
          durationSeconds: input.durationSeconds ?? null,
          notes: input.notes ?? null,
          calledBy: user?.id ?? null,
        });
        await recordAttempt({
          tenantId,
          clientId: input.item.clientId,
          appointmentId: input.item.appointmentId,
          queueId: input.item.id,
          channel: "phone",
          result: "call_made",
          notes: input.notes ?? null,
          attemptedBy: user?.id ?? null,
        });
        await bumpQueueAttempt(input.item.id);
        await refresh();
        toast({ title: "Ligação registrada" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao registrar ligação";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      }
    },
    [tenantId, user?.id, refresh, toast],
  );

  const setItemStatus = useCallback(
    async (
      itemId: string,
      status: ConfirmationQueueStatus,
      extras?: { notes?: string; followUpAt?: string },
    ) => {
      try {
        await updateQueueStatus(itemId, status, extras);
        await refresh();
        toast({ title: "Status atualizado" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao atualizar status";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      }
    },
    [refresh, toast],
  );

  const totalOpen = useMemo(
    () => Object.values(counts).reduce((acc, n) => acc + n, 0),
    [counts],
  );

  return {
    stage,
    setStage,
    items,
    counts,
    templates,
    loading,
    generating,
    totalOpen,
    refresh,
    generate,
    logAttempt,
    logCall,
    setItemStatus,
  };
}
