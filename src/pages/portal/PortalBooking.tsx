import { supabase } from "@/integrations/supabase/client";
import { CalendarX } from "lucide-react";
/**
 * PortalBooking — wizard mobile-first de auto-agendamento (e reagendamento).
 *
 * Steps:
 *  1) Serviço
 *  2) Profissional
 *  3) Dia + horário
 *  4) Confirmação
 *
 * Usa o mesmo motor de disponibilidade interno (RPC get_available_slots).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { usePortalClient } from "@/features/portal/PortalClientProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  listPortalProfessionals,
  listPortalServices,
  listPortalUnits,
  type PortalProfessionalOption,
  type PortalServiceOption,
  type PortalUnitOption,
} from "@/repositories/portal";
import { getAppointment, getAvailableSlots } from "@/repositories/scheduling";
import {
  createBookingFromPortal,
  fetchCancellationPolicy,
  rescheduleFromPortal,
} from "@/services/portal/booking";
import { cn } from "@/lib/utils";
import { calendarDateKey, DEFAULT_TIMEZONE, formatInTimeZone } from "@/lib/date-time";

type Step = 1 | 2 | 3 | 4;

function parseDateParam(value: string | null): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default function PortalBooking() {
  const { activeLink, profile, branding } = usePortalClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rescheduleId = params.get("reschedule");
  const dateParam = params.get("date");
  const [canBook, setCanBook] = useState<boolean | null>(null);
  useEffect(() => {
    if (!activeLink || !user) return;
    let alive = true;
    supabase
      .rpc("portal_can_book", { _user_id: user.id, _tenant_id: activeLink.tenantId })
      .then(({ data, error }) => {
        if (alive) setCanBook(error ? true : Boolean(data));
      });
    return () => {
      alive = false;
    };
  }, [activeLink, user]);

  const [step, setStep] = useState<Step>(1);
  const [units, setUnits] = useState<PortalUnitOption[]>([]);
  const [services, setServices] = useState<PortalServiceOption[]>([]);
  const [pros, setPros] = useState<PortalProfessionalOption[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [unitId, setUnitId] = useState<string | null>(null);
  const [service, setService] = useState<PortalServiceOption | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const [day, setDay] = useState<Date | undefined>(() => parseDateParam(dateParam));
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [chosenSlot, setChosenSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oldStartsAt, setOldStartsAt] = useState<string | null>(null);

  // Carrega catálogo + valores iniciais (preferências)
  useEffect(() => {
    if (!activeLink) return;
    void (async () => {
      setLoadingMeta(true);
      try {
        const [us, sv, pr] = await Promise.all([
          listPortalUnits(activeLink.tenantId),
          listPortalServices(activeLink.tenantId),
          listPortalProfessionals(activeLink.tenantId),
        ]);
        setUnits(us);
        setServices(sv);
        setPros(pr);

        // unidade preferida ou padrão
        const initialUnit =
          profile?.preferredUnitId ??
          us.find((u) => u.isDefault)?.id ??
          us[0]?.id ??
          null;
        setUnitId(initialUnit);

        // se for reagendamento, pré-carrega
        if (rescheduleId) {
          const old = await getAppointment(rescheduleId);
          if (old) {
            setOldStartsAt(old.startsAt);
            setUnitId(old.unitId);
            setProId(old.professionalId);
            // tenta recuperar serviço via items: lemos via repositório
            // (mantemos simples: o cliente reescolhe se necessário).
          }
        }
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [activeLink, profile?.preferredUnitId, rescheduleId]);

  useEffect(() => {
    setDay(parseDateParam(dateParam));
  }, [dateParam]);

  const filteredPros = useMemo(
    () => pros.filter((p) => !p.unitId || p.unitId === unitId),
    [pros, unitId],
  );

  // Carrega slots quando muda dia/profissional/serviço/unidade
  useEffect(() => {
    if (step !== 3 || !service || !proId || !unitId || !day || !activeLink) return;
    void (async () => {
      setLoadingSlots(true);
      setChosenSlot(null);
      try {
        const data = await getAvailableSlots({
          tenantId: activeLink.tenantId,
          professionalId: proId,
          unitId,
          serviceId: service.id,
          day: calendarDateKey(day),
        });
        setSlots(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao buscar horários";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [step, service, proId, unitId, day, activeLink, toast]);

  function next() {
    setStep((s) => (Math.min(4, s + 1) as Step));
  }
  function prev() {
    setStep((s) => (Math.max(1, s - 1) as Step));
  }

  async function submit() {
    if (!activeLink || !service || !proId || !unitId || !chosenSlot) return;
    setSubmitting(true);
    try {
      const policy = service.cancellationPolicyId
        ? await fetchCancellationPolicy(service.cancellationPolicyId)
        : null;

      if (rescheduleId) {
        await rescheduleFromPortal({
          appointmentId: rescheduleId,
          tenantId: activeLink.tenantId,
          unitId,
          professionalId: proId,
          serviceId: service.id,
          startsAt: chosenSlot,
          durationMinutes: service.durationMinutes,
          policy,
          currentStartsAt: oldStartsAt ?? new Date().toISOString(),
          tenantTimezone: branding?.timezone ?? DEFAULT_TIMEZONE,
        });
        toast({ title: "Reagendado!", description: "Seu novo horário foi solicitado." });
      } else {
        await createBookingFromPortal({
          tenantId: activeLink.tenantId,
          unitId,
          clientId: activeLink.clientId,
          professionalId: proId,
          serviceId: service.id,
          startsAt: chosenSlot,
          durationMinutes: service.durationMinutes,
          bufferBeforeMinutes: service.bufferBeforeMinutes,
          bufferAfterMinutes: service.bufferAfterMinutes,
          cancellationPolicyId: service.cancellationPolicyId,
          minAdvanceHours: service.minAdvanceHours,
          createdBy: user?.id ?? null,
          tenantTimezone: branding?.timezone ?? DEFAULT_TIMEZONE,
        });
        toast({
          title: "Agendamento solicitado!",
          description: "A recepção vai confirmar em breve.",
        });
      }
      navigate("/portal/agenda", { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao agendar";
      toast({ title: "Não foi possível concluir", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMeta) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!rescheduleId && canBook === false) {
    return (
      <div className="py-8">
        <EmptyState
          icon={<CalendarX className="h-6 w-6" />}
          title="Agendamento pelo link do estabelecimento"
          description="Para marcar seu primeiro horário aqui, use o link de agendamento divulgado pelo próprio estabelecimento. Depois disso, você poderá agendar direto por este portal."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">
          {rescheduleId ? "Reagendar horário" : "Novo agendamento"}
        </h1>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                n <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
      </header>

      {/* STEP 1 — SERVIÇO */}
      {step === 1 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Escolha o serviço
          </h2>
          {services.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="Sem serviços disponíveis"
              description="Este estabelecimento ainda não publicou serviços para agendamento online."
            />
          ) : (
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    data-testid="portal-service-option"
                    data-service-id={s.id}
                    onClick={() => {
                      setService(s);
                      next();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm",
                      service?.id === s.id && "border-primary",
                    )}
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.durationMinutes} min
                        {s.minAdvanceHours
                          ? ` • antecedência ${s.minAdvanceHours}h`
                          : ""}
                      </p>
                    </div>
                    {s.isFeatured && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-strong">
                        Destaque
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* STEP 2 — PROFISSIONAL */}
      {step === 2 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Com qual profissional?
          </h2>
          {filteredPros.length === 0 ? (
            <EmptyState
              icon={<UserIcon className="h-6 w-6" />}
              title="Sem profissionais disponíveis"
              description="Tente outra unidade ou volte mais tarde."
            />
          ) : (
            <ul className="space-y-2">
              {filteredPros.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-testid="portal-professional-option"
                    data-professional-id={p.id}
                    onClick={() => {
                      setProId(p.id);
                      next();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm",
                      proId === p.id && "border-primary",
                    )}
                  >
                    <div
                      className="grid h-10 w-10 place-items-center rounded-xl text-primary-foreground"
                      style={{ background: p.color || "hsl(var(--primary))" }}
                    >
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.displayName}</p>
                      {p.roleTitle && (
                        <p className="text-xs text-muted-foreground">{p.roleTitle}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={prev}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
        </section>
      )}

      {/* STEP 3 — DIA + SLOT */}
      {step === 3 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Escolha dia e horário
          </h2>
          <Card className="p-3">
            <Calendar
              mode="single"
              selected={day}
              onSelect={setDay}
              disabled={(d) => {
                if (d < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                if (service?.maxAdvanceDays) {
                  const max = new Date();
                  max.setDate(max.getDate() + service.maxAdvanceDays);
                  if (d > max) return true;
                }
                return false;
              }}
              initialFocus
              className="mx-auto"
            />
          </Card>

          {day && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Horários disponíveis
              </h3>
              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-lg" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-md bg-muted px-3 py-3 text-center text-sm text-muted-foreground">
                  Nenhum horário disponível neste dia.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => {
                    const t = formatInTimeZone(s.startsAt, branding?.timezone ?? DEFAULT_TIMEZONE, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    });
                    const active = chosenSlot === s.startsAt;
                    return (
                      <button
                        key={s.startsAt}
                        type="button"
                        data-testid="portal-slot-option"
                        data-slot-start={s.startsAt}
                        onClick={() => setChosenSlot(s.startsAt)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-sm font-medium transition",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card hover:border-primary/40",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={prev}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Button>
            <Button data-testid="portal-slot-continue" onClick={next} disabled={!chosenSlot}>
              Continuar <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* STEP 4 — CONFIRMAÇÃO */}
      {step === 4 && service && chosenSlot && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Confirme seu agendamento
          </h2>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Serviço</p>
                <p className="font-medium">{service.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserIcon className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Profissional</p>
                <p className="font-medium">
                  {pros.find((p) => p.id === proId)?.displayName ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Data e hora</p>
                <p className="font-medium">
                  {formatInTimeZone(chosenSlot, branding?.timezone ?? DEFAULT_TIMEZONE, {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Duração</p>
                <p className="font-medium">{service.durationMinutes} minutos</p>
              </div>
            </div>
            {unitId && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Unidade</p>
                  <p className="font-medium">
                    {units.find((u) => u.id === unitId)?.name ?? "—"}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {service.cancellationPolicyId && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Ao agendar, você concorda com as regras de remarcação e cancelamento
              do estabelecimento.
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={prev} disabled={submitting}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Button>
            <Button data-testid="portal-booking-submit" onClick={submit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {rescheduleId ? "Confirmar reagendamento" : "Confirmar agendamento"}
                </>
              )}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
