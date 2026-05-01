import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Hourglass,
  Loader2,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTenant } from "@/features/tenant/TenantProvider";
import { listClients } from "@/repositories/clients";
import { listServices } from "@/repositories/catalog";
import { listAppointmentsHydrated, type HydratedAppointment } from "@/repositories/scheduling";
import type { Client } from "@/domain/client";
import type { Service } from "@/domain/catalog";

interface GlobalSearchProps {
  className?: string;
  /** Controle externo de abertura (para acionar via botão no header mobile, etc.). */
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  /** Quando true, esconde o input "trigger" e renderiza apenas o CommandDialog. */
  hideTrigger?: boolean;
}

export function GlobalSearch({
  className,
  controlledOpen,
  onControlledOpenChange,
  hideTrigger = false,
}: GlobalSearchProps) {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onControlledOpenChange?.(next);
    else setInternalOpen(next);
  };

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<HydratedAppointment[]>([]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isControlled]);

  useEffect(() => {
    if (!open || !currentTenant) return;
    let ignore = false;
    setLoading(true);

    void (async () => {
      try {
        const start = new Date();
        const end = new Date(start.getTime() + 14 * 86_400_000);
        const [nextClients, nextServices, nextAppointments] = await Promise.all([
          listClients({ tenantId: currentTenant.id, limit: 200 }),
          listServices({ tenantId: currentTenant.id, activeOnly: true }),
          listAppointmentsHydrated({
            tenantId: currentTenant.id,
            rangeStart: start.toISOString(),
            rangeEnd: end.toISOString(),
          }),
        ]);
        if (ignore) return;
        setClients(nextClients);
        setServices(nextServices);
        setAppointments(nextAppointments.slice(0, 80));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [open, currentTenant]);

  const quickActions = useMemo(
    () => [
      { label: "Abrir agenda de hoje", icon: CalendarDays, to: `/app/agenda?date=${todayIso()}` },
      { label: "Abrir confirmações", icon: CheckCircle2, to: "/app/confirmacoes" },
      { label: "Abrir lista de espera", icon: Hourglass, to: "/app/lista-de-espera" },
      { label: "Abrir clientes", icon: Users, to: "/app/clientes" },
    ],
    [],
  );


  const filteredClients = useMemo(
    () => clients.slice(0, 8),
    [clients],
  );
  const filteredServices = useMemo(
    () => services.slice(0, 8),
    [services],
  );
  const filteredAppointments = useMemo(
    () => appointments.slice(0, 8),
    [appointments],
  );


  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  return (
    <>
      {!hideTrigger && (
        <div className={cn("relative w-full", className)}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <button
            type="button"
            aria-label="Abrir busca global"
            onClick={() => setOpen(true)}
            className="w-full text-left"
          >
            <Input
              type="search"
              readOnly
              placeholder="Buscar clientes, agendamentos, serviços…"
              aria-label="Busca global"
              className="h-11 cursor-pointer rounded-xl border-border/70 bg-card/60 pl-9 shadow-xs focus-visible:bg-card"
            />
          </button>
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            ⌘K
          </kbd>

        </div>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar em clientes, agenda e serviços..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          <CommandGroup heading="Atalhos">
            {quickActions.map((action) => (
              <CommandItem key={action.label} value={action.label} onSelect={() => go(action.to)}>
                <action.icon className="mr-2 h-4 w-4 text-primary" />
                <span>{action.label}</span>
                <CommandShortcut>Ir</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando base de busca...
            </div>
          ) : (
            <>
              <CommandGroup heading="Clientes">
                {filteredClients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.fullName} ${client.phone ?? ""} ${client.email ?? ""}`}
                    onSelect={() => go(`/app/clientes?search=${encodeURIComponent(client.fullName)}`)}
                  >
                    <Users className="mr-2 h-4 w-4 text-primary" />
                    <span>{client.fullName}</span>
                    <CommandShortcut>{client.phone ?? "CRM"}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Serviços">
                {filteredServices.map((service) => (
                  <CommandItem
                    key={service.id}
                    value={`${service.name} ${service.description ?? ""}`}
                    onSelect={() => go(`/app/servicos?search=${encodeURIComponent(service.name)}`)}
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-primary" />
                    <span>{service.name}</span>
                    <CommandShortcut>{service.durationMinutes} min</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Próximos agendamentos">
                {filteredAppointments.map((item) => {
                  const day = item.appointment.startsAt.slice(0, 10);
                  return (
                    <CommandItem
                      key={item.appointment.id}
                      value={`${item.clientName ?? ""} ${item.serviceName ?? ""} ${item.professionalName ?? ""}`}
                      onSelect={() => go(`/app/agenda?date=${day}`)}
                    >
                      <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                      <span>
                        {item.clientName ?? "Cliente"} · {item.serviceName ?? "Serviço"}
                      </span>
                      <CommandShortcut>
                        {new Date(item.appointment.startsAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function todayIso() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}
