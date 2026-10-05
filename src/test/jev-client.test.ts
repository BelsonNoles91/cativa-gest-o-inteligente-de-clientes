import { describe, expect, it, vi } from "vitest";
import { callJev, JevHttpError } from "../../supabase/functions/_shared/jev";

const request = {
  state: { signal: "test" },
  questions: { action: { type: "choice", instructions: "Choose", criteria: { yes: null, no: null } } },
};

function validProviderResponse(model = "jev-latest") {
  return new Response(JSON.stringify({
    model,
    answers: {
      action: {
        type: "choice",
        choice: "yes",
        confidence: 0.9,
        probabilities: { yes: 0.9, no: 0.1 },
      },
    },
    usage: { input_tokens: 12, output_tokens: 4 },
  }), { status: 200 });
}

describe("Jev HTTP client", () => {
  it("sends the server credential and parses a valid response", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret");
      expect(String(init?.body)).not.toContain("Bearer secret");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.model).toBe("jev-latest");
      expect(body.state).toEqual(request.state);
      expect(body.questions).toEqual(request.questions);
      return new Response(JSON.stringify({
        model: "jev-1.13.0",
        answers: { action: { type: "choice", choice: "yes", confidence: 1, probabilities: { yes: 1, no: 0 } } },
        usage: { input_tokens: 30, output_tokens: 5 },
      }), {
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
      .mockResolvedValueOnce(validProviderResponse("jev-1.13.0"));

    await callJev({ apiKey: "secret", request, fetchImpl, sleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("uses the bounded default backoff when no sleep adapter is provided", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(validProviderResponse());

    try {
      const result = callJev({ apiKey: "secret", request, fetchImpl });
      await vi.advanceTimersByTimeAsync(250);
      await expect(result).resolves.toMatchObject({ model: "jev-latest" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("honors TypeSafe's retry-after-ms header ahead of Retry-After", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("busy", { status: 429, headers: { "retry-after-ms": "1250", "retry-after": "2" } }),
      )
      .mockResolvedValueOnce(validProviderResponse());

    await callJev({ apiKey: "secret", request, fetchImpl, sleep });
    expect(sleep).toHaveBeenCalledWith(1_250);
  });

  it("honors an HTTP-date Retry-After value", async () => {
    const now = new Date("2026-09-30T20:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("busy", {
          status: 429,
          headers: { "retry-after": new Date(now.getTime() + 30_000).toUTCString() },
        }),
      )
      .mockResolvedValueOnce(validProviderResponse());

    try {
      await callJev({ apiKey: "secret", request, fetchImpl, sleep });
      expect(sleep).toHaveBeenCalledWith(30_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to bounded exponential backoff for invalid or excessive retry hints", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "retry-after-ms": "invalid" } }))
      .mockResolvedValueOnce(
        new Response("busy", { status: 429, headers: { "retry-after": "120" } }),
      )
      .mockResolvedValueOnce(validProviderResponse());

    await callJev({ apiKey: "secret", request, fetchImpl, sleep });
    expect(sleep.mock.calls).toEqual([[250], [500]]);
  });

  it("falls back when Retry-After is neither seconds nor a valid date", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "retry-after": "not-a-date" } }))
      .mockResolvedValueOnce(validProviderResponse());

    await callJev({ apiKey: "secret", request, fetchImpl, sleep });
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("does not retry authentication errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toEqual(
      expect.objectContaining({ status: 401 }),
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([400, 401, 403, 409, 422])("does not retry non-retryable HTTP %s", async (status) => {
    const fetchImpl = vi.fn(async () => new Response("failure", { status }));
    const sleep = vi.fn(async () => undefined);

    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch, sleep })).rejects.toEqual(
      expect.objectContaining({ status }),
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([408, 500, 503])("retries transient HTTP %s before succeeding", async (status) => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary failure", { status }))
      .mockResolvedValueOnce(validProviderResponse());

    await callJev({ apiKey: "secret", request, fetchImpl, sleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("retries a 529 overload with exponential backoff", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("overloaded", { status: 529 }))
      .mockResolvedValueOnce(validProviderResponse());

    await callJev({ apiKey: "secret", request, fetchImpl, sleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("honors the attempt limit and returns the provider status", async () => {
    const fetchImpl = vi.fn(async () => new Response("busy", { status: 429 }));
    const sleep = vi.fn(async () => undefined);

    await expect(
      callJev({ apiKey: "secret", request, maxAttempts: 2, fetchImpl: fetchImpl as typeof fetch, sleep }),
    ).rejects.toEqual(expect.objectContaining({ status: 429 }));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("retries a transient network failure and then returns the provider result", async () => {
    const networkError = new TypeError("network offline");
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(validProviderResponse());

    await expect(callJev({ apiKey: "secret", request, fetchImpl, sleep })).resolves.toMatchObject({
      model: "jev-latest",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("does not retry unexpected fetch errors", async () => {
    const unexpected = new Error("unexpected adapter failure");
    const fetchImpl = vi.fn(async () => { throw unexpected; });
    const sleep = vi.fn(async () => undefined);

    await expect(callJev({ apiKey: "secret", request, fetchImpl, sleep })).rejects.toBe(unexpected);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([
    ["", 3, 12_000, "TYPESAFE_API_KEY ausente"],
    ["  ", 3, 12_000, "TYPESAFE_API_KEY ausente"],
    ["secret", 0, 12_000, "maxAttempts deve ser um inteiro maior que zero"],
    ["secret", 1.5, 12_000, "maxAttempts deve ser um inteiro maior que zero"],
    ["secret", 3, 0, "timeoutMs deve ser maior que zero"],
  ])("validates client configuration (%s / %s / %s)", async (apiKey, maxAttempts, timeoutMs, message) => {
    const fetchImpl = vi.fn();
    await expect(
      callJev({ apiKey, request, maxAttempts, timeoutMs, fetchImpl: fetchImpl as typeof fetch }),
    ).rejects.toThrow(message);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a non-serializable payload without treating it as a network retry", async () => {
    const state: Record<string, unknown> = {};
    state.self = state;
    const fetchImpl = vi.fn();

    await expect(
      callJev({ apiKey: "secret", request: { ...request, state }, fetchImpl: fetchImpl as typeof fetch }),
    ).rejects.toThrow("circular");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects malformed successful responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      model: "jev-1.13.0",
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200 }));
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toThrow(
      "Resposta inválida",
    );
  });

  it("rejects a successful provider response that omits a requested answer", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      model: "jev-1.13.0",
      answers: {},
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200 }));
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toEqual(
      expect.objectContaining({ status: 502, message: "Resposta incompleta do Jev" }),
    );
  });

  it("rejects invalid request state, questions, and model before making a network call", async () => {
    const fetchImpl = vi.fn();
    const invalidRequests = [
      { state: undefined, questions: request.questions },
      { state: request.state, questions: {} },
      { state: request.state, questions: request.questions, model: "   " },
    ];

    await expect(callJev({ apiKey: "secret", request: invalidRequests[0], fetchImpl: fetchImpl as typeof fetch }))
      .rejects.toThrow("state e ao menos uma pergunta");
    await expect(callJev({ apiKey: "secret", request: invalidRequests[1], fetchImpl: fetchImpl as typeof fetch }))
      .rejects.toThrow("state e ao menos uma pergunta");
    await expect(callJev({ apiKey: "secret", request: invalidRequests[2], fetchImpl: fetchImpl as typeof fetch }))
      .rejects.toThrow("model Jev inválido");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [null, request.questions],
    [42, request.questions],
    [request.state, []],
    [request.state, null],
  ])("rejects unsupported state/question shapes before network I/O", async (state, questions) => {
    const fetchImpl = vi.fn();
    await expect(
      callJev({
        apiKey: "secret",
        request: { state, questions } as never,
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow("state e ao menos uma pergunta");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps malformed JSON from a successful provider response to 502", async () => {
    const fetchImpl = vi.fn(async () => new Response("not-json", { status: 200 }));
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toEqual(
      expect.objectContaining({ status: 502 }),
    );
  });

  it("retries an interrupted successful response body", async () => {
    const interruptedResponse = new Response("{}", { status: 200 });
    vi.spyOn(interruptedResponse, "json").mockRejectedValueOnce(new TypeError("response stream interrupted"));
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(interruptedResponse)
      .mockResolvedValueOnce(validProviderResponse());

    await expect(callJev({ apiKey: "secret", request, fetchImpl, sleep })).resolves.toMatchObject({
      model: "jev-latest",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("rejects an empty model identifier", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      model: "  ",
      answers: {},
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200 }));
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toEqual(
      expect.objectContaining({ status: 502 }),
    );
  });

  it.each([
    [null, { action: {} }, { input_tokens: 1, output_tokens: 1 }],
    ["jev-latest", [], { input_tokens: 1, output_tokens: 1 }],
    ["jev-latest", null, { input_tokens: 1, output_tokens: 1 }],
    ["jev-latest", { action: {} }, undefined],
    ["jev-latest", { action: {} }, { input_tokens: -1, output_tokens: 1 }],
    ["jev-latest", { action: {} }, { input_tokens: 1.2, output_tokens: 1 }],
    ["jev-latest", { action: {} }, { input_tokens: 1, output_tokens: "1" }],
  ])("rejects successful provider payloads with invalid model/answer/usage shape", async (model, answers, usage) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ model, answers, usage }), { status: 200 }));
    await expect(callJev({ apiKey: "secret", request, fetchImpl: fetchImpl as typeof fetch })).rejects.toEqual(
      expect.objectContaining({ status: 502, message: "Resposta inválida do Jev" }),
    );
  });

  it("retries a transient timeout before succeeding", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce(validProviderResponse());

    await expect(callJev({ apiKey: "secret", request, fetchImpl, sleep })).resolves.toMatchObject({
      model: "jev-latest",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("maps a timeout after the retry budget to 504", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });

    await expect(callJev({ apiKey: "secret", request, maxAttempts: 2, fetchImpl, sleep })).rejects.toEqual(
      expect.objectContaining({ status: 504 }),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });
});
