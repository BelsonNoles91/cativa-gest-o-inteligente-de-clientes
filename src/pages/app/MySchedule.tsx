import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { usePermissions } from "@/features/auth/usePermissions";
import {
  createAvailability,
  deleteAvailability,
  listBusinessHours,
  listProfessionalAvailability,
} from "@/repositories/scheduling";
import type { ProfessionalAvailability, UnitBusinessHour } from "@/domain/scheduling";
import {
  approveScheduleRequest,
  createScheduleRequest,
  getMyProfessional,
  listScheduleRequests,
  rejectScheduleRequest,
  updateMyProfessionalDetails,
  type MyProfessionalProfile,
  type ScheduleRequest,
} from "@/repositories/professional-portal";

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const STATUS_LABEL: Record<ScheduleRequest["status"], string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  rejected: "Recusada",
  canceled: "Cancelada",
};

function hhmm(value: string) {
  return value.slice(0, 5);
}

export default function MySchedule() {
  const { currentTenant, currentUnit } = useTenant();
  const { can } = usePermissions();
  const { toast } = useToast();

  const tenantId = currentTenant?.id ?? null;
  const canApprove = can("schedule.approve");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<MyProfessionalProfile | null>(null);
  const [availability, setAvailability] = useState<ProfessionalAvailability[]>([]);
  const [businessHours, setBusinessHours] = useState<UnitBusinessHour[]>([]);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);

  const [weekday, setWeekday] = useState("1");
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("18:00");
  const [reason, setReason] = useState("");

  const [roleTitle, setRoleTitle] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");

  const unitId = professional?.unitId ?? currentUnit?.id ?? null;

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const me = await getMyProfessional(tenantId);
      setProfessional(me);
      setRoleTitle(me?.roleTitle ?? "");
      setSpecialty(me?.specialty ?? "");
      setBio(me?.bio ?? "");

      const targetUnit = me?.unitId ?? currentUnit?.id ?? null;
      const [avail, hours, reqs] = await Promise.all([
        me ? listProfessionalAvailability(tenantId, me.id) : Promise.resolve([]),
        targetUnit ? listBusinessHours(tenantId, targetUnit) : Promise.resolve([]),
        listScheduleRequests(tenantId, canApprove ? undefined : { professionalId: me?.id }),
      ]);
      setAvailability(avail);
      setBusinessHours(hours);
      setRequests(me || canApprove ? reqs : []);
    } catch (error) {
      toast({
        title: "Não foi possível carregar sua agenda",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, currentUnit?.id, canApprove, toast]);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefresh(useCallback(() => void load(), [load]));

  const dayHours = useMemo(
    () => businessHours.find((h) => h.weekday === Number(weekday)) ?? null,
    [businessHours, weekday],
  );

  const outsideHours = useMemo(() => {
    if (!dayHours || dayHours.isClosed) return true;
    return hhmm(startsAt) < hhmm(dayHours.opensAt) || hhmm(endsAt) > hhmm(dayHours.closesAt);
  }, [dayHours, startsAt, endsAt]);

  const invalidRange = hhmm(endsAt) <= hhmm(startsAt);

  async function handleCreate() {
    if (!tenantId || !professional) return;
    setSaving(true);
    try {
      await createAvailability({
        tenantId,
        professionalId: professional.id,
        weekday: Number(weekday),
        startsAt,
        endsAt,
        unitId,
      });
      toast({ title: "Horário publicado na sua agenda" });
      setReason("");
      await load();
    } catch (error) {
      toast({
        title: "Não foi possível salvar o horário",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRequest() {
    if (!tenantId || !professional) return;
    setSaving(true);
    try {
      await createScheduleRequest({
        tenantId,
        professionalId: professional.id,
        unitId,
        weekday: Number(weekday),
        startsAt,
        endsAt,
        reason: reason.trim() || null,
      });
      toast({
        title: "Solicitação enviada",
        description: "O gerente ou proprietário vai analisar o horário pedido.",
      });
      setReason("");
      await load();
    } catch (error) {
      toast({
        title: "Não foi possível enviar a solicitação",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAvailability(id);
      toast({ title: "Horário removido" });
      await load();
    } catch (error) {
      toast({
        title: "Não foi possível remover",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function handleReview(id: string, approve: boolean) {
    try {
      if (approve) await approveScheduleRequest(id);
      else await rejectScheduleRequest(id);
      toast({ title: approve ? "Solicitação aprovada" : "Solicitação recusada" });
      await load();
    } catch (error) {
      toast({
        title: "Não foi possível concluir",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function handleSaveDetails() {
    if (!professional) return;
    setSaving(true);
    try {
      await updateMyProfessionalDetails({
        professionalId: professional.id,
        roleTitle: roleTitle.trim() || null,
        specialty: specialty.trim() || null,
        bio: bio.trim() || null,
      });
      toast({ title: "Dados de atendimento atualizados" });
      await load();
    } catch (error) {
      toast({
        title: "Não foi possível salvar",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const requestsCard = (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">
                  {canApprove ? "Solicitações de horário da equipe" : "Minhas solicitações"}
                </CardTitle>
                <CardDescription>
                  {canApprove
                    ? "Aprove ou recuse pedidos de atendimento fora do horário de funcionamento."
                    : "Acompanhe os pedidos enviados ao gestor."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {requests.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma solicitação por aqui.</p>
                )}
                {requests.map((req) => (
                  <div key={req.id} className="space-y-2 rounded-xl border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {WEEKDAYS[req.weekday]} · {hhmm(req.startsAt)} às {hhmm(req.endsAt)}
                        </p>
                        {canApprove && req.professionalName && (
                          <p className="text-xs text-muted-foreground">{req.professionalName}</p>
                        )}
                      </div>
                      <Badge variant={req.status === "pending" ? "secondary" : "outline"}>
                        {STATUS_LABEL[req.status]}
                      </Badge>
                    </div>
                    {req.reason && <p className="text-xs text-muted-foreground">{req.reason}</p>}
                    {canApprove && req.status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleReview(req.id, true)}
                          className="h-10 rounded-xl"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReview(req.id, false)}
                          className="h-10 rounded-xl"
                        >
                          <XCircle className="mr-2 h-4 w-4" /> Recusar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
  );

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="pb-10">
      <PageHeader
        title="Minha agenda"
        description="Defina seus dias e horários de atendimento e mantenha seus dados de apresentação atualizados."
        icon={<CalendarClock className="h-5 w-5" />}
      />

      {!professional && !canApprove && (
        <EmptyState
          title="Sua ficha de profissional ainda não está vinculada"
          description="Peça ao gerente ou proprietário para vincular o seu acesso à ficha de profissional do estabelecimento."
        />
      )}

      {!professional && canApprove && <div className="space-y-6">{requestsCard}</div>}

      {professional && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Novo horário de atendimento</CardTitle>
                <CardDescription>
                  Você pode publicar livremente qualquer horário dentro do funcionamento da unidade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-3">
                    <Label htmlFor="weekday">Dia da semana</Label>
                    <Select value={weekday} onValueChange={setWeekday}>
                      <SelectTrigger id="weekday" className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((label, index) => (
                          <SelectItem key={label} value={String(index)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="starts">Início</Label>
                    <Input
                      id="starts"
                      type="time"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ends">Fim</Label>
                    <Input
                      id="ends"
                      type="time"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
                  <span className="font-medium">Funcionamento neste dia: </span>
                  {dayHours && !dayHours.isClosed
                    ? `${hhmm(dayHours.opensAt)} às ${hhmm(dayHours.closesAt)}`
                    : "a unidade não abre neste dia"}
                </div>

                {invalidRange && (
                  <p className="text-sm text-destructive">
                    O horário de fim precisa ser maior que o de início.
                  </p>
                )}

                {!invalidRange && outsideHours && (
                  <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                      <p className="text-sm">
                        Este horário está fora do funcionamento da unidade. Você pode pedir
                        autorização ao gerente ou proprietário.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason">Motivo (ajuda na aprovação)</Label>
                      <Textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex.: cliente fixo só consegue vir antes das 9h."
                        className="min-h-[80px] rounded-xl"
                      />
                    </div>
                    <Button
                      onClick={handleRequest}
                      disabled={saving}
                      className="h-11 w-full rounded-xl sm:w-auto"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Solicitar autorização"}
                    </Button>
                  </div>
                )}

                {!invalidRange && !outsideHours && (
                  <Button
                    onClick={handleCreate}
                    disabled={saving}
                    className="h-11 w-full rounded-xl sm:w-auto"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" /> Publicar horário
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Meus horários da semana</CardTitle>
                <CardDescription>Estes são os horários em que você recebe agendamentos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {availability.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Você ainda não publicou horários de atendimento.
                  </p>
                )}
                {availability.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Clock3 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{WEEKDAYS[slot.weekday]}</p>
                        <p className="text-xs text-muted-foreground">
                          {hhmm(slot.startsAt)} às {hhmm(slot.endsAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover horário"
                      onClick={() => handleDelete(slot.id)}
                      className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {requestsCard}
          </div>

          <Card className="h-fit rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-5 w-5" /> Meus dados de atendimento
              </CardTitle>
              <CardDescription>
                Aparecem para a recepção e na página pública do estabelecimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role-title">Como você se apresenta</Label>
                <Input
                  id="role-title"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="Ex.: Cabeleireira sênior"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Especialidade</Label>
                <Input
                  id="specialty"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Ex.: Coloração e mechas"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Sobre o seu atendimento</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte como é o seu atendimento, cuidados e preparo recomendado."
                  className="min-h-[120px] rounded-xl"
                />
              </div>
              <Button
                onClick={handleSaveDetails}
                disabled={saving}
                className="h-11 w-full rounded-xl"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar dados"}
              </Button>
              {pending.length > 0 && !canApprove && (
                <p className="text-xs text-muted-foreground">
                  Você tem {pending.length} solicitação(ões) aguardando resposta do gestor.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
