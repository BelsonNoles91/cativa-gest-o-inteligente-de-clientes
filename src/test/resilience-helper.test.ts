import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrowserContext } from "@playwright/test";
import { ensureOnline, waitFor, withRetry } from "../../e2e/_helpers/resilience";

describe("E2E resilience helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries an idempotent operation and returns its first successful result", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce("ready");

    await expect(
      withRetry("load fixture", operation, { retries: 3, baseDelayMs: 0 }),
    ).resolves.toBe("ready");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("reports the operation label and attempt count when retries are exhausted", async () => {
    const operation = vi.fn(async () => {
      throw new Error("service unavailable");
    });

    await expect(
      withRetry("save appointment", operation, { retries: 2, baseDelayMs: 0 }),
    ).rejects.toThrow("[save appointment] falhou após 2 tentativas: service unavailable");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("polls until the predicate becomes truthy and returns that value", async () => {
    let checks = 0;
    const result = await waitFor(
      "fixture appears",
      async () => {
        checks += 1;
        return checks === 3 ? { id: "fixture-1" } : null;
      },
      { timeoutMs: 100, pollMs: 1 },
    );

    expect(result).toEqual({ id: "fixture-1" });
    expect(checks).toBe(3);
  });

  it("includes the wait label and last predicate error after timeout", async () => {
    await expect(
      waitFor(
        "appointment confirmation",
        async () => {
          throw new Error("request rejected");
        },
        { timeoutMs: 10, pollMs: 1 },
      ),
    ).rejects.toThrow(/\[appointment confirmation\] timeout de 10ms.*request rejected/);
  });

  it("restores online state when a scenario closes without cleanup", async () => {
    const setOffline = vi.fn().mockResolvedValue(undefined);
    await ensureOnline({ setOffline } as unknown as BrowserContext);
    expect(setOffline).toHaveBeenCalledOnce();
    expect(setOffline).toHaveBeenCalledWith(false);
  });

  it("does not hide cleanup errors from logs when a context is already closed", async () => {
    const setOffline = vi.fn().mockRejectedValue(new Error("context closed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(ensureOnline({ setOffline } as unknown as BrowserContext)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ensureOnline falhou"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("context closed"));
  });
});
