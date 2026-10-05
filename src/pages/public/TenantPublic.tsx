/**
 * Página pública de divulgação do estabelecimento — /e/:slug
 *
 * Vitrine (capa, apresentação, unidades, serviços, equipe) + agendamento
 * direto: o visitante escolhe unidade, serviço, profissional e horário, entra
 * com Google/Apple e o agendamento é criado pela RPC `create_public_appointment`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Instagram,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  FULL_NAME_ERROR,
  WHATSAPP_ERROR,
  isValidFullName,
  isValidMobileBR,
  maskMobileBR,
} from "@/lib/client-validation";
import { buildManualWhatsAppLink } from "@/lib/whatsapp";
import { getSafeExternalHttpUrl } from "@/lib/external-url";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useAuth } from "@/features/auth/AuthProvider";
import { SocialAuthButtons } from "@/features/auth/SocialAuthButtons";
import {
  createPublicAppointment,
  getPublicTenantPage,
  listPublicAvailability,
  listPublicProfessionals,
  listPublicServices,
  listPublicUnits,
  type PublicProfessional,
  type PublicService,
  type PublicSlot,
  type PublicTenantPage,
  type PublicUnit,
} from "@/repositories/public-page";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hhmm(value: string): string {
  return value.slice(0, 5);
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatInTimezone(value: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: timezone }).format(new Date(value));
}

interface Draft {
  unitId: string | null;
  serviceId: string | null;
  professionalId: string | null;
  day: string | null;
  startsAt: string | null;
  notes: string;
}

const EMPTY_DRAFT: Draft = {
  unitId: null,
  serviceId: null,
  professionalId: null,
  day: null,
  startsAt: null,
  notes: "",
};

export default function TenantPublic() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading } = useAuth();

  const draftKey = `cativa:public_booking:${slug}`;

  const [page, setPage] = useState<PublicTenantPage | null>(null);
  const [units, setUnits] = useState<PublicUnit[]>([]);
  const [services, setServices] = useState<PublicService[]>([]);
  const [pros, setPros] = useState<PublicProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = sessionStorage.getItem(`cativa:public_booking:${slug}`);
      return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY_DRAFT;
    } catch {
      return EMPTY_DRAFT;
    }
  });
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  // Dados obrigatórios do cliente (nome com 2+ palavras e WhatsApp com DDD).
  const contactKey = `cativa:public_contact:${slug}`;
  const [contact, setContact] = useState<{ fullName: string; whatsapp: string }>(() => {
    try {
      const raw = sessionStorage.getItem(`cativa:public_contact:${slug}`);
      return raw ? JSON.parse(raw) : { fullName: "", whatsapp: "" };
    } catch {
      return { fullName: "", whatsapp: "" };
    }
  });
  const [contactLoaded, setContactLoaded] = useState(false);
  // Permite fechar o pop-up para apenas olhar serviços/preços; ele reabre
  // automaticamente quando a pessoa tenta concluir um agendamento.
  const [contactDismissed, setContactDismissed] = useState(false);
  const [contactForm, setContactForm] = useState({ fullName: "", whatsapp: "" });
  const [contactTouched, setContactTouched] = useState(false);
  const contactValid = isValidFullName(contact.fullName) && isValidMobileBR(contact.whatsapp);

  const patch = useCallback((next: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* ignora indisponibilidade de storage */
    }
  }, [draft, draftKey]);

  // Pré-preenche com o cadastro existente do cliente neste estabelecimento.
  useEffect(() => {
    if (!user || !page) {
      setContactLoaded(false);
      return;
    }
    let alive = true;
    (async () => {
      let fullName = contact.fullName;
      let whatsapp = contact.whatsapp;
      try {
        const { data } = await supabase
          .from("client_users")
          .select("clients(full_name, phone, whatsapp_phone)")
          .eq("user_id", user.id)
          .eq("tenant_id", page.tenantId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        const c = (data as { clients?: { full_name?: string; phone?: string; whatsapp_phone?: string } } | null)
          ?.clients;
        if (c) {
          if (!isValidFullName(fullName)) fullName = c.full_name ?? fullName;
          if (!isValidMobileBR(whatsapp)) whatsapp = c.whatsapp_phone || c.phone || whatsapp;
        }
      } catch {
        /* segue com o que tiver */
      }
      if (!isValidFullName(fullName)) {
        const meta = user.user_metadata as Record<string, unknown> | undefined;
        fullName = String(meta?.full_name ?? meta?.name ?? fullName ?? "");
      }
      if (!alive) return;
      const next = { fullName: fullName.trim(), whatsapp: maskMobileBR(whatsapp) };
      setContact(next);
      setContactForm(next);
      setContactLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page?.tenantId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(contactKey, JSON.stringify(contact));
    } catch {
      /* noop */
    }
  }, [contact, contactKey]);

  // Vincula o cliente ao estabelecimento assim que ele entra pelo link:
  // acesso imediato ao portal, sem precisar de agendamento prévio.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    if (!user || !page || !contactLoaded || !contactValid) return;
    let alive = true;
    supabase
      .rpc("join_tenant_via_public_link", {
        _slug: slug,
        _full_name: contact.fullName,
        _phone: contact.whatsapp,
      })
      .then(({ error }) => {
        if (!alive) return;
        if (error) {
          toast.error("Não foi possível liberar seu portal", { description: error.message });
        } else {
          setPortalReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [user, page, slug, contactLoaded, contactValid, contact.fullName, contact.whatsapp]);

  const saveContact = () => {
    setContactTouched(true);
    if (!isValidFullName(contactForm.fullName) || !isValidMobileBR(contactForm.whatsapp)) return;
    setContact({ fullName: contactForm.fullName.trim().replace(/\s+/g, " "), whatsapp: contactForm.whatsapp });
    setContactTouched(false);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const p = await getPublicTenantPage(slug);
        if (!alive) return;
        if (!p) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setPage(p);
        const [u, s] = await Promise.all([listPublicUnits(slug), listPublicServices(slug)]);
        if (!alive) return;
        setUnits(u);
        setServices(s);
        setDraft((prev) => ({
          ...prev,
          unitId: prev.unitId && u.some((x) => x.id === prev.unitId) ? prev.unitId : u[0]?.id ?? null,
        }));
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!draft.unitId) return;
    let alive = true;
    listPublicProfessionals(slug, draft.unitId)
      .then((list) => {
        if (alive) setPros(list);
      })
      .catch(() => {
        if (alive) setPros([]);
      });
    return () => {
      alive = false;
    };
  }, [slug, draft.unitId]);

  useEffect(() => {
    if (!draft.unitId || !draft.serviceId || !draft.day) {
      setSlots([]);
      return;
    }
    let alive = true;
    setSlotsLoading(true);
    listPublicAvailability({
      slug,
      unitId: draft.unitId,
      serviceId: draft.serviceId,
      day: draft.day,
      professionalId: draft.professionalId,
    })
      .then((list) => {
        if (alive) setSlots(list);
      })
      .catch(() => {
        if (alive) setSlots([]);
      })
      .finally(() => {
        if (alive) setSlotsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug, draft.unitId, draft.serviceId, draft.day, draft.professionalId]);

  const selectedUnit = useMemo(() => units.find((u) => u.id === draft.unitId) ?? null, [units, draft.unitId]);
  const selectedService = useMemo(
    () => services.find((s) => s.id === draft.serviceId) ?? null,
    [services, draft.serviceId],
  );
  const selectedSlot = useMemo(
    () => slots.find((s) => s.startsAt === draft.startsAt) ?? null,
    [slots, draft.startsAt],
  );

  const confirm = async () => {
    if (!draft.unitId || !draft.serviceId || !selectedSlot) return;
    if (!contactValid) {
      setContactForm(contact);
      setContactLoaded(true);
      setContactDismissed(false);
      return;
    }
    setSubmitting(true);
    try {
      const id = await createPublicAppointment({
        slug,
        unitId: draft.unitId,
        serviceId: draft.serviceId,
        professionalId: selectedSlot.professionalId,
        startsAt: selectedSlot.startsAt,
        fullName: contact.fullName,
        phone: contact.whatsapp,
        notes: draft.notes || null,
      });
      setConfirmedId(id);
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* noop */
      }
    } catch (error) {
      toast.error("Não foi possível concluir", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <>
        <Helmet>
          <meta name="robots" content="noindex" />
          <title>Página não encontrada | Cativa</title>
        </Helmet>
        <div className="grid min-h-screen place-items-center p-6">
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="Página indisponível"
            description="Este estabelecimento ainda não publicou sua página de agendamento."
          />
        </div>
      </>
    );
  }

  const description =
    page.headline || `Agende online em ${page.name}. Serviços, unidades e horários disponíveis.`;
  const canonical = `https://cativapp.lovable.app/e/${page.slug}`;
  const websiteUrl = getSafeExternalHttpUrl(page.website);

  const needsContact = Boolean(user) && contactLoaded && !contactValid && !confirmedId && !contactDismissed;
  const nameError = contactTouched && !isValidFullName(contactForm.fullName);
  const phoneError = contactTouched && !isValidMobileBR(contactForm.whatsapp);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Dialog
        open={needsContact}
        onOpenChange={(open) => {
          if (!open) setContactDismissed(true);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Complete seu cadastro</DialogTitle>
            <DialogDescription>
              Para {page.name} confirmar seu horário, precisamos do seu nome completo e WhatsApp com DDD. Depois é
              só continuar o agendamento.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveContact();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pc-name">Nome e sobrenome</Label>
              <Input
                id="pc-name"
                autoComplete="name"
                value={contactForm.fullName}
                onChange={(e) => setContactForm((p) => ({ ...p, fullName: e.target.value }))}
                aria-invalid={nameError}
              />
              {nameError && <p className="text-xs text-destructive">{FULL_NAME_ERROR}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pc-wa">WhatsApp (com DDD)</Label>
              <Input
                id="pc-wa"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 99999-9999"
                value={contactForm.whatsapp}
                onChange={(e) => setContactForm((p) => ({ ...p, whatsapp: maskMobileBR(e.target.value) }))}
                aria-invalid={phoneError}
              />
              {phoneError && <p className="text-xs text-destructive">{WHATSAPP_ERROR}</p>}
            </div>
            <Button type="submit" className="min-h-[48px] w-full rounded-2xl">
              Salvar e continuar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Helmet>
        <title>{`${page.name} | Agende online`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${page.name} | Agende online`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {portalReady && !confirmedId && (
        <div className="border-b bg-secondary/60">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className="text-foreground">Seu portal do cliente já está liberado.</span>
            <Button asChild size="sm" variant="outline" className="rounded-2xl">
              <a href="/portal">Acessar meu portal</a>
            </Button>
          </div>
        </div>
      )}

      {/* Capa + identidade */}
      <header className="relative">
        <div
          className="h-40 w-full bg-secondary md:h-56"
          style={
            page.coverUrl
              ? { backgroundImage: `url(${page.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
          aria-hidden="true"
        />
        <div className="mx-auto -mt-10 max-w-3xl px-4">
          <Card className="rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              {page.logoUrl ? (
                <img
                  src={page.logoUrl}
                  alt={`Logo de ${page.name}`}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-xl font-semibold text-primary">
                  {page.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold leading-tight md:text-2xl">{page.name}</h1>
                {page.headline && <p className="mt-1 text-sm text-muted-foreground">{page.headline}</p>}
              </div>
            </div>
            {page.about && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{page.about}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {page.whatsapp && (
                <Button asChild variant="outline" className="min-h-[44px] rounded-2xl">
                  <a
                    href={buildManualWhatsAppLink(page.whatsapp) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              )}
              {page.instagram && (
                <Button asChild variant="outline" className="min-h-[44px] rounded-2xl">
                  <a
                    href={`https://instagram.com/${page.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Instagram className="mr-2 h-4 w-4" /> Instagram
                  </a>
                </Button>
              )}
              {websiteUrl && (
                <Button asChild variant="outline" className="min-h-[44px] rounded-2xl">
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                    <Globe className="mr-2 h-4 w-4" /> Site
                  </a>
                </Button>
              )}
            </div>
          </Card>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-3xl space-y-6 px-4">
        {confirmedId ? (
          <Card className="rounded-2xl p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
            <h2 className="mt-3 text-lg font-semibold">Agendamento solicitado!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {page.name} vai confirmar seu horário. Acompanhe tudo pelo portal do cliente.
            </p>
            <Button asChild className="mt-5 min-h-[48px] w-full rounded-2xl sm:w-auto">
              <a href="/portal">Ir para o portal do cliente</a>
            </Button>
          </Card>
        ) : (
          <>
            {/* Unidades */}
            <section aria-labelledby="unidades">
              <h2 id="unidades" className="mb-3 text-base font-semibold">
                Onde você quer ser atendido
              </h2>
              {units.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma unidade disponível no momento.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {units.map((u) => {
                    const active = u.id === draft.unitId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => patch({ unitId: u.id, professionalId: null, startsAt: null })}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          active ? "border-primary bg-secondary/50" : "border-border hover:bg-muted/50",
                        )}
                        aria-pressed={active}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          <MapPin className="h-4 w-4 text-primary" /> {u.name}
                        </div>
                        {(u.address || u.city) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[u.address, u.city, u.state].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {u.phone && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" /> {u.phone}
                          </p>
                        )}
                        {u.hours.length > 0 && (
                          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                            {u.hours
                              .filter((h) => !h.isClosed)
                              .map((h) => (
                                <li key={h.weekday}>
                                  {WEEKDAYS[h.weekday]}: {hhmm(h.opensAt)} às {hhmm(h.closesAt)}
                                </li>
                              ))}
                          </ul>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Serviços */}
            <section aria-labelledby="servicos">
              <h2 id="servicos" className="mb-3 text-base font-semibold">
                Serviços
              </h2>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum serviço publicado no momento.</p>
              ) : (
                <div className="space-y-3">
                  {services.map((s) => {
                    const active = s.id === draft.serviceId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => patch({ serviceId: s.id, startsAt: null })}
                        className={cn(
                          "flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          active ? "border-primary bg-secondary/50" : "border-border hover:bg-muted/50",
                        )}
                        aria-pressed={active}
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{s.name}</p>
                          {s.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                          )}
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {s.durationMinutes} min
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-primary">
                          {s.priceCents > 0 ? money(s.priceCents) : "sob consulta"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Profissional */}
            {draft.serviceId && (
              <section aria-labelledby="profissional">
                <h2 id="profissional" className="mb-3 text-base font-semibold">
                  Profissional
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => patch({ professionalId: null, startsAt: null })}
                    aria-pressed={!draft.professionalId}
                    className={cn(
                      "min-h-[44px] rounded-2xl border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      !draft.professionalId ? "border-primary bg-secondary/50" : "border-border hover:bg-muted/50",
                    )}
                  >
                    Sem preferência
                  </button>
                  {pros.map((p) => {
                    const active = p.id === draft.professionalId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => patch({ professionalId: p.id, startsAt: null })}
                        aria-pressed={active}
                        className={cn(
                          "min-h-[44px] rounded-2xl border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          active ? "border-primary bg-secondary/50" : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4" /> {p.displayName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Dia e horário */}
            {draft.serviceId && draft.unitId && (
              <section aria-labelledby="horario">
                <h2 id="horario" className="mb-3 text-base font-semibold">
                  Dia e horário
                </h2>
                <Card className="rounded-2xl p-3">
                  <Calendar
                    mode="single"
                    selected={draft.day ? new Date(`${draft.day}T12:00:00`) : undefined}
                    onSelect={(date) => patch({ day: date ? dayKey(date) : null, startsAt: null })}
                    locale={ptBR}
                    disabled={{ before: new Date() }}
                    className="mx-auto"
                  />
                </Card>

                {draft.day && (
                  <div className="mt-4">
                    {slotsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Buscando horários…
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Não há horários livres nesse dia. Escolha outra data.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((s) => {
                          const active = s.startsAt === draft.startsAt;
                          const time = formatInTimezone(s.startsAt, page.timezone, {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <button
                              key={`${s.professionalId}-${s.startsAt}`}
                              type="button"
                              onClick={() => patch({ startsAt: s.startsAt })}
                              aria-pressed={active}
                              className={cn(
                                "min-h-[48px] rounded-2xl border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                active ? "border-primary bg-secondary/60 font-medium" : "border-border hover:bg-muted/50",
                              )}
                            >
                              <span className="block">{time}</span>
                              {!draft.professionalId && (
                                <span className="block text-[10px] text-muted-foreground">
                                  {s.professionalName}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Confirmação */}
            {selectedSlot && selectedService && selectedUnit && (
              <section aria-labelledby="confirmar">
                <h2 id="confirmar" className="mb-3 text-base font-semibold">
                  Confirmar agendamento
                </h2>
                <Card className="space-y-4 rounded-2xl p-5">
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" /> {selectedService.name}
                    </li>
                    <li className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> {selectedUnit.name}
                    </li>
                    <li className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-primary" /> {selectedSlot.professionalName}
                    </li>
                    <li className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {formatInTimezone(selectedSlot.startsAt, page.timezone, {
                        dateStyle: "full",
                        timeStyle: "short",
                      })}
                    </li>
                  </ul>

                  <Textarea
                    value={draft.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    placeholder="Alguma observação para o estabelecimento? (opcional)"
                    className="rounded-2xl"
                    rows={3}
                  />

                  {authLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verificando sua conta…
                    </div>
                  ) : user ? (
                    <>
                    {contactValid && (
                      <p className="text-sm text-muted-foreground">
                        {contact.fullName} · {contact.whatsapp}{" "}
                        <button
                          type="button"
                          className="underline underline-offset-2"
                          onClick={() => {
                            setContactForm(contact);
                            setContact((c) => ({ ...c, whatsapp: "" }));
                          }}
                        >
                          alterar
                        </button>
                      </p>
                    )}
                    <Button
                      onClick={confirm}
                      disabled={submitting}
                      className="min-h-[48px] w-full rounded-2xl"
                    >
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmar horário
                    </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Entre com Google ou Apple para concluir. Sua escolha fica guardada.
                      </p>
                      <SocialAuthButtons redirectPath={`/e/${slug}`} />
                    </div>
                  )}
                </Card>
              </section>
            )}
          </>
        )}

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          Agendamento online por{" "}
          <a href="/" className="underline underline-offset-2">
            Cativa
          </a>
        </footer>
      </main>
    </div>
  );
}
