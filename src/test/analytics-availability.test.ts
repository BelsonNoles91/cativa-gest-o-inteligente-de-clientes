import { describe, expect, it } from "vitest";
import { calculateAvailableMinutes, type AvailabilityCalculationInput } from "@/domain/availability";

const monday = new Date(2026, 0, 5, 0, 0, 0, 0);
const localAt = (hour: number, minute = 0) => {
  const date = new Date(monday);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const minuteAt = (minute: number) => new Date(monday.getTime() + minute * 60_000).toISOString();
const clockAt = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const base: AvailabilityCalculationInput = {
  start: localAt(0),
  end: localAt(23, 59),
  businessHours: [{ unitId: "unit-a", weekday: 1, opensAt: "09:00:00", closesAt: "17:00:00", isClosed: false }],
  professionalAvailability: [],
  professionals: [{ id: "pro-a", unitId: "unit-a" }],
  blocks: [],
};

describe("analytics availability interval accounting", () => {
  it("unifica janelas profissionais sobrepostas antes de somar capacidade", () => {
    expect(calculateAvailableMinutes({
      ...base,
      businessHours: [
        ...base.businessHours,
        { unitId: "unit-a", weekday: 1, opensAt: "09:00:00", closesAt: "13:00:00", isClosed: false },
      ],
      professionalAvailability: [
        { professionalId: "pro-a", unitId: "unit-a", weekday: 1, startsAt: "09:00:00", endsAt: "13:00:00" },
        { professionalId: "pro-a", unitId: "unit-a", weekday: 1, startsAt: "11:00:00", endsAt: "17:00:00" },
      ],
    })).toBe(480);
  });

  it("unifica bloqueios profissionais sobrepostos e os recorta ao expediente", () => {
    expect(calculateAvailableMinutes({
      ...base,
      blocks: [
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(12), endsAt: localAt(14) },
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(13), endsAt: localAt(15) },
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(6), endsAt: localAt(10) },
      ],
    })).toBe(240);
  });

  it("recorta expediente às fronteiras exatas do período [início, fim)", () => {
    expect(calculateAvailableMinutes({
      ...base,
      start: localAt(10, 30),
      end: localAt(15, 15),
    })).toBe(285);
  });

  it("mantém frações de segundo e ignora horário semanal fora do período recortado", () => {
    expect(calculateAvailableMinutes({
      ...base,
      start: localAt(9),
      end: localAt(10, 1),
      businessHours: [{ unitId: "unit-a", weekday: 1, opensAt: "09:00:00.500", closesAt: "10:00:00.500", isClosed: false }],
    })).toBe(60);
    expect(calculateAvailableMinutes({
      ...base,
      start: localAt(10),
      end: localAt(11),
      businessHours: [{ unitId: "unit-a", weekday: 1, opensAt: "09:00", closesAt: "10:00", isClosed: false }],
    })).toBe(0);
  });

  it("descarta bloqueios inteiramente fora do período com intervalo semiaberto", () => {
    expect(calculateAvailableMinutes({
      ...base,
      start: localAt(10),
      end: localAt(11),
      blocks: [
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(11), endsAt: localAt(12) },
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(12), endsAt: localAt(13) },
      ],
    })).toBe(60);
  });

  it("aceita fechamento à meia-noite sem incluir o dia seguinte fora do período", () => {
    const nextDay = new Date(monday);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(1, 0, 0, 0);
    expect(calculateAvailableMinutes({
      ...base,
      start: localAt(23),
      end: nextDay.toISOString(),
      businessHours: [{ unitId: "unit-a", weekday: 1, opensAt: "23:00", closesAt: "24:00", isClosed: false }],
    })).toBe(60);
  });

  it("avança por dias civis locais em mudanças de horário de verão", () => {
    for (const [year, month, day] of [[2026, 2, 8], [2026, 10, 1]]) {
      const start = new Date(year, month, day, 0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const expectedMinutes = (end.getTime() - start.getTime()) / 60_000;
      expect(calculateAvailableMinutes({
        ...base,
        start: start.toISOString(),
        end: end.toISOString(),
        businessHours: [{ unitId: "unit-a", weekday: 0, opensAt: "00:00", closesAt: "24:00", isClosed: false }],
      })).toBe(expectedMinutes);
    }
  });

  it("contabiliza unidade/profissional apenas no escopo selecionado", () => {
    expect(calculateAvailableMinutes({
      ...base,
      professionals: [
        { id: "pro-a", unitId: "unit-a" },
        { id: "pro-b", unitId: "unit-a" },
        { id: "pro-c", unitId: "unit-b" },
      ],
      businessHours: [
        ...base.businessHours,
        { unitId: "unit-b", weekday: 1, opensAt: "09:00", closesAt: "17:00", isClosed: false },
      ],
    })).toBe(1440);
    expect(calculateAvailableMinutes({ ...base, professionalId: "pro-missing" })).toBe(0);
    expect(calculateAvailableMinutes({ ...base, unitId: "unit-missing" })).toBe(0);
  });

  it("limita bloqueio da unidade à própria unidade e ignora expediente fechado ou inválido", () => {
    expect(calculateAvailableMinutes({
      ...base,
      businessHours: [
        ...base.businessHours,
        { unitId: "unit-a", weekday: 1, opensAt: "08:00", closesAt: "10:00", isClosed: true },
        { unitId: "unit-b", weekday: 1, opensAt: "09:00", closesAt: "17:00", isClosed: false },
      ],
      blocks: [
        { scope: "unit", professionalId: null, unitId: "unit-b", startsAt: localAt(9), endsAt: localAt(17) },
      ],
    })).toBe(480);
    expect(calculateAvailableMinutes({ ...base, start: localAt(12), end: localAt(12) })).toBe(0);
  });

  it("retorna zero para período inválido, horários malformados ou janelas fora do expediente", () => {
    expect(calculateAvailableMinutes({ ...base, start: "invalid-date" })).toBe(0);
    expect(calculateAvailableMinutes({ ...base, end: "invalid-date" })).toBe(0);
    expect(calculateAvailableMinutes({ ...base, start: localAt(12), end: localAt(9) })).toBe(0);
    expect(calculateAvailableMinutes({
      ...base,
      businessHours: [
        { unitId: "unit-a", weekday: 1, opensAt: "invalid", closesAt: "17:00", isClosed: false },
        { unitId: "unit-a", weekday: 1, opensAt: "25:00", closesAt: "26:00", isClosed: false },
        { unitId: "unit-a", weekday: 1, opensAt: "09:60", closesAt: "10:00", isClosed: false },
        { unitId: "unit-a", weekday: 1, opensAt: "09:00", closesAt: "09:00", isClosed: false },
      ],
    })).toBe(0);
    expect(calculateAvailableMinutes({
      ...base,
      professionalAvailability: [
        { professionalId: "pro-a", unitId: "unit-a", weekday: 1, startsAt: "18:00", endsAt: "19:00" },
      ],
    })).toBe(0);
  });

  it("ignora bloqueios inválidos, invertidos ou sem interseção com a jornada", () => {
    expect(calculateAvailableMinutes({
      ...base,
      blocks: [
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: "invalid", endsAt: localAt(10) },
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(12), endsAt: "invalid" },
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(12), endsAt: localAt(11) },
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(6), endsAt: localAt(8) },
        { scope: "professional", professionalId: "pro-a", unitId: null, startsAt: localAt(18), endsAt: localAt(20) },
      ],
    })).toBe(480);
  });

  it("reconcilia 64 agendas geradas com um oráculo independente minuto a minuto", () => {
    let state = 0x5eed;
    const next = (limit: number) => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state % limit;
    };
    const interval = () => {
      const start = next(1_440);
      return { start, end: start + 1 + next(1_440 - start) };
    };
    const toClock = (value: number) => value === 1_440 ? "24:00" : clockAt(value);
    const toMinute = (value: string) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour * 60 + minute;
    };
    const dayStart = monday.getTime();

    for (let seed = 0; seed < 64; seed += 1) {
      const businessHours = Array.from({ length: 1 + next(3) }, () => {
        const span = interval();
        return {
          unitId: next(5) === 0 ? "unit-b" : "unit-a",
          weekday: 1,
          opensAt: toClock(span.start),
          closesAt: toClock(span.end),
          isClosed: next(8) === 0,
        };
      });
      const professionalAvailability = Array.from({ length: next(4) }, () => {
        const span = interval();
        return {
          professionalId: next(5) === 0 ? "pro-b" : "pro-a",
          unitId: next(3) === 0 ? "unit-b" : next(3) === 0 ? "unit-a" : null,
          weekday: 1,
          startsAt: toClock(span.start),
          endsAt: toClock(span.end),
        };
      });
      const blocks = Array.from({ length: next(5) }, () => {
        const span = interval();
        const scope = next(2) === 0 ? "professional" as const : "unit" as const;
        return {
          scope,
          professionalId: scope === "professional" && next(5) !== 0 ? "pro-a" : "pro-b",
          unitId: scope === "unit" && next(5) !== 0 ? "unit-a" : "unit-b",
          startsAt: minuteAt(span.start),
          endsAt: minuteAt(span.end),
        };
      });

      const applicableHours = businessHours.filter((hours) => hours.unitId === "unit-a" && !hours.isClosed);
      const applicableWindows = professionalAvailability.filter((window) =>
        window.professionalId === "pro-a" && (window.unitId === null || window.unitId === "unit-a"),
      );
      const expected = Array.from({ length: 1_440 }, (_, minute) => {
        const unitOpen = applicableHours.some((hours) =>
          minute >= toMinute(hours.opensAt) && minute < toMinute(hours.closesAt),
        );
        const professionalOpen = applicableWindows.length === 0 || applicableWindows.some((window) =>
          minute >= toMinute(window.startsAt) && minute < toMinute(window.endsAt),
        );
        const blocked = blocks.some((block) => {
          const applies =
            (block.scope === "professional" && block.professionalId === "pro-a") ||
            (block.scope === "unit" && block.unitId === "unit-a");
          if (!applies) return false;
          const start = (new Date(block.startsAt).getTime() - dayStart) / 60_000;
          const end = (new Date(block.endsAt).getTime() - dayStart) / 60_000;
          return minute >= start && minute < end;
        });
        return unitOpen && professionalOpen && !blocked ? 1 : 0;
      }).reduce((sum, value) => sum + value, 0);

      expect(calculateAvailableMinutes({
        ...base,
        start: localAt(0),
        end: minuteAt(1_440),
        businessHours,
        professionalAvailability,
        blocks,
      })).toBe(expected);
    }
  });
});
