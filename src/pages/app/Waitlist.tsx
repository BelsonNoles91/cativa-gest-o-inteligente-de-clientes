import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Clock3,
  Hourglass,
  Loader2,
  Pencil,
  PhoneCall,
  Plus,
  RefreshCcw,
  Trash2,
  UserRound,
  XCircle,
  Filter,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { listClients, type Client } from "@/repositories/clients";
import { listBasePrices, listServices, type Service } from "@/repositories/catalog";
import {
  createWaitlistEntry,
  deleteWaitlistEntry,
  getAvailableSlots,
  insertAppointment,
  listProfessionalsLite,
  listWaitlistHydrated,
  setWaitlistStatus,
  updateWaitlistEntry,
  type HydratedWaitlistEntry,
  type ProfessionalLite,
} from "@/repositories/scheduling";
import {
  waitlistStatusLabels,
  type WaitlistStatus,
} from "@/domain/scheduling";

type WaitlistFormState = {
  clientId: string;
  serviceId: string;
  preferredUnitId: string;
  preferredProfessionalId: string;
  desiredWindowStart: string;
  desiredWindowEnd: string;
  priority: string;
  notes: string;
};

type ScheduleFormState = {
  serviceId: string;
  unitId: string;
  professionalId: string;
  date: string;
  slotStartsAt: string;
  manualTime: string;
};

const EMPTY_WAITLIST_FORM: WaitlistFormState = {
  clientId: "none",
  serviceId: "none",
  preferredUnitId: "none",
  preferredProfessionalId: "none",
  desiredWindowStart: "",
  desiredWindowEnd: "",
  priority: "50",
  notes: "",
};

const EMPTY_SCHEDULE_FORM: ScheduleFormState = {
  serviceId: "none",
  unitId: "none",
  professionalId: "none",
  date: "",
  slotStartsAt: "",
  manualTime: "",
};

