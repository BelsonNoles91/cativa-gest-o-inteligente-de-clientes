/**
 * Reviews — convites de avaliação pós-atendimento (/app/avaliacoes).
 * Lista quem foi atendido nos últimos 30 dias e envia o convite pelo WhatsApp.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, Loader2, MessageCircle, Copy } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenant } from "@/features/tenant/TenantProvider";
import { fetchAppointments, fetchClients } from "@/repositories/analytics";
import {
  fetchReviewSettings,
  listReviewRequests,
  markReviewRequested,
  reviewMessage,
  defaultReviewSettings,
  type ReviewSettings,
} from "@/repositories/reviews";
import { whatsappLink } from "@/domain/retention-outreach";

interface Row {
  appointmentId: string;
  clientId: string;
  clientName: string;
  phone: string | null;
  when: string;
  sent: boolean;
}

export default function ReviewsPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id ?? null;
  const businessName = currentTenant?.name ?? "nosso estúdio";

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ReviewSettings>(defaultReviewSettings);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86400000);
      const [s, appts, clients, requested] = await Promise.all([
        fetchReviewSettings(tenantId),
        fetchAppointments({ tenantId, start: start.toISOString(), end: end.toISOString() }),
        fetchClients(tenantId),
        listReviewRequests(tenantId),
      ]);
      const sent = new Set(requested);
      const byId = new Map(clients.map((c) => [c.id, c]));
      setSettings(s);
      setRows(
        appts
          .filter((a) => a.status === "completed" && a.clientId)
          .map((a) => {
            const c = a.clientId ? byId.get(a.clientId) : undefined;
            return {
              appointmentId: a.id,
              clientId: a.clientId as string,
              clientName: c?.fullName ?? "Cliente",
              phone: c?.whatsappPhone ?? c?.phone ?? null,
              when: a.startsAt,
              sent: sent.has(a.id),
            };
          })
          .sort((a, b) => b.when.localeCompare(a.when)),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar";
      toast({ title: "Não foi possível carregar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => rows.filter((r) => !r.sent).length, [rows]);

  function messageFor(row: Row): string {
    return reviewMessage(settings.messageTemplate ?? defaultReviewSettings.messageTemplate ?? "", {
      clientName: row.clientName.split(" ")[0],
      businessName,
      link: settings.googleReviewUrl ?? "",
    });
  }

  async function send(row: Row) {
    if (!tenantId) return;
    if (!settings.googleReviewUrl) {
      toast({
        title: "Falta o link de avaliação",
        description: "Cadastre o link do Google em Configurações → Avaliações.",
        variant: "destructive",
      });
      return;
    }
    const link = whatsappLink(row.phone ?? "", messageFor(row));
    if (!link) {
      toast({ title: "Sem WhatsApp cadastrado", variant: "destructive" });
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
    try {
      await markReviewRequested({
        tenantId,
        clientId: row.clientId,
        appointmentId: row.appointmentId,
        sentBy: user?.id ?? null,
      });
      setRows((rs) =>
        rs.map((r) => (r.appointmentId === row.appointmentId ? { ...r, sent: true } : r)),
      );
    } catch {
      /* registro é secundário */
    }
  }

  async function copy(row: Row) {
    await navigator.clipboard.writeText(messageFor(row));
    toast({ title: "Texto copiado" });
  }

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="Convide quem acabou de ser atendido a avaliar seu negócio no Google"
        icon={<Star className="h-5 w-5" />}
      />

      {!settings.googleReviewUrl && (
        <Card className="mb-4 rounded-2xl border-warning/40">
          <CardContent className="p-4 text-sm">
            Cadastre o link de avaliação do Google em <strong>Configurações → Avaliações</strong>{" "}
            para liberar o convite.
          </CardContent>
        </Card>
      )}

      <Card className="mb-4 rounded-2xl">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Convites pendentes (últimos 30 dias)</p>
          <p className="text-2xl font-semibold">{pending}</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum atendimento concluído nos últimos 30 dias.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.appointmentId} className="rounded-2xl">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{row.clientName}</p>
                    {row.sent && <StatusBadge tone="success">Convite enviado</StatusBadge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Atendido em {new Date(row.when).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="min-h-[44px] gap-2" onClick={() => void copy(row)}>
                    <Copy className="h-4 w-4" /> Copiar
                  </Button>
                  <Button className="min-h-[44px] gap-2" onClick={() => void send(row)}>
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
