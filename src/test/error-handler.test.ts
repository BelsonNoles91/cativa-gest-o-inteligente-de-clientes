import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: { error: toastError },
}));

import { handleError } from "@/lib/error-handler";

describe("handleError", () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it("uses a safe category message for structured errors without a message", () => {
    const error = handleError({ code: "ECONNREFUSED" }, { category: "DATABASE" });

    expect(error.message).toBe("Falha ao processar dados. Tente novamente em instantes.");
    expect(toastError).toHaveBeenCalledWith("Falha ao processar dados. Tente novamente em instantes.");
    expect(toastError.mock.calls[0]?.[0]).not.toContain("[object Object]");
    expect(toastError.mock.calls[0]).toHaveLength(1);
  });

  it("preserves a meaningful message from a structured error", () => {
    handleError({ message: "Serviço temporariamente indisponível" }, { category: "NETWORK" });

    expect(toastError).toHaveBeenCalledWith("Serviço temporariamente indisponível");
  });

  it("does not show a toast when the caller renders its own error state", () => {
    handleError({ code: "PGRST000" }, { category: "DATABASE", silent: true });

    expect(toastError).not.toHaveBeenCalled();
  });
});
