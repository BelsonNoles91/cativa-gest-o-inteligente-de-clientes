/**
 * ManagerClients — Clientes do gestor (/app/painel-gestor/clientes).
 *
 * Lista de clientes com busca, situação (novo, ativo, em risco, parado),
 * visitas, valor gasto e botão direto de WhatsApp para a recepção usar
 * sem sair do painel.
 */
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Phone, RefreshCw, Search, Users } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { fetchAppointments, fetchClients } from "@/repositories/analytics";
import type { ApptFact, ClientFact } from "@/domain/analytics";
import { whatsappLink } from "@/domain/retention-outreach";

type Situation = "novo" | "ativo" | "em_risco" | "parado" | "sem_visita";

const SITUATION_LABEL: Record<Situation, string> = {
  novo: "Novo",
  ativo: "Em dia",
  em_risco: "Em risco",
  parado: "Parou de vir",
  sem_visita: "Nunca veio",
};

const SITUATION_TONE: Record<Situation, "success" | "info" | "warning" | "danger" | "neutral"> = {
  novo: "info",
  ativo: "success",
  em_risco: "warning",
  parado: "danger",
  sem_visita: "neutral",
};

interface Row {
  id: string;
  name: string;
  phone: string | null;
  visits: number;
  spentCents: number;
  lastVisitAt: string | null;
  daysSince: number | null;
  situation: Situation;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildRows(clients: ClientFact[], appts: ApptFact[], now = new Date()): Row[] {
  const spent = new Map<string, number>();
  for (const a of appts) {
    if (a.status !== "completed") continue;
    spent.set(a.clientId, (spent.get(a.clientId) ?? 0) + a.totalPriceCents);
  }

  return clients
    .map<Row>((c) => {
      const last = c.lastVisitAt ? new Date(c.lastVisitAt) : null;
      const daysSince = last
        ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      let situation: Situation = "sem_visita";
      if (daysSince === null) situation = "sem_visita";
      else if (daysSince > 90) situation = "parado";
      else if (daysSince > 45) situation = "em_risco";
      else if (c.completedVisits <= 1) situation = "novo";
      else situation = "ativo";

      return {
        id: c.id,
        name: c.fullName,
        phone: c.whatsappPhone ?? c.phone,
        visits: c.completedVisits,
        spentCents: spent.get(c.id) ?? 0,
        lastVisitAt: c.lastVisitAt,
        daysSince,
        situation,
      };
    })
    .sort((a, b) => {
      if (a.daysSince === null) return 1;
      if (b.daysSince === null) return -1;
      return a.daysSince - b.daysSince;
    });
}

export default function ManagerClients() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientFact[]>([]);
  const [appts, setAppts] = useState<ApptFact[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Situation | "todos">("todos");

  const tenantId = currentTenant?.id;
  const businessName = currentTenant?.name ?? "Cativa";

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    setLoading(true);
    const end = new Date();
    const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
    Promise.all([
      fetchClients(tenantId),
      fetchAppointments({ tenantId, start: start.toISOString(), end: end.toISOString() }),
    ])
      .then(([c, a]) => {
        if (!active) return;
        setClients(c);
        setAppts(a);
      })
      .catch(() => {
        if (active) toast({ title: "Não foi possível carregar os clientes", variant: "destructive" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const rows = useMemo(() => buildRows(clients, appts), [clients, appts]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "todos" && r.situation !== filter) return false;
      if (!term) return true;
      return r.name.toLowerCase().includes(term) || (r.phone ?? "").includes(term);
    });
  }, [rows, search, filter]);

  function messageFor(row: Row): string {
    const first = row.name.split(" ")[0];
    return `Oi ${first}! Aqui é do ${businessName}. Quer que eu reserve um horário para você?`;
  }

  function openWhats(row: Row) {
    const link = whatsappLink(row.phone, messageFor(row));
    if (!link) {
      toast({ title: "Sem WhatsApp cadastrado", description: "Cadastre o telefone na ficha do cliente." });
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Clientes"
        description="Quem já veio, quando foi a última vez e o WhatsApp a um toque"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Total de clientes</p>
          <p className="text-2xl font-semibold">{rows.length}</p>
        </Card>
        <Card className="rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Em dia (até 45 dias)</p>
          <p className="text-2xl font-semibold">
            {rows.filter((r) => r.situation === "ativo" || r.situation === "novo").length}
          </p>
        </Card>
        <Card className="rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Em risco ou parados</p>
          <p className="text-2xl font-semibold">
            {rows.filter((r) => r.situation === "em_risco" || r.situation === "parado").length}
          </p>
        </Card>
      </div>

      <Card className="rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="min-h-[44px] pl-9"
              placeholder="Buscar por nome ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => {
              setSearch("");
              setFilter("todos");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Limpar
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["todos", "ativo", "novo", "em_risco", "parado", "sem_visita"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="min-h-[36px] rounded-full"
              onClick={() => setFilter(f)}
            >
              {f === "todos" ? "Todos" : SITUATION_LABEL[f]}
            </Button>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum cliente encontrado com esse filtro.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((row) => (
            <Card key={row.id} className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{row.name}</p>
                  <StatusBadge tone={SITUATION_TONE[row.situation]}>
                    {SITUATION_LABEL[row.situation]}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.visits} {row.visits === 1 ? "visita" : "visitas"} · {money(row.spentCents)} no último ano ·{" "}
                  {row.daysSince === null
                    ? "sem visita registrada"
                    : `última há ${row.daysSince} ${row.daysSince === 1 ? "dia" : "dias"}`}
                </p>
                {row.phone && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {row.phone}
                  </p>
                )}
              </div>
              <Button className="min-h-[44px] sm:w-auto" onClick={() => openWhats(row)}>
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export { buildRows };
