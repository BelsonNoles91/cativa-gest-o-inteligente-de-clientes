export interface JevRequest {
  state: unknown;
  questions: Record<string, unknown>;
  model?: string;
}

export interface JevResponse {
  model: string;
  answers: Record<string, unknown>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class JevHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "JevHttpError";
  }
}

interface CallJevOptions {
  apiKey: string;
  request: JevRequest;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
}

const RETRYABLE_STATUSES = new Set([429, 529]);

/**
 * Cliente HTTP mínimo para o Jev. Mantém a credencial no servidor, aplica timeout
 * por tentativa e repete apenas os status recomendados pela documentação oficial.
 */
export async function callJev({
  apiKey,
  request,
  fetchImpl = fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = 12_000,
  maxAttempts = 3,
}: CallJevOptions): Promise<JevResponse> {
  if (!apiKey.trim()) throw new Error("TYPESAFE_API_KEY ausente");
  if (maxAttempts < 1) throw new Error("maxAttempts deve ser maior que zero");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          state: request.state,
          questions: request.questions,
          model: request.model ?? "jev-latest",
        }),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new JevHttpError(504, "Tempo limite excedido ao consultar o Jev");
      }
      throw error;
    }

    if (response.ok) {
      const payload = (await response.json()) as Partial<JevResponse>;
      if (
        typeof payload.model !== "string" ||
        !payload.answers ||
        typeof payload.answers !== "object" ||
        Array.isArray(payload.answers)
      ) {
        throw new JevHttpError(502, "Resposta inválida do Jev");
      }
      return payload as JevResponse;
    }

    const shouldRetry = RETRYABLE_STATUSES.has(response.status) && attempt + 1 < maxAttempts;
    if (!shouldRetry) {
      throw new JevHttpError(response.status, `TypeSafe HTTP ${response.status}`);
    }

    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    const exponentialBackoff = 250 * 2 ** attempt;
    await sleep(Math.min(retryAfter ?? exponentialBackoff, 2_000));
  }

  throw new JevHttpError(502, "Jev temporariamente indisponível");
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return Math.max(0, timestamp - Date.now());
  return null;
}
