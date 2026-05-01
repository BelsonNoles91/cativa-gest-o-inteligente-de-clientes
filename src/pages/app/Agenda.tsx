import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  UserRound,
  XCircle,
  AlarmClock,
  Stethoscope,
  Hourglass,
  Search,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { PageActionCluster, PrimaryAction } from "@/components/shell/PageActionCluster";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { listClients, type Client } from "@/repositories/clients";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { isUsageBlocked } from "@/domain/billing";
import { listBasePrices, listCancellationPolicies, listServices, type Service } from "@/repositories/catalog";
import {
  getAvailableSlots,
  insertAppointment,
  createRecurringBlock,
  createTimeOff,
  deleteRecurringBlock,
  deleteTimeOff,
  listAppointmentsHydrated,
  listProfessionalsLite,
  listRecurringBlocks,
  listResources,
  listTimeOff,
  setAppointmentStatus,
  updateAppointment,
  type HydratedAppointment,
  type ProfessionalLite,
} from "@/repositories/scheduling";
import {
  allowedTransitions,
  appointmentSourceLabels,
  appointmentStatusLabels,
  canTransition,
  formatHourMinute,
  resourceTypeLabels,
  statusTone,
  weekdayShortLabels,
  type BlockScope,
  type AppointmentSource,
  type AppointmentStatus,
  type RecurringBlock,
  type Resource,
  type TimeOffBlock,
} from "@/domain/scheduling";

type ViewMode = "day" | "week";
type GroupMode = "professional" | "resource";

type AppointmentFormState = {
  clientId: string;
  serviceId: string;
  unitId: string;
  professionalId: string;
  resourceId: string;
  date: string;
  slotStartsAt: string;
  manualTime: string;
  source: AppointmentSource;
  status: AppointmentStatus;
  notes: string;
  internalNotes: string;
  isWalkIn: boolean;
  isOverbooked: boolean;
};

