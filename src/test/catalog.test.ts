import { describe, expect, it } from "vitest";
import {
  billingCycleLabels,
  formatDuration,
  formatPrice,
  packageKindLabels,
  totalBlockedMinutes,
} from "@/domain/catalog";

describe("domain/catalog", () => {
  it("soma corretamente o tempo total bloqueado na agenda", () => {
    expect(
      totalBlockedMinutes({
        durationMinutes: 60,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 5,
        processingMinutes: 20,
      }),
    ).toBe(95);
  });

  it("formata duracao em minutos e horas", () => {
    expect(formatDuration(45)).toBe("45min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(95)).toBe("1h 35min");
  });

  it("formata preco em BRL", () => {
    expect(formatPrice(12345)).toBe("R$ 123,45");
  });

  it("mantem labels publicas dos tipos do catalogo", () => {
    expect(packageKindLabels.package).toBe("Pacote");
    expect(packageKindLabels.combo).toBe("Combo");
    expect(billingCycleLabels.monthly).toBe("Mensal");
    expect(billingCycleLabels.yearly).toBe("Anual");
  });
});
