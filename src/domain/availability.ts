/**
 * Cálculo puro da capacidade disponível da agenda.
 *
 * Intervalos semanais podem se sobrepor (por exemplo, ao importar ou editar
 * horários) e bloqueios também podem se sobrepor. A disponibilidade é a união
 * das janelas abertas, menos a união dos bloqueios aplicáveis — nunca a soma
 * bruta dos registros.
 */

export interface BusinessHoursFact {
  unitId: string;
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface ProfessionalAvailabilityFact {
  professionalId: string;
  unitId: string | null;
  weekday: number;
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityProfessionalFact {
  id: string;
  unitId: string | null;
}

export interface AvailabilityBlockFact {
  scope: "professional" | "unit";
  professionalId: string | null;
  unitId: string | null;
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityCalculationInput {
  start: string;
  end: string;
  unitId?: string | null;
  professionalId?: string | null;
  businessHours: BusinessHoursFact[];
  professionalAvailability: ProfessionalAvailabilityFact[];
  professionals: AvailabilityProfessionalFact[];
  blocks: AvailabilityBlockFact[];
}

interface Interval {
  start: number;
  end: number;
}

/** Calcula minutos-profissional disponíveis no período informado. */
export function calculateAvailableMinutes(input: AvailabilityCalculationInput): number {
  const rangeStart = new Date(input.start).getTime();
  const rangeEnd = new Date(input.end).getTime();
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) return 0;

  const firstDay = new Date(rangeStart);
  firstDay.setHours(0, 0, 0, 0);
  let totalMinutes = 0;

  // Avança por dia civil local para não presumir que todo dia tem 24 horas.
  for (const day = new Date(firstDay); day.getTime() < rangeEnd; day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay();
    const dayStart = new Date(day);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayEnd = nextDay.getTime();
    const periodStart = Math.max(rangeStart, dayStart.getTime());
    const periodEnd = Math.min(rangeEnd, dayEnd);
    if (periodEnd <= periodStart) continue;

    const hoursByUnit = new Map<string, Interval[]>();
    for (const hours of input.businessHours) {
      if (hours.isClosed || hours.weekday !== weekday || (input.unitId && hours.unitId !== input.unitId)) continue;
      const interval = clockInterval(hours.opensAt, hours.closesAt, dayStart, periodStart, periodEnd);
      if (!interval) continue;
      const unitIntervals = hoursByUnit.get(hours.unitId) ?? [];
      unitIntervals.push(interval);
      hoursByUnit.set(hours.unitId, unitIntervals);
    }

    for (const [unitId, rawUnitIntervals] of hoursByUnit) {
      const unitIntervals = mergeIntervals(rawUnitIntervals);
      const unitProfessionals = input.professionals.filter(
        (professional) => !professional.unitId || professional.unitId === unitId,
      );

      for (const professional of unitProfessionals) {
        if (input.professionalId && professional.id !== input.professionalId) continue;

        const windows = input.professionalAvailability
          .filter((availability) =>
            availability.professionalId === professional.id &&
            availability.weekday === weekday &&
            (!availability.unitId || availability.unitId === unitId),
          )
          .map((availability) =>
            clockInterval(availability.startsAt, availability.endsAt, dayStart, periodStart, periodEnd),
          )
          .filter((interval): interval is Interval => interval !== null);

        // Sem janelas cadastradas, preserva o comportamento existente: usa o
        // horário da unidade. Havendo janelas, considera apenas sua interseção.
        const workingIntervals = windows.length === 0
          ? unitIntervals
          : intersectIntervals(unitIntervals, mergeIntervals(windows));
        if (workingIntervals.length === 0) continue;

        const applicableBlocks = input.blocks
          .filter((block) =>
            (block.scope === "professional" && block.professionalId === professional.id) ||
            (block.scope === "unit" && block.unitId === unitId),
          )
          .map((block) => timestampInterval(block.startsAt, block.endsAt, periodStart, periodEnd))
          .filter((interval): interval is Interval => interval !== null);

        const remaining = subtractIntervals(workingIntervals, mergeIntervals(applicableBlocks));
        totalMinutes += remaining.reduce((sum, interval) => sum + (interval.end - interval.start) / 60_000, 0);
      }
    }
  }

  return Math.max(0, totalMinutes);
}

function clockInterval(
  startTime: string,
  endTime: string,
  dayStart: Date,
  periodStart: number,
  periodEnd: number,
): Interval | null {
  const start = localTimeOnDay(startTime, dayStart);
  const end = localTimeOnDay(endTime, dayStart);
  if (start === null || end === null || end <= start) return null;
  const clipped = { start: Math.max(start, periodStart), end: Math.min(end, periodEnd) };
  return clipped.end > clipped.start ? clipped : null;
}

function localTimeOnDay(value: string, dayStart: Date): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  const milliseconds = Number((match[4] ?? "").padEnd(3, "0").slice(0, 3) || 0);
  const isEndOfDay = hours === 24 && minutes === 0 && seconds === 0 && milliseconds === 0;
  if ((!isEndOfDay && hours > 23) || minutes > 59 || seconds > 59) return null;

  const time = new Date(dayStart);
  if (isEndOfDay) {
    time.setDate(time.getDate() + 1);
    return time.getTime();
  }
  time.setHours(hours, minutes, seconds, milliseconds);
  return time.getTime();
}

function timestampInterval(valueStart: string, valueEnd: string, periodStart: number, periodEnd: number): Interval | null {
  const start = new Date(valueStart).getTime();
  const end = new Date(valueEnd).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const clipped = { start: Math.max(start, periodStart), end: Math.min(end, periodEnd) };
  return clipped.end > clipped.start ? clipped : null;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .map((interval) => ({ ...interval }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) {
      merged.push(interval);
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }
  return merged;
}

function intersectIntervals(left: Interval[], right: Interval[]): Interval[] {
  const intersections: Interval[] = [];
  for (const a of left) {
    for (const b of right) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) intersections.push({ start, end });
    }
  }
  return mergeIntervals(intersections);
}

function subtractIntervals(available: Interval[], blocked: Interval[]): Interval[] {
  const remaining: Interval[] = [];
  for (const interval of available) {
    let cursor = interval.start;
    for (const block of blocked) {
      if (block.end <= cursor) continue;
      if (block.start >= interval.end) break;
      if (block.start > cursor) remaining.push({ start: cursor, end: Math.min(block.start, interval.end) });
      cursor = Math.max(cursor, block.end);
      if (cursor >= interval.end) break;
    }
    if (cursor < interval.end) remaining.push({ start: cursor, end: interval.end });
  }
  return remaining;
}