export default function WaitlistPage() {
  const { currentTenant, currentUnit, availableUnits } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | WaitlistStatus>("open");
  const [proFilter, setProFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");


  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalLite[]>([]);
  const [basePrices, setBasePrices] = useState<Map<string, number>>(new Map());
  const [entries, setEntries] = useState<HydratedWaitlistEntry[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HydratedWaitlistEntry | null>(null);
  const [form, setForm] = useState<WaitlistFormState>(EMPTY_WAITLIST_FORM);
  const [saving, setSaving] = useState(false);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<HydratedWaitlistEntry | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(EMPTY_SCHEDULE_FORM);
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const servicesMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (statusFilter !== "all") {
      result = result.filter((entry) => entry.entry.status === statusFilter);
    }
    if (proFilter !== "all") {
      result = result.filter((entry) => entry.entry.preferredProfessionalId === proFilter);
    }
    if (serviceFilter !== "all") {
      result = result.filter((entry) => entry.entry.serviceId === serviceFilter);
    }
    
    return result.sort((a, b) => {
      // Priorização: VIPs primeiro, depois prioridade numérica, depois janela
      if (a.entry.priority !== b.entry.priority) return b.entry.priority - a.entry.priority;
      
      const startA = a.entry.desiredWindowStart ? new Date(a.entry.desiredWindowStart).getTime() : Infinity;
      const startB = b.entry.desiredWindowStart ? new Date(b.entry.desiredWindowStart).getTime() : Infinity;
      return startA - startB;
    });
  }, [entries, statusFilter, proFilter, serviceFilter]);

  useEffect(() => {
    if (!currentTenant) return;
    let ignore = false;
    setLoading(true);
    void (async () => {
      try {
        const [nextEntries, nextClientsPage, nextServices, nextProfessionals, nextBasePrices] = await Promise.all([
          listWaitlistHydrated(currentTenant.id),
          listClients({ tenantId: currentTenant.id, limit: 500 }),
          listServices({ tenantId: currentTenant.id, activeOnly: true }),
          listProfessionalsLite(currentTenant.id),
          listBasePrices(currentTenant.id),
        ]);
        if (ignore) return;
        setEntries(nextEntries);
        setClients(nextClientsPage.clients);
        setServices(nextServices);
        setProfessionals(nextProfessionals);
        setBasePrices(new Map(Array.from(nextBasePrices.entries()).map(([id, row]) => [id, row.amountCents])));
      } catch (error) {
        if (ignore) return;
        toast({
          title: "Erro ao carregar lista de espera",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentTenant, refreshToken, toast]);

  useEffect(() => {
    const shouldLoadSlots =
      scheduleDialogOpen &&
      !!currentTenant &&
      scheduleForm.unitId !== "none" &&
      scheduleForm.professionalId !== "none" &&
      scheduleForm.serviceId !== "none" &&
      !!scheduleForm.date;

    if (!shouldLoadSlots) {
      setSlots([]);
      return;
    }

    let ignore = false;
    setLoadingSlots(true);
    void (async () => {
      try {
        const data = await getAvailableSlots({
          tenantId: currentTenant.id,
          professionalId: scheduleForm.professionalId,
          unitId: scheduleForm.unitId,
          serviceId: scheduleForm.serviceId,
          day: scheduleForm.date,
        });
        if (!ignore) setSlots(data);
      } catch (error) {
        if (!ignore) {
          toast({
            title: "Erro ao buscar horários",
            description: error instanceof Error ? error.message : "Erro inesperado.",
            variant: "destructive",
          });
        }
      } finally {
        if (!ignore) setLoadingSlots(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentTenant, scheduleDialogOpen, scheduleForm.date, scheduleForm.professionalId, scheduleForm.serviceId, scheduleForm.unitId, toast]);

  async function refreshWaitlist() {
    setRefreshToken((current) => current + 1);
  }

  function openCreateDialog() {
    setEditing(null);
    setForm({
      ...EMPTY_WAITLIST_FORM,
      preferredUnitId: currentUnit?.id ?? availableUnits[0]?.id ?? "none",
    });
    setDialogOpen(true);
  }

  function openEditDialog(entry: HydratedWaitlistEntry) {
    setEditing(entry);
    setForm({
      clientId: entry.entry.clientId,
      serviceId: entry.entry.serviceId ?? "none",
      preferredUnitId: entry.entry.preferredUnitId ?? "none",
      preferredProfessionalId: entry.entry.preferredProfessionalId ?? "none",
      desiredWindowStart: entry.entry.desiredWindowStart ? toLocalInput(entry.entry.desiredWindowStart) : "",
      desiredWindowEnd: entry.entry.desiredWindowEnd ? toLocalInput(entry.entry.desiredWindowEnd) : "",
      priority: String(entry.entry.priority),
      notes: entry.entry.notes ?? "",
    });
    setDialogOpen(true);
  }

  function openScheduleDialog(entry: HydratedWaitlistEntry) {
    setScheduleTarget(entry);
    setScheduleForm({
      serviceId: entry.entry.serviceId ?? "none",
      unitId: entry.entry.preferredUnitId ?? currentUnit?.id ?? availableUnits[0]?.id ?? "none",
      professionalId: entry.entry.preferredProfessionalId ?? "none",
      date: entry.entry.desiredWindowStart ? entry.entry.desiredWindowStart.slice(0, 10) : todayLocalDate(),
      slotStartsAt: "",
      manualTime: "",
    });
    setScheduleDialogOpen(true);
  }

  async function handleSaveEntry() {
    if (!currentTenant || form.clientId === "none") {
      toast({ title: "Cliente obrigatório", description: "Selecione o cliente da fila.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        preferredUnitId: form.preferredUnitId === "none" ? null : form.preferredUnitId,
        preferredProfessionalId: form.preferredProfessionalId === "none" ? null : form.preferredProfessionalId,
        serviceId: form.serviceId === "none" ? null : form.serviceId,
        desiredWindowStart: form.desiredWindowStart ? new Date(form.desiredWindowStart).toISOString() : null,
        desiredWindowEnd: form.desiredWindowEnd ? new Date(form.desiredWindowEnd).toISOString() : null,
        notes: emptyToNull(form.notes),
        priority: parseInt(form.priority || "50", 10) || 50,
      };

      if (editing) {
        await updateWaitlistEntry(editing.entry.id, payload);
        toast({ title: "Item da waitlist atualizado" });
      } else {
        await createWaitlistEntry({
          tenantId: currentTenant.id,
          clientId: form.clientId,
          ...payload,
        });
        toast({ title: "Cliente adicionado à fila" });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_WAITLIST_FORM);
      await refreshWaitlist();
    } catch (error) {
      toast({
        title: "Falha ao salvar item da fila",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(entry: HydratedWaitlistEntry, status: WaitlistStatus) {
    try {
      await setWaitlistStatus(entry.entry.id, status);
      toast({ title: `Item marcado como ${waitlistStatusLabels[status].toLowerCase()}` });
      await refreshWaitlist();
    } catch (error) {
      toast({
        title: "Falha ao atualizar item",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(entryId: string) {
    try {
      await deleteWaitlistEntry(entryId);
      toast({ title: "Item removido da fila" });
      await refreshWaitlist();
    } catch (error) {
      toast({
        title: "Falha ao remover item",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleSchedule() {
    if (!currentTenant || !scheduleTarget) return;
    const service = scheduleForm.serviceId !== "none" ? (servicesMap.get(scheduleForm.serviceId) ?? null) : null;
    if (!service) {
      toast({ title: "Serviço obrigatório", description: "Selecione um serviço para agendar.", variant: "destructive" });
      return;
    }
    if (scheduleForm.unitId === "none" || scheduleForm.professionalId === "none" || !scheduleForm.date) {
      toast({ title: "Campos obrigatórios", description: "Selecione unidade, profissional e data.", variant: "destructive" });
      return;
    }
    const startsAt = scheduleForm.slotStartsAt || buildIsoFromDateAndTime(scheduleForm.date, scheduleForm.manualTime);
    if (!startsAt) {
      toast({ title: "Horário obrigatório", description: "Selecione um slot ou informe um horário manual.", variant: "destructive" });
      return;
    }
    setScheduling(true);
    try {
      const created = await insertAppointment({
        tenantId: currentTenant.id,
        unitId: scheduleForm.unitId,
        clientId: scheduleTarget.entry.clientId,
        professionalId: scheduleForm.professionalId,
        serviceId: service.id,
        startsAt,
        endsAt: addMinutes(startsAt, service.durationMinutes),
        durationMinutes: service.durationMinutes,
        bufferBeforeMinutes: service.bufferBeforeMinutes,
        bufferAfterMinutes: service.bufferAfterMinutes,
        cancellationPolicyId: service.cancellationPolicyId,
        source: "frontdesk",
        status: "pending",
        notes: emptyToNull(scheduleTarget.entry.notes ?? ""),
        totalPriceCents: basePrices.get(service.id) ?? 0,
        createdBy: user?.id ?? null,
        itemPriceCents: basePrices.get(service.id) ?? 0,
      });
      await setWaitlistStatus(scheduleTarget.entry.id, "scheduled", { scheduledAppointmentId: created.id });
      toast({ title: "Agendamento criado a partir da fila" });
      setScheduleDialogOpen(false);
      setScheduleTarget(null);
      setScheduleForm(EMPTY_SCHEDULE_FORM);
      await refreshWaitlist();
    } catch (error) {
      toast({
        title: "Falha ao converter fila em agendamento",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  }

  const stats = useMemo(() => ({
    open: entries.filter((entry) => entry.entry.status === "open").length,
    contacted: entries.filter((entry) => entry.entry.status === "contacted").length,
    scheduled: entries.filter((entry) => entry.entry.status === "scheduled").length,
  }), [entries]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lista de espera"
        description="Organize encaixes, acompanhe contatos e converta oportunidades em agendamentos reais."
        icon={<Hourglass className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refreshWaitlist()}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Novo item
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Aguardando" value={String(stats.open)} helper="Clientes ainda sem contato" />
        <MetricCard label="Contatados" value={String(stats.contacted)} helper="Aguardando retorno" />
        <MetricCard label="Convertidos" value={String(stats.scheduled)} helper="Viraram agendamento" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | WaitlistStatus)} className="w-full lg:w-auto">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 min-[480px]:inline-flex min-[480px]:h-10 min-[480px]:grid-cols-none min-[480px]:flex-nowrap min-[480px]:justify-start lg:w-auto">
              <TabsTrigger value="open" className="min-w-0 whitespace-normal px-2 text-xs min-[480px]:whitespace-nowrap min-[480px]:px-3 min-[480px]:text-sm">Aguardando</TabsTrigger>
              <TabsTrigger value="contacted" className="min-w-0 whitespace-normal px-2 text-xs min-[480px]:whitespace-nowrap min-[480px]:px-3 min-[480px]:text-sm">Contatados</TabsTrigger>
              <TabsTrigger value="scheduled" className="min-w-0 whitespace-normal px-2 text-xs min-[480px]:whitespace-nowrap min-[480px]:px-3 min-[480px]:text-sm">Agendados</TabsTrigger>
              <TabsTrigger value="all" className="min-w-0 whitespace-normal px-2 text-xs min-[480px]:whitespace-nowrap min-[480px]:px-3 min-[480px]:text-sm">Todos</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={proFilter} onValueChange={setProFilter}>
              <SelectTrigger className="h-9 w-full min-w-0 rounded-lg sm:w-[160px]">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos prof.</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="h-9 w-full min-w-0 rounded-lg sm:w-[160px]">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder="Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos serv.</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          icon={<Hourglass className="h-6 w-6" />}
          title="Nenhum item nesta fila"
          description="Crie um novo registro para capturar encaixes e oportunidades."
          action={<Button data-critical-action data-testid="waitlist-create-cta" onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" />Novo item</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.entry.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-semibold">{entry.clientName ?? "Cliente"}</p>
                      <StatusBadge tone={waitlistTone(entry.entry.status)}>{waitlistStatusLabels[entry.entry.status]}</StatusBadge>
                      <StatusBadge tone="neutral">prioridade {entry.entry.priority}</StatusBadge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {entry.serviceName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4" />
                          {entry.serviceName}
                        </span>
                      ) : null}
                      {entry.professionalName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound className="h-4 w-4" />
                          {entry.professionalName}
                        </span>
                      ) : null}
                      {entry.unitName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Hourglass className="h-4 w-4" />
                          {entry.unitName}
                        </span>
                      ) : null}
                      {entry.entry.desiredWindowStart ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4" />
                          A partir de {formatDateTime(entry.entry.desiredWindowStart)}
                        </span>
                      ) : null}
                    </div>
                    {entry.entry.notes ? (
                      <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        {entry.entry.notes}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                    {entry.entry.status === "open" ? (
                      <Button size="sm" variant="secondary" onClick={() => void handleStatus(entry, "contacted")}>
                        <PhoneCall className="mr-2 h-4 w-4" /> Marcar contato
                      </Button>
                    ) : null}
                    {entry.entry.status !== "scheduled" ? (
                      <Button size="sm" onClick={() => openScheduleDialog(entry)}>
                        <CalendarDays className="mr-2 h-4 w-4" /> Agendar
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(entry)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    {entry.entry.status !== "canceled" ? (
                      <Button size="sm" variant="ghost" onClick={() => void handleStatus(entry, "canceled")}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancelar
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => void handleDelete(entry.entry.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl sm:w-full">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar item da fila" : "Novo item da fila"}</DialogTitle>
            <DialogDescription>Registre preferência de janela, unidade, profissional e prioridade.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cliente" required>
                <Select value={form.clientId} onValueChange={(value) => setForm((current) => ({ ...current, clientId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Serviço desejado">
                <Select value={form.serviceId} onValueChange={(value) => setForm((current) => ({ ...current, serviceId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Qualquer serviço</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unidade preferida">
                <Select value={form.preferredUnitId} onValueChange={(value) => setForm((current) => ({ ...current, preferredUnitId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Qualquer unidade</SelectItem>
                    {availableUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Profissional preferido">
                <Select value={form.preferredProfessionalId} onValueChange={(value) => setForm((current) => ({ ...current, preferredProfessionalId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Qualquer profissional</SelectItem>
                    {professionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>{professional.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Janela inicial">
                <Input type="datetime-local" value={form.desiredWindowStart} onChange={(event) => setForm((current) => ({ ...current, desiredWindowStart: event.target.value }))} />
              </Field>
              <Field label="Janela final">
                <Input type="datetime-local" value={form.desiredWindowEnd} onChange={(event) => setForm((current) => ({ ...current, desiredWindowEnd: event.target.value }))} />
              </Field>
              <Field label="Prioridade">
                <Input type="number" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} />
              </Field>
            </div>

            <Field label="Notas">
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSaveEntry()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editing ? "Salvar alterações" : "Adicionar à fila"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl sm:w-full">
          <DialogHeader>
            <DialogTitle>Converter fila em agendamento</DialogTitle>
            <DialogDescription>Use a mesma disponibilidade da agenda para encaixar o cliente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Serviço" required>
                <Select value={scheduleForm.serviceId} onValueChange={(value) => setScheduleForm((current) => ({ ...current, serviceId: value, slotStartsAt: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unidade" required>
                <Select value={scheduleForm.unitId} onValueChange={(value) => setScheduleForm((current) => ({ ...current, unitId: value, slotStartsAt: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {availableUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Profissional" required>
                <Select value={scheduleForm.professionalId} onValueChange={(value) => setScheduleForm((current) => ({ ...current, professionalId: value, slotStartsAt: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {professionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>{professional.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data" required>
                <Input type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm((current) => ({ ...current, date: event.target.value, slotStartsAt: "" }))} />
              </Field>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Horários disponíveis</CardTitle>
                <CardDescription>Selecione um slot da agenda ou digite um horário manual.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingSlots ? (
                  <div className="flex h-24 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : slots.length === 0 ? (
                  <EmptyState title="Sem slots livres" description="Informe um horário manual se precisar encaixar." />
                ) : (
                  <RadioGroup value={scheduleForm.slotStartsAt} onValueChange={(value) => setScheduleForm((current) => ({ ...current, slotStartsAt: value, manualTime: value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "" }))} className="grid gap-2 sm:grid-cols-3">
                    {slots.map((slot) => (
                      <label key={slot.startsAt} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${scheduleForm.slotStartsAt === slot.startsAt ? "border-primary bg-primary-soft/40" : "border-border/70"}`}>
                        <RadioGroupItem value={slot.startsAt} />
                        <span>{slot.startsAt ? new Date(slot.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      </label>
                    ))}
                  </RadioGroup>
                )}
                <Separator />
                <Field label="Horário manual">
                  <Input type="time" value={scheduleForm.manualTime} onChange={(event) => setScheduleForm((current) => ({ ...current, manualTime: event.target.value, slotStartsAt: "" }))} />
                </Field>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSchedule()} disabled={scheduling}>
                {scheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
                Criar agendamento
              </Button>
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function waitlistTone(status: WaitlistStatus): "neutral" | "warning" | "success" | "danger" {
  switch (status) {
    case "open":
      return "warning";
    case "contacted":
      return "neutral";
    case "scheduled":
      return "success";
    default:
      return "danger";
  }
}

function todayLocalDate() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function toLocalInput(iso: string) {
  const date = new Date(iso);
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function buildIsoFromDateAndTime(date: string, time: string) {
  if (!date || !time) return "";
  return new Date(`${date}T${time}:00`).toISOString();
}

function addMinutes(iso: string, minutes: number) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