type BlockFormState = {
  kind: "time_off" | "recurring";
  scope: BlockScope;
  professionalId: string;
  unitId: string;
  date: string;
  weekday: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

const EMPTY_FORM: AppointmentFormState = {
  clientId: "none",
  serviceId: "none",
  unitId: "none",
  professionalId: "none",
  resourceId: "none",
  date: "",
  slotStartsAt: "",
  manualTime: "",
  source: "frontdesk",
  status: "pending",
  notes: "",
  internalNotes: "",
  isWalkIn: false,
  isOverbooked: false,
};

const EMPTY_BLOCK_FORM: BlockFormState = {
  kind: "time_off",
  scope: "professional",
  professionalId: "none",
  unitId: "none",
  date: todayLocalDate(),
  weekday: "1",
  startsAt: "09:00",
  endsAt: "10:00",
  reason: "",
};

export default function AgendaPage() {
  const [searchParams] = useSearchParams();
  const { currentTenant, currentUnit, availableUnits } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const { usage, limits, plan } = useTenantBilling();
  const isBlockedByLimit = isUsageBlocked(usage.appointmentsLast30d, limits?.maxAppointmentsMonth ?? null);

  const [view, setView] = useState<ViewMode>("day");
  const [groupMode, setGroupMode] = useState<GroupMode>("professional");
  const [selectedDate, setSelectedDate] = useState(todayLocalDate());
  const [unitFilter, setUnitFilter] = useState("all");
  const [professionalFilter, setProfessionalFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [refreshToken, setRefreshToken] = useState(0);
  const [quickSearch, setQuickSearch] = useState("");


  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<HydratedAppointment[]>([]);
  const [timeOffBlocks, setTimeOffBlocks] = useState<TimeOffBlock[]>([]);
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringBlock[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalLite[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [basePrices, setBasePrices] = useState<Map<string, number>>(new Map());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HydratedAppointment | null>(null);
  const [form, setForm] = useState<AppointmentFormState>(EMPTY_FORM);
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockFormState>(EMPTY_BLOCK_FORM);
  const [savingBlock, setSavingBlock] = useState(false);

  useEffect(() => {
    const date = searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setSelectedDate((current) => (current === date ? current : date));
  }, [searchParams]);

  const servicesMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const resourcesMap = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources]);
  const selectedService = form.serviceId !== "none" ? (servicesMap.get(form.serviceId) ?? null) : null;

  const range = useMemo(() => {
    if (view === "day") {
      const start = new Date(`${selectedDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    const weekStart = startOfWeek(new Date(`${selectedDate}T00:00:00`));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return { start: weekStart, end: weekEnd };
  }, [selectedDate, view]);

  useEffect(() => {
    if (!currentTenant) return;
    let ignore = false;
    setLoading(true);
    void (async () => {
      try {
        const [nextAppointments, nextTimeOff, nextRecurring, nextServices, nextClients, nextProfessionals, nextResources, nextBasePrices] = await Promise.all([
          listAppointmentsHydrated({
            tenantId: currentTenant.id,
            unitId: unitFilter === "all" ? undefined : unitFilter,
            professionalId: professionalFilter === "all" ? undefined : professionalFilter,
            rangeStart: range.start.toISOString(),
            rangeEnd: range.end.toISOString(),
          }),
          listTimeOff(currentTenant.id, range.start.toISOString(), range.end.toISOString()),
          listRecurringBlocks(currentTenant.id),
          listServices({ tenantId: currentTenant.id, activeOnly: true }),
          listClients({ tenantId: currentTenant.id, limit: 500 }),
          listProfessionalsLite(currentTenant.id, unitFilter === "all" ? undefined : unitFilter),
          listResources(currentTenant.id, unitFilter === "all" ? undefined : unitFilter),
          listBasePrices(currentTenant.id),
        ]);
        if (ignore) return;
        setAppointments(nextAppointments);
        setTimeOffBlocks(nextTimeOff);
        setRecurringBlocks(nextRecurring);
        setServices(nextServices);
        setClients(nextClients);
        setProfessionals(nextProfessionals);
        setResources(nextResources);
        setBasePrices(new Map(Array.from(nextBasePrices.entries()).map(([id, row]) => [id, row.amountCents])));
      } catch (error) {
        if (ignore) return;
        toast({
          title: "Erro ao carregar agenda",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentTenant, unitFilter, professionalFilter, range, refreshToken, toast]);

  useEffect(() => {
    if (!currentUnit && availableUnits.length === 0) return;
    if (form.unitId !== "none") return;
    setForm((current) => ({
      ...current,
      unitId: unitFilter !== "all"
        ? unitFilter
        : currentUnit?.id ?? availableUnits[0]?.id ?? "none",
      date: current.date || selectedDate,
    }));
  }, [availableUnits, currentUnit?.id, form.unitId, selectedDate, unitFilter]);

  useEffect(() => {
    const shouldLoadSlots =
      dialogOpen &&
      form.unitId !== "none" &&
      form.professionalId !== "none" &&
      form.serviceId !== "none" &&
      Boolean(form.date) &&
      !form.isOverbooked &&
      !!currentTenant;

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
          professionalId: form.professionalId,
          unitId: form.unitId,
          serviceId: form.serviceId,
          day: form.date,
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
  }, [currentTenant, dialogOpen, form.date, form.isOverbooked, form.professionalId, form.serviceId, form.unitId, toast]);

  const stats = useMemo(() => {
    const filteredAppointments = groupMode === "resource" && resourceFilter !== "all"
      ? appointments.filter((item) => (item.appointment.resourceId ?? "__none__") === resourceFilter)
      : appointments;
    const total = filteredAppointments.length;
    const confirmed = filteredAppointments.filter((item) => ["confirmed", "reminded"].includes(item.appointment.status)).length;
    const arrived = filteredAppointments.filter((item) => ["arrived", "in_service"].includes(item.appointment.status)).length;
    const completed = filteredAppointments.filter((item) => item.appointment.status === "completed").length;
    return { total, confirmed, arrived, completed };
  }, [appointments, groupMode, resourceFilter]);

  const visibleAppointments = useMemo(() => {
    let result = appointments;
    if (groupMode === "resource" && resourceFilter !== "all") {
      result = result.filter((item) => (item.appointment.resourceId ?? "__none__") === resourceFilter);
    }
    
    if (quickSearch.trim()) {
      const s = quickSearch.toLowerCase();
      result = result.filter(item => 
        item.clientName?.toLowerCase().includes(s) || 
        item.serviceName?.toLowerCase().includes(s) || 
        item.professionalName?.toLowerCase().includes(s)
      );
    }
    
    return result;
  }, [appointments, groupMode, resourceFilter, quickSearch]);

  const groupedAppointments = useMemo(() => {
    const groups = new Map<string, HydratedAppointment[]>();
    visibleAppointments.forEach((item) => {
      const key = item.appointment.startsAt.slice(0, 10);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleAppointments]);

  const resourceSections = useMemo(() => {
    const groups = new Map<string, { resource: Resource | null; items: HydratedAppointment[] }>();
    visibleAppointments.forEach((item) => {
      const key = item.appointment.resourceId ?? "__none__";
      const current = groups.get(key) ?? {
        resource: item.appointment.resourceId ? (resourcesMap.get(item.appointment.resourceId) ?? null) : null,
        items: [],
      };
      current.items.push(item);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .sort(([leftKey, left], [rightKey, right]) => {
        if (leftKey === "__none__") return 1;
        if (rightKey === "__none__") return -1;
        return (left.resource?.name ?? "").localeCompare(right.resource?.name ?? "");
      })
      .map(([key, value]) => ({
        key,
        resource: value.resource,
        items: value.items.sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt)),
      }));
  }, [resourcesMap, visibleAppointments]);

  async function refreshAgenda(manual = false) {
    if (manual) setRefreshing(true);
    setRefreshToken((current) => current + 1);
  }

  function openCreateDialog() {
    if (isBlockedByLimit) {
      toast({
        title: "Limite de agendamentos atingido",
        description: `Seu plano ${plan?.name} atingiu o limite de ${limits?.maxAppointmentsMonth} atendimentos mensais. Faça upgrade para continuar.`,
        variant: "destructive",
      });
      return;
    }
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      unitId: unitFilter !== "all" ? unitFilter : currentUnit?.id ?? availableUnits[0]?.id ?? "none",
      date: selectedDate,
    });
    setSlots([]);
    setDialogOpen(true);
  }

  function openEditDialog(item: HydratedAppointment) {
    const startsAt = new Date(item.appointment.startsAt);
    setEditing(item);
    setForm({
      clientId: item.appointment.clientId,
      serviceId: item.serviceId ?? "none",
      unitId: item.appointment.unitId,
      professionalId: item.appointment.professionalId,
      resourceId: item.appointment.resourceId ?? "none",
      date: item.appointment.startsAt.slice(0, 10),
      slotStartsAt: item.appointment.startsAt,
      manualTime: startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }),
      source: item.appointment.source,
      status: item.appointment.status,
      notes: item.appointment.notes ?? "",
      internalNotes: item.appointment.internalNotes ?? "",
      isWalkIn: item.appointment.isWalkIn,
      isOverbooked: item.appointment.isOverbooked,
    });
    setDialogOpen(true);
  }

  async function handleQuickStatus(item: HydratedAppointment, nextStatus: AppointmentStatus) {
    try {
      await setAppointmentStatus(
        item.appointment.id,
        nextStatus,
        nextStatus === "canceled" ? { reason: "Cancelado pela equipe na agenda" } : undefined,
      );
      toast({ title: `Status alterado para ${appointmentStatusLabels[nextStatus].toLowerCase()}` });
      await refreshAgenda();
    } catch (error) {
      toast({
        title: "Falha ao atualizar status",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleSaveAppointment() {
    if (!currentTenant) return;
    if (form.unitId === "none" || form.professionalId === "none" || !form.date) {
      toast({ title: "Campos obrigatórios", description: "Selecione unidade, profissional e data.", variant: "destructive" });
      return;
    }
    if (!editing && (form.clientId === "none" || form.serviceId === "none")) {
      toast({ title: "Campos obrigatórios", description: "Selecione cliente e serviço.", variant: "destructive" });
      return;
    }

    const service = editing
      ? (editing.serviceId ? servicesMap.get(editing.serviceId) ?? null : null)
      : selectedService;
    const duration = service?.durationMinutes ?? editing?.appointment.durationMinutes ?? 0;
    if (!duration) {
      toast({ title: "Serviço inválido", description: "Não foi possível determinar a duração do agendamento.", variant: "destructive" });
      return;
    }

    const startsAt = form.isOverbooked
      ? buildIsoFromDateAndTime(form.date, form.manualTime)
      : form.slotStartsAt || buildIsoFromDateAndTime(form.date, form.manualTime);

    if (!startsAt) {
      toast({ title: "Horário obrigatório", description: "Selecione um slot disponível ou informe um horário manual.", variant: "destructive" });
      return;
    }

    const endsAt = addMinutes(startsAt, duration);
    setSaving(true);
    try {
      if (editing) {
        await updateAppointment(editing.appointment.id, {
          startsAt,
          endsAt,
          unitId: form.unitId,
          professionalId: form.professionalId,
          resourceId: form.resourceId === "none" ? null : form.resourceId,
          notes: emptyToNull(form.notes),
          internalNotes: emptyToNull(form.internalNotes),
          isOverbooked: form.isOverbooked,
        });
        if (form.status !== editing.appointment.status) {
          if (!canTransition(editing.appointment.status, form.status)) {
            throw new Error(`Transição inválida: ${appointmentStatusLabels[editing.appointment.status]} → ${appointmentStatusLabels[form.status]}`);
          }
          await setAppointmentStatus(
            editing.appointment.id,
            form.status,
            form.status === "canceled" ? { reason: "Cancelado manualmente pela equipe" } : undefined,
          );
        }
        toast({ title: "Agendamento atualizado" });
      } else {
        await insertAppointment({
          tenantId: currentTenant.id,
          unitId: form.unitId,
          clientId: form.clientId,
          professionalId: form.professionalId,
          serviceId: form.serviceId,
          startsAt,
          endsAt,
          durationMinutes: duration,
          bufferBeforeMinutes: service?.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: service?.bufferAfterMinutes ?? 0,
          resourceId: form.resourceId === "none" ? null : form.resourceId,
          cancellationPolicyId: service?.cancellationPolicyId ?? null,
          source: form.isWalkIn ? "walk_in" : form.source,
          status: form.status,
          notes: emptyToNull(form.notes),
          internalNotes: emptyToNull(form.internalNotes),
          totalPriceCents: basePrices.get(form.serviceId) ?? 0,
          isWalkIn: form.isWalkIn,
          isOverbooked: form.isOverbooked,
          createdBy: user?.id ?? null,
          itemPriceCents: basePrices.get(form.serviceId) ?? 0,
        });
        toast({ title: "Agendamento criado" });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await refreshAgenda();
    } catch (error) {
      toast({
        title: "Falha ao salvar agendamento",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBlock() {
    if (!currentTenant) return;
    if (blockForm.kind === "time_off" && !blockForm.date) {
      toast({ title: "Data obrigatória", description: "Selecione a data do bloqueio.", variant: "destructive" });
      return;
    }
    if (!blockForm.startsAt || !blockForm.endsAt) {
      toast({ title: "Horário obrigatório", description: "Informe início e fim do bloqueio.", variant: "destructive" });
      return;
    }
    setSavingBlock(true);
    try {
      if (blockForm.kind === "time_off") {
        await createTimeOff({
          tenantId: currentTenant.id,
          scope: blockForm.scope,
          professionalId: blockForm.scope === "professional" && blockForm.professionalId !== "none" ? blockForm.professionalId : null,
          unitId: blockForm.scope === "unit" && blockForm.unitId !== "none" ? blockForm.unitId : null,
          startsAt: new Date(`${blockForm.date}T${blockForm.startsAt}:00`).toISOString(),
          endsAt: new Date(`${blockForm.date}T${blockForm.endsAt}:00`).toISOString(),
          reason: emptyToNull(blockForm.reason),
        });
      } else {
        await createRecurringBlock({
          tenantId: currentTenant.id,
          weekday: parseInt(blockForm.weekday, 10),
          startsAt: `${blockForm.startsAt}:00`,
          endsAt: `${blockForm.endsAt}:00`,
          professionalId: blockForm.professionalId !== "none" ? blockForm.professionalId : null,
          unitId: blockForm.unitId !== "none" ? blockForm.unitId : null,
          reason: emptyToNull(blockForm.reason),
        });
      }
      toast({ title: "Bloqueio registrado" });
      setBlockDialogOpen(false);
      setBlockForm(EMPTY_BLOCK_FORM);
      await refreshAgenda();
    } catch (error) {
      toast({
        title: "Falha ao salvar bloqueio",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingBlock(false);
    }
  }

  async function handleDeleteTimeOff(id: string) {
    try {
      await deleteTimeOff(id);
      toast({ title: "Bloqueio removido" });
      await refreshAgenda();
    } catch (error) {
      toast({
        title: "Falha ao remover bloqueio",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteRecurring(id: string) {
    try {
      await deleteRecurringBlock(id);
      toast({ title: "Bloqueio recorrente removido" });
      await refreshAgenda();
    } catch (error) {
      toast({
        title: "Falha ao remover bloqueio recorrente",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Visão diária e semanal com criação, remarcação e controle de status em poucos toques."
        icon={<CalendarDays className="h-5 w-5" />}
        actions={
          <PageActionCluster
            secondary={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: RefreshCcw,
                tooltip: refreshing ? "Atualizando agenda…" : "Recarregar agenda",
                loading: refreshing,
                onClick: () => void refreshAgenda(true),
              },
            ]}
            primary={
              <PrimaryAction onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" /> Novo agendamento
              </PrimaryAction>
            }
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Agendamentos"
          value={String(stats.total)}
          helper={view === "day" ? "No dia selecionado" : "Na semana"}
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <MetricCard
          label="Confirmados"
          value={String(stats.confirmed)}
          helper="Prontos para confirmação final"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Chegaram / em atendimento"
          value={String(stats.arrived)}
          helper="Fluxo operacional em curso"
          icon={<Stethoscope className="h-5 w-5" />}
        />
        <MetricCard
          label="Concluídos"
          value={String(stats.completed)}
          helper="Atendimentos finalizados"
          icon={<Hourglass className="h-5 w-5" />}
        />
      </div>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Busca rápida: cliente, serviço ou profissional..." 
              className="pl-9 h-11 rounded-xl bg-muted/30 border-border/60"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 xl:grid-cols-[auto_auto_minmax(0,1fr)] xl:items-end xl:gap-4">
            <Field label="Período">
              <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
                <TabsList className="h-10 w-full sm:w-auto">
                  <TabsTrigger value="day" className="px-4">Dia</TabsTrigger>
                  <TabsTrigger value="week" className="px-4">Semana</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>

            <Field label="Agrupar por">
              <Tabs value={groupMode} onValueChange={(value) => setGroupMode(value as GroupMode)}>
                <TabsList className="h-10 w-full sm:w-auto">
                  <TabsTrigger value="professional" className="px-4">Profissional</TabsTrigger>
                  <TabsTrigger value="resource" className="px-4">Recurso / sala</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>

            <div className={`grid gap-3 ${groupMode === "resource" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
              <Field label="Data base">
                <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </Field>
              <Field label="Unidade">
                <Select value={unitFilter} onValueChange={setUnitFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {availableUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Profissional">
                <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os profissionais</SelectItem>
                    {professionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>{professional.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {groupMode === "resource" ? (
                <Field label="Recurso / sala">
                  <Select value={resourceFilter} onValueChange={setResourceFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os recursos</SelectItem>
                      <SelectItem value="__none__">Sem recurso atribuído</SelectItem>
                      {resources.map((resource) => (
                        <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="space-y-6">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : visibleAppointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title="Nenhum agendamento encontrado"
              description={
                groupMode === "resource"
                  ? "Ajuste o recurso selecionado ou atribua um recurso aos agendamentos."
                  : "Ajuste filtros ou crie um novo horário para preencher a agenda."
              }
              action={<Button data-critical-action data-testid="agenda-create-cta" onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" />Criar agendamento</Button>}
            />
          ) : groupMode === "resource" ? (
            <div className="space-y-4">
              {resourceSections.map((section) => (
                <Card key={section.key}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          {section.resource?.name ?? "Sem recurso atribuído"}
                        </CardTitle>
                        <CardDescription>
                          {section.items.length} agendamento(s) {view === "day" ? "no dia" : "no período"}
                        </CardDescription>
                      </div>
                      <StatusBadge tone="info">
                        {section.resource ? resourceTypeLabels[section.resource.resourceType] : "Sem recurso"}
                      </StatusBadge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {section.items.map((item) => (
                      <AppointmentCard
                        key={item.appointment.id}
                        item={item}
                        compact={view === "week"}
                        onEdit={() => openEditDialog(item)}
                        onStatusChange={(status) => void handleQuickStatus(item, status)}
                      />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : view === "day" ? (
            <div className="space-y-3">
              {visibleAppointments.map((item) => (
                <AppointmentCard
                  key={item.appointment.id}
                  item={item}
                  onEdit={() => openEditDialog(item)}
                  onStatusChange={(status) => void handleQuickStatus(item, status)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedAppointments.map(([date, items]) => (
                <Card key={date}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{formatDateHeading(date)}</CardTitle>
                    <CardDescription>{items.length} agendamento(s)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {items.map((item) => (
                      <AppointmentCard
                        key={item.appointment.id}
                        item={item}
                        compact
                        onEdit={() => openEditDialog(item)}
                        onStatusChange={(status) => void handleQuickStatus(item, status)}
                      />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Bloqueios e indisponibilidades</CardTitle>
                  <CardDescription>Gerencie pausas pontuais e bloqueios recorrentes.</CardDescription>
                </div>
                <Button size="sm" onClick={() => {
                  setBlockForm({
                    ...EMPTY_BLOCK_FORM,
                    unitId: currentUnit?.id ?? availableUnits[0]?.id ?? "none",
                  });
                  setBlockDialogOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Novo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-medium">Pontuais no período</p>
                {timeOffBlocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum bloqueio pontual no período atual.</p>
                ) : (
                  timeOffBlocks.map((block) => (
                    <div key={block.id} className="rounded-2xl border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{block.reason || "Bloqueio sem motivo"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(block.startsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            {" - "}
                            {new Date(block.endsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => void handleDeleteTimeOff(block.id)}>
                          <XCircle className="mr-1.5 h-4 w-4" /> Remover
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">Recorrentes</p>
                {recurringBlocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum bloqueio recorrente cadastrado.</p>
                ) : (
                  recurringBlocks.map((block) => (
                    <div key={block.id} className="rounded-2xl border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{block.reason || "Bloqueio recorrente"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {weekdayShortLabels[block.weekday]} · {formatHourMinute(block.startsAt)} - {formatHourMinute(block.endsAt)}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => void handleDeleteRecurring(block.id)}>
                          <XCircle className="mr-1.5 h-4 w-4" /> Remover
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Ajuste horário, profissional, recursos, observações e status."
                : "Use o mesmo motor de disponibilidade do portal para agendar internamente."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cliente" required>
                <Select value={form.clientId} onValueChange={(value) => setForm((current) => ({ ...current, clientId: value }))} disabled={!!editing}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Serviço" required>
                <Select value={form.serviceId} onValueChange={(value) => setForm((current) => ({ ...current, serviceId: value, slotStartsAt: "", manualTime: "" }))} disabled={!!editing}>
                  <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unidade" required>
                <Select value={form.unitId} onValueChange={(value) => setForm((current) => ({ ...current, unitId: value, slotStartsAt: "" }))}>
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
                <Select value={form.professionalId} onValueChange={(value) => setForm((current) => ({ ...current, professionalId: value, slotStartsAt: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {professionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>{professional.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Recurso">
                <Select value={form.resourceId} onValueChange={(value) => setForm((current) => ({ ...current, resourceId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem recurso</SelectItem>
                    {resources.map((resource) => (
                      <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data" required>
                <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value, slotStartsAt: "" }))} />
              </Field>
              <Field label="Origem">
                <Select value={form.source} onValueChange={(value) => setForm((current) => ({ ...current, source: value as AppointmentSource }))} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(appointmentSourceLabels) as AppointmentSource[]).map((source) => (
                      <SelectItem key={source} value={source}>{appointmentSourceLabels[source]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status inicial">
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as AppointmentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(editing
                      ? [editing.appointment.status, ...allowedTransitions[editing.appointment.status]]
                      : ["pending", "confirmed", "requested"]) as AppointmentStatus[]}
                    {Array.from(new Set(
                      (editing
                        ? [editing.appointment.status, ...allowedTransitions[editing.appointment.status]]
                        : ["pending", "confirmed", "requested"]) as AppointmentStatus[],
                    )).map((status) => (
                      <SelectItem key={status} value={status}>{appointmentStatusLabels[status]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Horários disponíveis</CardTitle>
                  <CardDescription>
                    {form.isOverbooked
                      ? "Modo encaixe ativado: informe o horário manualmente."
                      : "Selecione um slot retornado pelo motor de disponibilidade."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingSlots ? (
                    <div className="flex h-24 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : form.isOverbooked ? (
                    <Field label="Horário manual">
                      <Input type="time" value={form.manualTime} onChange={(event) => setForm((current) => ({ ...current, manualTime: event.target.value }))} />
                    </Field>
                  ) : slots.length === 0 ? (
                    <EmptyState
                      title="Nenhum slot encontrado"
                      description="Troque data, profissional, serviço ou ative o encaixe manual."
                    />
                  ) : (
                    <RadioGroup value={form.slotStartsAt} onValueChange={(value) => setForm((current) => ({ ...current, slotStartsAt: value, manualTime: value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "" }))} className="grid gap-2 sm:grid-cols-3">
                      {slots.map((slot) => (
                        <label key={slot.startsAt} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${form.slotStartsAt === slot.startsAt ? "border-primary bg-primary-soft/40" : "border-border/70"}`}>
                          <RadioGroupItem value={slot.startsAt} />
                          <span>{formatHourMinute(slot.startsAt)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Operação</CardTitle>
                  <CardDescription>Use encaixe quando precisar furar a disponibilidade padrão.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ToggleField
                    label="Encaixe / overbooking"
                    description="Permite informar horário manual quando não houver slot disponível."
                    checked={form.isOverbooked}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, isOverbooked: checked, slotStartsAt: checked ? "" : current.slotStartsAt }))}
                  />
                  <ToggleField
                    label="Walk-in"
                    description="Marca o atendimento como encaixe presencial."
                    checked={form.isWalkIn}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, isWalkIn: checked }))}
                  />
                  <SummaryRow label="Serviço" value={selectedService?.name ?? editing?.serviceName ?? "—"} />
                  <SummaryRow label="Duração" value={selectedService ? `${selectedService.durationMinutes} min` : editing ? `${editing.appointment.durationMinutes} min` : "—"} />
                  <SummaryRow label="Preço base" value={form.serviceId !== "none" ? formatCurrency(basePrices.get(form.serviceId) ?? 0) : editing?.serviceId ? formatCurrency(basePrices.get(editing.serviceId) ?? editing.appointment.totalPriceCents) : "—"} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Observações visíveis">
                <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
              </Field>
              <Field label="Notas internas">
                <Textarea value={form.internalNotes} onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))} rows={4} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSaveAppointment()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {editing ? "Salvar alterações" : "Criar agendamento"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo bloqueio</DialogTitle>
            <DialogDescription>Cadastre indisponibilidades pontuais ou recorrentes.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tipo">
                <Select value={blockForm.kind} onValueChange={(value) => setBlockForm((current) => ({ ...current, kind: value as "time_off" | "recurring" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time_off">Pontual</SelectItem>
                    <SelectItem value="recurring">Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Escopo">
                <Select value={blockForm.scope} onValueChange={(value) => setBlockForm((current) => ({ ...current, scope: value as BlockScope }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Profissional</SelectItem>
                    <SelectItem value="unit">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {blockForm.scope === "professional" ? (
                <Field label="Profissional">
                  <Select value={blockForm.professionalId} onValueChange={(value) => setBlockForm((current) => ({ ...current, professionalId: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione</SelectItem>
                      {professionals.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>{professional.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field label="Unidade">
                  <Select value={blockForm.unitId} onValueChange={(value) => setBlockForm((current) => ({ ...current, unitId: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione</SelectItem>
                      {availableUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {blockForm.kind === "time_off" ? (
                <Field label="Data">
                  <Input type="date" value={blockForm.date} onChange={(event) => setBlockForm((current) => ({ ...current, date: event.target.value }))} />
                </Field>
              ) : (
                <Field label="Dia da semana">
                  <Select value={blockForm.weekday} onValueChange={(value) => setBlockForm((current) => ({ ...current, weekday: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {weekdayShortLabels.map((label, index) => (
                        <SelectItem key={label} value={String(index)}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Início">
                <Input type="time" value={blockForm.startsAt} onChange={(event) => setBlockForm((current) => ({ ...current, startsAt: event.target.value }))} />
              </Field>
              <Field label="Fim">
                <Input type="time" value={blockForm.endsAt} onChange={(event) => setBlockForm((current) => ({ ...current, endsAt: event.target.value }))} />
              </Field>
            </div>

            <Field label="Motivo">
              <Textarea value={blockForm.reason} onChange={(event) => setBlockForm((current) => ({ ...current, reason: event.target.value }))} rows={3} />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSaveBlock()} disabled={savingBlock}>
                {savingBlock ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Salvar bloqueio
              </Button>
              <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppointmentCard({
  item,
  onEdit,
  onStatusChange,
  compact = false,
}: {
  item: HydratedAppointment;
  onEdit: () => void;
  onStatusChange: (status: AppointmentStatus) => void;
  compact?: boolean;
}) {
  const tone = mapTone(statusTone(item.appointment.status));
  const quickActions = actionCandidates(item.appointment.status);

  return (
    <Card>
      <CardContent className={compact ? "pt-5" : "pt-6"}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-semibold">{item.serviceName ?? "Atendimento"}</p>
              <StatusBadge tone={tone}>{appointmentStatusLabels[item.appointment.status]}</StatusBadge>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                {formatHourMinute(item.appointment.startsAt)} - {formatHourMinute(item.appointment.endsAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                {item.clientName ?? "Cliente não identificado"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4" />
                {item.professionalName ?? "Profissional não identificado"}
              </span>
              {item.unitName ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {item.unitName}
                </span>
              ) : null}
              {item.resourceName ? (
                <span className="inline-flex items-center gap-1.5">
                  <Hourglass className="h-4 w-4" />
                  {item.resourceName}
                </span>
              ) : null}
            </div>
            {(item.appointment.notes || item.appointment.internalNotes) && (
              <div className="grid gap-2 md:grid-cols-2">
                {item.appointment.notes ? (
                  <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <strong className="font-medium text-foreground">Obs. cliente:</strong> {item.appointment.notes}
                  </div>
                ) : null}
                {item.appointment.internalNotes ? (
                  <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <strong className="font-medium text-foreground">Obs. interna:</strong> {item.appointment.internalNotes}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
            {quickActions.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === "canceled" || status === "no_show" ? "outline" : "secondary"}
                onClick={() => onStatusChange(status)}
              >
                {quickActionLabel(status)}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4 md:p-5">
        {icon ? (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-soft text-primary">
            {icon}
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p
            className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            title={label}
          >
            {label}
          </p>
          <p className="font-display text-2xl font-semibold leading-none md:text-3xl">{value}</p>
          <p className="truncate text-xs text-muted-foreground" title={helper}>
            {helper}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
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

function mapTone(tone: ReturnType<typeof statusTone>): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "destructive":
      return "danger";
    case "info":
      return "info";
    default:
      return "neutral";
  }
}

function actionCandidates(status: AppointmentStatus): AppointmentStatus[] {
  const candidates: AppointmentStatus[] = [];
  if (allowedTransitions[status].includes("confirmed")) candidates.push("confirmed");
  if (allowedTransitions[status].includes("arrived")) candidates.push("arrived");
  if (allowedTransitions[status].includes("in_service")) candidates.push("in_service");
  if (allowedTransitions[status].includes("completed")) candidates.push("completed");
  if (allowedTransitions[status].includes("no_show")) candidates.push("no_show");
  if (allowedTransitions[status].includes("canceled")) candidates.push("canceled");
  return candidates;
}

function quickActionLabel(status: AppointmentStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmar";
    case "arrived":
      return "Chegou";
    case "in_service":
      return "Iniciar";
    case "completed":
      return "Concluir";
    case "no_show":
      return "No-show";
    case "canceled":
      return "Cancelar";
    default:
      return appointmentStatusLabels[status];
  }
}

function todayLocalDate() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const cloned = new Date(date);
  const day = cloned.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  cloned.setDate(cloned.getDate() + diff);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

function formatDateHeading(dateIso: string) {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
