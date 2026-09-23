/**
 * TeamGoals — metas e ranking da equipe (/app/metas).
 * Mostra o desempenho por profissional na semana ou no mês e permite ao
 * dono/gerente definir a meta mensal de receita e de atendimentos.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Medal, Target, TrendingUp, Users } from "lucide-react";

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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePermissions } from "@/features/auth/usePermissions";
import { fetchAppointments } from "@/repositories/analytics";
import { listProfessionalsLite, type ProfessionalLite } from "@/repositories/scheduling";
import { listProfessionalGoals, saveProfessionalGoal } from "@/repositories/team-goals";
import {
  buildTeamRanking,
  monthKey,
  monthRange,
  weekRange,
  type ProfessionalGoal,
  type TeamMemberRow,
} from "@/domain/team-goals";

type PeriodMode = "week" | "month";

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function TeamGoalsPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { toast } = useToast();
  const canEdit = can("settings.business");

  const [mode, setMode] = useState<PeriodMode>("month");
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<ProfessionalLite[]>([]);
  const [goals, setGoals] = useState<ProfessionalGoal[]>([]);
  const [appointments, setAppointments] = useState<Awaited<ReturnType<typeof fetchAppointments>>>([]);
  const [refreshToken, setRefreshToken] = useState(0);

  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [revenueGoal, setRevenueGoal] = useState("0");
  const [appointmentsGoal, setAppointmentsGoal] = useState("0");
  const [saving, setSaving] = useState(false);

  const period = useMemo(() => {
    const now = new Date();
    return mode === "month" ? monthRange(monthKey(now)) : weekRange(now);
  }, [mode]);
  const currentMonth = useMemo(() => monthKey(new Date()), []);

  useEffect(() => {
    if (!currentTenant) return;
    let ignore = false;
    setLoading(true);
    void (async () => {
      try {
        const [appts, pros, goalRows] = await Promise.all([
          fetchAppointments({ tenantId: currentTenant.id, start: period.start, end: period.end }),
          listProfessionalsLite(currentTenant.id),
          listProfessionalGoals(currentTenant.id, currentMonth),
        ]);
        if (ignore) return;
        setAppointments(appts);
        setProfessionals(pros);
        setGoals(goalRows);
      } catch (error) {
        if (!ignore) {
          toast({
            title: "Não foi possível carregar as metas",
            description: error instanceof Error ? error.message : "Erro inesperado.",
            variant: "destructive",
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentTenant, period.start, period.end, currentMonth, refreshToken, toast]);

  const ranking = useMemo(
    () =>
      buildTeamRanking(
        appointments,
        professionals.map((pro) => ({ id: pro.id, displayName: pro.displayName })),
        goals,
      ),
    [appointments, professionals, goals],
  );

  function openGoalDialog(row: TeamMemberRow) {
    setEditing(row);
    setRevenueGoal(String(Math.round(row.revenueGoalCents / 100)));
    setAppointmentsGoal(String(row.appointmentsGoal));
  }

  async function handleSaveGoal() {
    if (!currentTenant || !editing) return;
    setSaving(true);
    try {
      await saveProfessionalGoal({
        tenantId: currentTenant.id,
        professionalId: editing.professionalId,
        periodMonth: currentMonth,
        revenueGoalCents: Math.max(0, Math.round(Number(revenueGoal) * 100)) || 0,
        appointmentsGoal: Math.max(0, Math.round(Number(appointmentsGoal))) || 0,
        updatedBy: user?.id ?? null,
      });
      toast({ title: "Meta salva" });
      setEditing(null);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      toast({
        title: "Não foi possível salvar a meta",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Metas e ranking"
        description="Acompanhe o desempenho da equipe na semana ou no mês e defina a meta de cada profissional."
      />

      <Tabs value={mode} onValueChange={(value) => setMode(value as PeriodMode)}>
        <TabsList aria-label="Período das metas">
          <TabsTrigger value="week" className="min-h-[40px]">Semana</TabsTrigger>
          <TabsTrigger value="month" className="min-h-[40px]">Mês</TabsTrigger>
        </TabsList>
        <TabsContent value="week" className="sr-only" />
        <TabsContent value="month" className="sr-only" />
      </Tabs>


      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden /> Atendimentos concluídos
            </CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{ranking.totals.completed}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" aria-hidden /> Receita no período
            </CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{money(ranking.totals.revenueCents)}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" aria-hidden /> Meta do mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{money(ranking.totals.revenueGoalCents)}</p>
            <Progress value={Math.min(100, ranking.totals.revenueProgressPct)} className="mt-2" />
            <p className="mt-1 text-xs text-muted-foreground">{ranking.totals.revenueProgressPct}% da meta</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5 text-primary" aria-hidden /> Ranking da equipe
          </CardTitle>
          <CardDescription>Ordenado por meta atingida e receita gerada no período.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </div>
          ) : ranking.rows.length === 0 ? (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              Cadastre profissionais para acompanhar o ranking.
            </p>
          ) : (
            ranking.rows.map((row, index) => (
              <div key={row.professionalId} className="rounded-xl border p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{row.professionalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.completed} atendimentos · {row.clients} clientes · ticket {money(row.averageTicketCents)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{money(row.revenueCents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.noShows} faltas · {row.cancellations} cancelamentos
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Receita: {money(row.revenueCents)} de {money(row.revenueGoalCents)}
                    </p>
                    <Progress value={Math.min(100, row.revenueProgressPct)} className="mt-1" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Atendimentos: {row.completed} de {row.appointmentsGoal}
                    </p>
                    <Progress value={Math.min(100, row.appointmentsProgressPct)} className="mt-1" />
                  </div>
                </div>

                {canEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 min-h-[40px]"
                    onClick={() => openGoalDialog(row)}
                  >
                    Definir meta do mês
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : undefined)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Meta de {editing?.professionalName}</DialogTitle>
            <DialogDescription>Vale para o mês atual e serve de base para o ranking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="goal-revenue">Meta de receita (R$)</Label>
              <Input
                id="goal-revenue"
                inputMode="numeric"
                value={revenueGoal}
                onChange={(event) => setRevenueGoal(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-appointments">Meta de atendimentos</Label>
              <Input
                id="goal-appointments"
                inputMode="numeric"
                value={appointmentsGoal}
                onChange={(event) => setAppointmentsGoal(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveGoal()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Salvar meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
