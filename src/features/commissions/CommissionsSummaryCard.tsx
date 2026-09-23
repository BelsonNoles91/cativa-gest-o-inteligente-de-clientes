/**
 * Resumo de comissões do mês atual, exibido no Painel do gestor.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useTenant } from "@/features/tenant/TenantProvider";
import { fetchAppointments } from "@/repositories/analytics";
import { listProfessionalsLite } from "@/repositories/professionals";
import { listClosings, listCommissionRules } from "@/repositories/commissions";
import {
  buildCommissionRows,
  commissionMonthKey,
  commissionMonthRange,
  commissionTotals,
  type CommissionRow,
} from "@/domain/commissions";

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CommissionsSummaryCard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const period = commissionMonthKey(new Date());
        const { start, end } = commissionMonthRange(period);
        const [appts, pros, rules, closings] = await Promise.all([
          fetchAppointments({ tenantId, start, end }),
          listProfessionalsLite(tenantId),
          listCommissionRules(tenantId),
          listClosings(tenantId, period),
        ]);
        if (!alive) return;
        setRows(
          buildCommissionRows(
            appts,
            pros.map((p) => ({ id: p.id, displayName: p.displayName })),
            rules,
            closings.map((c) => c.professionalId),
          ),
        );
      } catch {
        /* bloco secundário */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenantId]);

  const totals = commissionTotals(rows);
  const top = rows.slice(0, 5);

  return (
    <Card className="rounded-2xl p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Comissões do mês</h3>
        </div>
        <Button asChild variant="outline" className="min-h-[44px] gap-2">
          <Link to="/app/comissoes">
            Abrir comissões <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Receita do mês</p>
          <p className="text-xl font-semibold">{money(totals.revenueCents)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Comissões</p>
          <p className="text-xl font-semibold">{money(totals.commissionCents)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Atendimentos concluídos</p>
          <p className="text-xl font-semibold">{totals.appointmentsCount}</p>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
      ) : top.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum atendimento concluído neste mês ainda.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {top.map((r) => (
            <li
              key={r.professionalId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.professionalName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.appointmentsCount} atendimento(s) · {money(r.revenueCents)} · {r.percent}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r.closed && <StatusBadge tone="success">Fechado</StatusBadge>}
                <p className="font-semibold">{money(r.commissionCents)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
