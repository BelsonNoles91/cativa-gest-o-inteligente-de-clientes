import assert from "node:assert/strict";
import test from "node:test";
import { invokeWithRetry } from "./e2e-provision-retry.mjs";

function httpError(status) {
  return { context: new Response(null, { status }) };
}

test("retries a transient server response and returns the successful result", async () => {
  let calls = 0;
  const delays = [];
  const retryEvents = [];
  const result = await invokeWithRetry(
    async () => {
      calls += 1;
      return calls === 1 ? { data: null, error: httpError(500) } : { data: { ok: true }, error: null };
    },
    { sleep: async (milliseconds) => delays.push(milliseconds), onRetry: (event) => retryEvents.push(event) },
  );

  assert.deepEqual(result, { data: { ok: true }, error: null });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [500]);
  assert.deepEqual(retryEvents, [{ attempt: 1, nextAttempt: 2, maxAttempts: 5, delayMs: 500, status: 500 }]);
});

test("recovers after repeated Supabase Auth 500s with bounded exponential backoff", async () => {
  let calls = 0;
  const delays = [];
  const result = await invokeWithRetry(
    async () => {
      calls += 1;
      return calls < 5
        ? { data: null, error: httpError(500) }
        : { data: { accounts: ["synthetic"] }, error: null };
    },
    { sleep: async (milliseconds) => delays.push(milliseconds) },
  );

  assert.deepEqual(result, { data: { accounts: ["synthetic"] }, error: null });
  assert.equal(calls, 5);
  assert.deepEqual(delays, [500, 1000, 2000, 4000]);
});

test("retries rate limits and request timeouts", async () => {
  for (const status of [408, 429]) {
    let calls = 0;
    const result = await invokeWithRetry(
      async () => (++calls === 1 ? { error: httpError(status) } : { data: "ok", error: null }),
      { sleep: async () => {} },
    );
    assert.equal(result.data, "ok");
    assert.equal(calls, 2);
  }
});

test("does not retry client/auth failures", async () => {
  let calls = 0;
  const result = await invokeWithRetry(
    async () => { calls += 1; return { data: null, error: httpError(401) }; },
    { sleep: async () => assert.fail("não deve aguardar por erro 401") },
  );
  assert.equal(result.error.context.status, 401);
  assert.equal(calls, 1);
});

test("retries network failures without a response", async () => {
  let calls = 0;
  const result = await invokeWithRetry(
    async () => (++calls === 1
      ? { data: null, error: { context: new TypeError("fetch failed") } }
      : { data: "ok", error: null }),
    { sleep: async () => {} },
  );
  assert.equal(result.data, "ok");
  assert.equal(calls, 2);
});

test("stops after bounded attempts and preserves the final failure", async () => {
  let calls = 0;
  const delays = [];
  const result = await invokeWithRetry(
    async () => { calls += 1; return { data: null, error: httpError(503) }; },
    { maxAttempts: 3, sleep: async (milliseconds) => delays.push(milliseconds) },
  );
  assert.equal(result.error.context.status, 503);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [500, 1000]);
});

test("validates retry configuration", async () => {
  await assert.rejects(invokeWithRetry(async () => ({ data: "unused", error: null }), { maxAttempts: 0 }), RangeError);
  await assert.rejects(invokeWithRetry(async () => ({ data: "unused", error: null }), { baseDelayMs: -1 }), RangeError);
});
