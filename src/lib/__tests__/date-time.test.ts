import { describe, expect, it } from "vitest";
import { calendarDateKey, dateKeyInTimeZone, formatInTimeZone } from "@/lib/date-time";

describe("date-time helpers", () => {
  it("preserva o dia escolhido no calendário sem converter para UTC", () => {
    const selected = new Date(2026, 0, 31, 12, 0, 0);
    expect(calendarDateKey(selected)).toBe("2026-01-31");
  });

  it("calcula o dia do estabelecimento na virada de UTC", () => {
    const instant = "2026-02-01T02:30:00.000Z";
    expect(dateKeyInTimeZone(instant, "America/Belem")).toBe("2026-01-31");
    expect(dateKeyInTimeZone(instant, "UTC")).toBe("2026-02-01");
  });

  it("formata o horário no fuso do estabelecimento", () => {
    const instant = "2026-09-25T01:30:00.000Z";
    expect(
      formatInTimeZone(instant, "America/Belem", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    ).toBe("22:30");
  });
});
