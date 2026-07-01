/**
 * AnalyticsFilters — barra de filtros sticky para todos os dashboards.
 */
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { presetLabels, type AnalyticsPreset } from "@/domain/analytics";
import type { AppointmentSource } from "@/domain/scheduling";
import { Filter } from "lucide-react";

interface Props {
  preset: AnalyticsPreset;
  onPreset: (p: AnalyticsPreset) => void;
  units: Map<string, string> | null;
  pros: Map<string, string> | null;
  services: Map<string, string> | null;
  unitId: string | null;
  professionalId: string | null;
  serviceId: string | null;
  source: AppointmentSource | null;
  onUnit: (v: string | null) => void;
  onPro: (v: string | null) => void;
  onService: (v: string | null) => void;
  onSource: (v: AppointmentSource | null) => void;
}

const SOURCES: AppointmentSource[] = [
  "frontdesk",
  "professional",
  "client_portal",
  "walk_in",
  "phone",
  "whatsapp",
  "recurring",
  "system",
];

const SOURCE_LABELS: Record<AppointmentSource, string> = {
  frontdesk: "Recepção",
  professional: "Profissional",
  client_portal: "Portal do cliente",
  walk_in: "Walk-in",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  recurring: "Recorrente",
  system: "Sistema",
};

export function AnalyticsFiltersBar({
  preset,
  onPreset,
  units,
  pros,
  services,
  unitId,
  professionalId,
  serviceId,
  source,
  onUnit,
  onPro,
  onService,
  onSource,
}: Props) {
  return (
    <div className="surface-card sticky top-0 z-20 mb-4 flex flex-col gap-2 p-3 sm:flex-row sm:flex-wrap sm:items-center md:rounded-xl md:p-4">
      <Filter className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      <Select value={preset} onValueChange={(v) => onPreset(v as AnalyticsPreset)}>
        <SelectTrigger className="w-full min-w-0 sm:w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(presetLabels) as AnalyticsPreset[]).map((p) => (
            <SelectItem key={p} value={p}>
              {presetLabels[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={unitId ?? "all"} onValueChange={(v) => onUnit(v === "all" ? null : v)}>
        <SelectTrigger className="w-full min-w-0 sm:w-[160px]">
          <SelectValue placeholder="Unidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as unidades</SelectItem>
          {Array.from(units?.entries() ?? []).map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={professionalId ?? "all"} onValueChange={(v) => onPro(v === "all" ? null : v)}>
        <SelectTrigger className="w-full min-w-0 sm:w-[180px]">
          <SelectValue placeholder="Profissional" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos profissionais</SelectItem>
          {Array.from(pros?.entries() ?? []).map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={serviceId ?? "all"} onValueChange={(v) => onService(v === "all" ? null : v)}>
        <SelectTrigger className="w-full min-w-0 sm:w-[180px]">
          <SelectValue placeholder="Serviço" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os serviços</SelectItem>
          {Array.from(services?.entries() ?? []).map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={source ?? "all"} onValueChange={(v) => onSource(v === "all" ? null : (v as AppointmentSource))}>
        <SelectTrigger className="w-full min-w-0 sm:w-[170px]">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas origens</SelectItem>
          {SOURCES.map((s) => (
            <SelectItem key={s} value={s}>
              {SOURCE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(unitId || professionalId || serviceId || source) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onUnit(null);
            onPro(null);
            onService(null);
            onSource(null);
          }}
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
