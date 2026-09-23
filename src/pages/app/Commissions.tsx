/**
 * Commissions — comissões e fechamento por profissional (/app/comissoes).
 * Dono e gerente definem o percentual, acompanham o extrato do mês e fecham o período.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, FileText, Loader2, Lock, LockOpen } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenant } from "@/features/tenant/TenantProvider";
import { fetchAppointments } from "@/repositories/analytics";
import { listProfessionalsLite, type ProfessionalLite } from "@/repositories/scheduling";
import { listServices } from "@/repositories/catalog";
import {
  closeMonth,
  listClosings,
  listCommissionRules,
  reopenMonth,
  saveCommissionRule,
  type ClosingRow,
} from "@/repositories/commissions";
import {
  buildCommissionRows,
  buildStatement,
  commissionMonthKey,
  commissionMonthRange,
  commissionTotals,
  type CommissionRow,
  type CommissionRule,
} from "@/domain/commissions";
import type { ApptFact } from "@/domain/analytics";

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: commissionMonthKey(d),
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

export default function CommissionsPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id ?? null;

  const months = useMemo(monthOptions, []);
  const [period, setPeriod] = useState(months[0].value);
  const [loading, setLoading] = useState(true);
  const [appts, setAppts] = useState<ApptFact[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalLite[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<CommissionRow | null>(null);
  const [percentInput, setPercentInput] = useState("0");
  const [statementOf, setStatementOf] = useState<CommissionRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const range = commissionMonthRange(period);
      const [a, pros, r, c, services] = await Promise.all([
        fetchAppointments({ tenantId, start: range.start, end: range.end }),
        listProfessionalsLite(tenantId),
        listCommissionRules(tenantId),
        listClosings(tenantId, period),
        listServices({ tenantId }),
      ]);
      setAppts(a);
      setProfessionals(pros);
      setRules(r);
      setClosings(c);
      setServiceNames(Object.fromEntries(services.map((s) => [s.id, s.name])));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar";
      toast({ title: "Não foi possível carregar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenantId, period, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () =>
      buildCommissionRows(
        appts,
        professionals.map((p) => ({ id: p.id, displayName: p.displayName })),
        rules,
        closings.map((c) => c.professionalId),
      ),
    [appts, professionals, rules, closings],
  );
  const totals = useMemo(() => commissionTotals(rows), [rows]);

  const statement = useMemo(() => {
    if (!statementOf) return [];
    return buildStatement(appts, statementOf.professionalId, statementOf.percent, serviceNames);
  }, [statementOf, appts, serviceNames]);

  async function savePercent() {
    if (!tenantId || !editing) return;
    const percent = Math.min(100, Math.max(0, Number(percentInput) || 0));
    setSaving(true);
    try {
      await saveCommissionRule({
        tenantId,
        professionalId: editing.professionalId,
        percent,
        updatedBy: user?.id ?? null,
      });
      toast({ title: "Percentual salvo" });
      setEditing(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast({ title: "Não foi possível salvar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleClosing(row: CommissionRow) {
    if (!tenantId) return;
    try {
      if (row.closed) {
        await reopenMonth({ tenantId, professionalId: row.professionalId, periodMonth: period });
        toast({ title: "Mês reaberto" });
      } else {
        await closeMonth({
          tenantId,
          professionalId: row.professionalId,
          periodMonth: period,
          revenueCents: row.revenueCents,
          commissionCents: row.commissionCents,
          appointmentsCount: row.appointmentsCount,
          percent: row.percent,
          closedBy: user?.id ?? null,
        });
        toast({ title: "Fechamento registrado" });
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast({ title: "Não foi possível concluir", description: msg, variant: "destructive" });
    }
  }

  return (
    <>
      <PageHeader
        title="Comissões e fechamento"
        description="Percentual por profissional, extrato do mês e fechamento do período"
        icon={<Coins className="h-5 w-5" />}
      />

      <div className="mb-4 max-w-xs">
        <Label htmlFor="period">Mês</Label>
        <select
          id="period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Atendimentos concluídos</p>
            <p className="text-2xl font-semibold">{totals.appointmentsCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Receita do mês</p>
            <p className="text-2xl font-semibold">{money(totals.revenueCents)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de comissões</p>
            <p className="text-2xl font-semibold">{money(totals.commissionCents)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Por profissional</CardTitle>
          <CardDescription>
            Somente atendimentos concluídos entram no cálculo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.professionalId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{row.professionalName}</p>
                    {row.closed && <StatusBadge tone="success">Fechado</StatusBadge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.appointmentsCount} atendimentos · {money(row.revenueCents)} ·{" "}
                    {row.percent}% = <strong>{money(row.commissionCents)}</strong>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => {
                      setEditing(row);
                      setPercentInput(String(row.percent));
                    }}
                  >
                    Percentual
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] gap-2"
                    onClick={() => setStatementOf(row)}
                  >
                    <FileText className="h-4 w-4" /> Extrato
                  </Button>
                  <Button
                    variant={row.closed ? "ghost" : "default"}
                    className="min-h-[44px] gap-2"
                    onClick={() => void toggleClosing(row)}
                  >
                    {row.closed ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {row.closed ? "Reabrir" : "Fechar mês"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Percentual de {editing?.professionalName}</DialogTitle>
            <DialogDescription>
              Parte do valor de cada atendimento concluído que fica com o profissional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="percent">Percentual (%)</Label>
            <Input
              id="percent"
              type="number"
              min={0}
              max={100}
              value={percentInput}
              onChange={(e) => setPercentInput(e.target.value)}
              className="h-11"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => void savePercent()} disabled={saving} className="min-h-[44px]">
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(statementOf)} onOpenChange={(v) => !v && setStatementOf(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Extrato de {statementOf?.professionalName}</DialogTitle>
            <DialogDescription>
              {statementOf?.percent}% sobre {money(statementOf?.revenueCents ?? 0)} ={" "}
              {money(statementOf?.commissionCents ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {statement.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum atendimento concluído neste mês.
              </p>
            ) : (
              statement.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.serviceName ?? "Atendimento"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.startsAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p>{money(s.revenueCents)}</p>
                    <p className="text-xs text-muted-foreground">{money(s.commissionCents)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
