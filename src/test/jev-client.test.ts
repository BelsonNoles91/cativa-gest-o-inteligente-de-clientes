import { describe, expect, it, vi } from "vitest";
import { callJev, JevHttpError } from "../../supabase/functions/_shared/jev";

const request = {
  state: { signal: "test" },
  questions: { action: { type: "choice", instructions: "Choose", criteria: { yes: null, no: null } } },
};

describe("Jev HTTP client", () => {
  it("sends the server credential and parses a valid response", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
      expect(String(init?.body)).not.toContain("Bearer secret");
      return new Response(JSON.stringify({ model: "jev-1.13.0", answers: { action: {} } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch });
    expect(result.model).toBe("jev-1.13.0");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("retries 429 with retry-after and then succeeds", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "retry-after": "0.01" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ model: "jev-1.13.0", answers: {} }), { status: 200 }),
      );

    await callJev({ apiKey: "secret", request, fetchImpl, sleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("does not retry authentication errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toEqual(
      expect.objectContaining({ status: 401 }),
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects malformed successful responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ model: "jev-1.13.0" }), { status: 200 }));
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toThrow(
      "Resposta inválida",
    );
  });

  it("maps request timeouts without retrying blindly", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toEqual(
      expect.objectContaining({ status: 504 }),
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
