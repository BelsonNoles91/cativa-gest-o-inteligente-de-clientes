const defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryable(error) {
  const context = error?.context;
  if (context && typeof context.status === "number") {
    return context.status === 408 || context.status === 429 || context.status >= 500;
  }

  // FunctionsFetchError carries the underlying network error in `context`.
  // The provisioner is idempotent, so retrying a request with no response is safe.
  return context instanceof TypeError || (
    context instanceof Error && /fetch|network|connect|timeout/i.test(`${context.name} ${context.message}`)
  );
}

/**
 * Retries a fixture-provisioning invocation only for transient transport/HTTP errors.
 * Returns the final Supabase result unchanged so persistent failures still fail the job.
 */
export async function invokeWithRetry(invoke, {
  maxAttempts = 5,
  baseDelayMs = 500,
  sleep = defaultSleep,
  onRetry = () => {},
} = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts precisa ser um inteiro positivo");
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new RangeError("baseDelayMs precisa ser um número finito não negativo");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await invoke();
    if (!result?.error || attempt === maxAttempts || !retryable(result.error)) return result;

    const delayMs = baseDelayMs * (2 ** (attempt - 1));
    onRetry({
      attempt,
      nextAttempt: attempt + 1,
      maxAttempts,
      delayMs,
      status: typeof result.error.context?.status === "number" ? result.error.context.status : null,
    });
    await sleep(delayMs);
  }
}
