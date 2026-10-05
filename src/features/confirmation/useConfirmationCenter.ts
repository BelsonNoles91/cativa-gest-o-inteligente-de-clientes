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
import { isQueueItemDue } from "@/services/confirmation/queueRules";
import { setAppointmentStatus } from "@/repositories/scheduling";

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

  // Seleção múltipla para ações em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const tenantId = currentTenant?.id ?? null;

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [list, c, tmpls] = await Promise.all([
        listQueueHydrated({ tenantId, stage, excludeClosed: true, limit: 200 }),
        countQueueByStage(tenantId),
        listTemplates(tenantId, { activeOnly: true }),
      ]);
      setItems(list);
      setCounts((prev) => ({ ...prev, ...c }));
      setTemplates(tmpls);
      // Limpa seleção ao trocar de etapa ou atualizar
      setSelectedIds(new Set());
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
        title: r.warning ? "Fila atualizada parcialmente" : "Fila atualizada",
        description: r.warning
          ? `${r.created} agendamentos. ${r.warning}`
          : `${r.created} agendamentos • Tarefas de reativação sincronizadas`,
        ...(r.warning ? { variant: "destructive" as const } : {}),
      });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar fila";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [tenantId, refresh, toast]);

  const toggleSelection = useCallback((id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || !isQueueItemDue(item.scheduledFor)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [items]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.filter((item) => isQueueItemDue(item.scheduledFor)).map((i) => i.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const persistItemStatus = useCallback(
    async (
      itemId: string,
      status: ConfirmationQueueStatus,
      extras?: { notes?: string; followUpAt?: string },
    ) => {
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item) {
        throw new Error(
          "O agendamento saiu da fila. Atualize a página e tente novamente.",
        );
      }
      if (!isQueueItemDue(item.scheduledFor)) {
        throw new Error("Este contato ainda está programado para um horário futuro.");
      }

      if (status === "confirmed") {
        // O trigger do banco fecha a fila de forma atômica com a confirmação.
        await setAppointmentStatus(item.appointmentId, "confirmed");
        return;
      }

      if (status === "canceled") {
        // Cancelar na central também libera o horário na agenda.
        await setAppointmentStatus(item.appointmentId, "canceled", {
          reason:
            extras?.notes?.trim() ||
            "Cancelamento registrado na Central de Confirmação.",
        });
        return;
      }

      await updateQueueStatus(itemId, status, extras);
    },
    [items],
  );

  const setBatchStatus = useCallback(
    async (status: ConfirmationQueueStatus) => {
      if (selectedIds.size === 0) return;
      setLoading(true);
      try {
        await Promise.all(
          Array.from(selectedIds).map((id) => persistItemStatus(id, status)),
        );
        toast({ title: `${selectedIds.size} itens atualizados com sucesso` });
        await refresh();
      } catch (e) {
        toast({ title: "Erro ao atualizar lote", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [selectedIds, persistItemStatus, refresh, toast],
  );

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
      if (!isQueueItemDue(input.item.scheduledFor)) {
        toast({
          title: "Contato ainda não está liberado",
          description: "A ação ficará disponível no horário programado.",
          variant: "destructive",
        });
        return;
      }
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
        const msg =
          e instanceof Error ? e.message : "Erro ao registrar tentativa";
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
      if (!isQueueItemDue(input.item.scheduledFor)) {
        toast({
          title: "Contato ainda não está liberado",
          description: "A ação ficará disponível no horário programado.",
          variant: "destructive",
        });
        return;
      }
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
        const msg =
          e instanceof Error ? e.message : "Erro ao registrar ligação";
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
        await persistItemStatus(itemId, status, extras);
        await refresh();
        toast({ title: "Status atualizado" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao atualizar status";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      }
    },
    [persistItemStatus, refresh, toast],
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
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    setBatchStatus,
    refresh,
    generate,
    logAttempt,
    logCall,
    setItemStatus,
  };
}
