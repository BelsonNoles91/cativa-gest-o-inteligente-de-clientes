export interface JevRequest {
  state: unknown;
  questions: Record<string, unknown>;
  model?: string;
}

export interface JevResponse {
  model: string;
  answers: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
}

export class JevHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "JevHttpError";
    this.status = status;
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

const BACKOFF_INITIAL_MS = 250;
const BACKOFF_MAX_MS = 5_000;
const MAX_RETRY_AFTER_MS = 60_000;

/**
 * Cliente HTTP mínimo para o Jev. Mantém a credencial no servidor, aplica timeout
 * por tentativa e repete falhas de conexão/timeout e status transitórios previstos
 * pela política oficial do SDK TypeSafe.
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
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts deve ser um inteiro maior que zero");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new Error("timeoutMs deve ser maior que zero");
  }
  if (
    (typeof request.state !== "string" && (typeof request.state !== "object" || request.state === null)) ||
    !request.questions ||
    typeof request.questions !== "object" ||
    Array.isArray(request.questions) ||
    Object.keys(request.questions).length === 0
  ) {
    throw new Error("state e ao menos uma pergunta Jev válida são obrigatórios");
  }
  const model = request.model ?? "jev-latest";
  if (!model.trim()) throw new Error("model Jev inválido");
  const body = JSON.stringify({
    state: request.state,
    questions: request.questions,
    model,
  });

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
        body,
      });
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
      const isConnectionFailure = error instanceof TypeError;
      if ((isTimeout || isConnectionFailure) && attempt + 1 < maxAttempts) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      if (isTimeout) throw new JevHttpError(504, "Tempo limite excedido ao consultar o Jev");
      throw error;
    }

    if (response.ok) {
      let payload: Partial<JevResponse>;
      try {
        payload = (await response.json()) as Partial<JevResponse>;
      } catch (error) {
        if (error instanceof TypeError && attempt + 1 < maxAttempts) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        throw new JevHttpError(502, "Resposta inválida do Jev");
      }
      if (
        typeof payload.model !== "string" ||
        payload.model.trim() === "" ||
        !payload.answers ||
        typeof payload.answers !== "object" ||
        Array.isArray(payload.answers) ||
        !isUsage(payload.usage)
      ) {
        throw new JevHttpError(502, "Resposta inválida do Jev");
      }
      const answers = payload.answers as Record<string, unknown>;
      const missingAnswers = Object.keys(request.questions).filter(
        (questionId) => !Object.prototype.hasOwnProperty.call(answers, questionId),
      );
      if (missingAnswers.length > 0) {
        throw new JevHttpError(502, "Resposta incompleta do Jev");
      }
      return payload as JevResponse;
    }

    const isRetryableStatus =
      response.status === 408 ||
      response.status === 429 ||
      (response.status >= 500 && response.status <= 599);
    const shouldRetry = isRetryableStatus && attempt + 1 < maxAttempts;
    if (!shouldRetry) {
      throw new JevHttpError(response.status, `TypeSafe HTTP ${response.status}`);
    }

    const retryAfter = parseRetryAfterMs(response.headers.get("retry-after-ms"))
      ?? parseRetryAfter(response.headers.get("retry-after"));
    const validRetryAfter = retryAfter !== null && retryAfter <= MAX_RETRY_AFTER_MS;
    await sleep(validRetryAfter ? retryAfter : backoffDelay(attempt));
  }

  throw new JevHttpError(502, "Jev temporariamente indisponível");
}

function isUsage(value: unknown): value is JevResponse["usage"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const usage = value as Record<string, unknown>;
  return [usage.input_tokens, usage.output_tokens].every(
    (tokens) => Number.isSafeInteger(tokens) && typeof tokens === "number" && tokens >= 0,
  );
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return Math.max(0, timestamp - Date.now());
  return null;
}

function parseRetryAfterMs(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds : null;
}

function backoffDelay(attempt: number): number {
  return Math.min(BACKOFF_INITIAL_MS * 2 ** attempt, BACKOFF_MAX_MS);
}
