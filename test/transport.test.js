import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WaaruApiError,
  WaaruConnectionError,
  WaaruProtocolError,
  WaaruTimeoutError,
  WaaruValidationError,
} from "../src/errors.js";

const transportModule = await import("../src/transport.js").catch(() => ({}));
const apiKey = `wak_${"a".repeat(64)}`;

function transport(options = {}) {
  assert.equal(
    typeof transportModule.createTransport,
    "function",
    "createTransport must exist before transport behavior can be exercised",
  );
  return transportModule.createTransport({ apiKey, ...options });
}

function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers });
}

test("rejects hostile origins and traversal paths before dispatch", async () => {
  for (const baseUrl of [
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com/v1",
    "https://example.com?token=secret",
    "https://example.com/#fragment",
  ]) {
    assert.throws(() => transport({ baseUrl }), WaaruValidationError);
  }

  let calls = 0;
  const request = transport({
    fetch: async () => {
      calls += 1;
      return json({ ok: true });
    },
  });
  for (const path of [
    "https://attacker.example/v1/messages",
    "/v1/messages/../secrets",
    "/v1/messages/%2e%2e/secrets",
    "/v1/messages?next=https://attacker.example",
  ]) {
    await assert.rejects(
      request.request({ method: "GET", path, expectedStatus: 200 }),
      WaaruValidationError,
    );
  }
  assert.equal(calls, 0);
});

test("omits credentials, refuses redirects and forwards only safe headers", async () => {
  const calls = [];
  const request = transport({
    fetch: async (...args) => {
      calls.push(args);
      return json({ ok: true }, 200, { "x-request-id": "req-server" });
    },
  });
  assert.deepEqual(
    await request.request({
      method: "POST",
      path: "/v1/test",
      body: { fixture: true },
      options: { requestId: "req-client" },
      expectedStatus: 200,
    }),
    { ok: true },
  );
  const [, init] = calls[0];
  assert.equal(init.credentials, "omit");
  assert.equal(init.redirect, "error");
  assert.equal(init.headers.Authorization, `Bearer ${apiKey}`);
  assert.equal(init.headers["x-request-id"], "req-client");
  assert.equal(init.headers["Content-Type"], "application/json");
});

test("does not dispatch an already-aborted request", async () => {
  let calls = 0;
  const request = transport({
    fetch: async () => {
      calls += 1;
      return json({ ok: true });
    },
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    request.request({
      method: "GET",
      path: "/v1/test",
      options: { signal: controller.signal },
      expectedStatus: 200,
    }),
    (error) =>
      error instanceof WaaruConnectionError && !error.outcomeUnknown,
  );
  assert.equal(calls, 0);
});

test("marks write timeout and post-dispatch abort as outcome unknown", async () => {
  const request = transport({ timeoutMs: 10, fetch: () => new Promise(() => {}) });
  await assert.rejects(
    request.request({
      method: "POST",
      path: "/v1/test",
      body: { fixture: true },
      expectedStatus: 200,
    }),
    (error) => error instanceof WaaruTimeoutError && error.outcomeUnknown,
  );

  const controller = new AbortController();
  const pending = request.request({
    method: "PUT",
    path: "/v1/test",
    body: { fixture: true },
    options: { signal: controller.signal, requestId: "req-write" },
    expectedStatus: 200,
  });
  controller.abort();
  await assert.rejects(
    pending,
    (error) =>
      error instanceof WaaruConnectionError &&
      error.outcomeUnknown &&
      error.requestId === "req-write",
  );
});

test("read failures never claim an uncertain mutation outcome", async () => {
  for (const response of [
    () => new Response("not-json", { status: 200 }),
    () => new Response("x".repeat(2 * 1024 * 1024 + 1), { status: 200 }),
    () => json({ code: "temporary", message: "unsafe detail" }, 503),
  ]) {
    const request = transport({ fetch: async () => response() });
    await assert.rejects(
      request.request({ method: "GET", path: "/v1/test", expectedStatus: 200 }),
      (error) => error.outcomeUnknown === false,
    );
  }
});

test("keeps raw response secrets and upstream messages out of errors", async () => {
  const secret = "wak_raw_secret_fixture";
  for (const response of [
    () => json({ code: "denied", message: secret, token: secret }, 403),
    () => new Response(secret, { status: 502 }),
  ]) {
    const request = transport({ fetch: async () => response() });
    await assert.rejects(
      request.request({ method: "POST", path: "/v1/test", expectedStatus: 200 }),
      (error) => {
        const exposed = `${String(error)} ${JSON.stringify(error)} ${String(error.cause)}`;
        return !exposed.includes(secret) && error.cause === undefined;
      },
    );
  }
});

test("validates response request IDs and preserves a caller fallback", async () => {
  const cases = [
    [{ "x-request-id": "primary", "x-waaru-request-id": "secondary" }, "primary"],
    [{ "x-request-id": "bad id", "x-waaru-request-id": "secondary" }, "secondary"],
    [{ "x-request-id": "bad id", "x-waaru-request-id": "also bad" }, "caller"],
  ];
  for (const [headers, expected] of cases) {
    const request = transport({
      fetch: async () => json({ code: "denied", message: "safe" }, 403, headers),
    });
    await assert.rejects(
      request.request({
        method: "GET",
        path: "/v1/test",
        options: { requestId: "caller" },
        expectedStatus: 200,
      }),
      (error) => error instanceof WaaruApiError && error.requestId === expected,
    );
  }

  const request = transport({ fetch: async () => { throw new TypeError("offline"); } });
  await assert.rejects(
    request.request({
      method: "GET",
      path: "/v1/test",
      options: { requestId: "caller" },
      expectedStatus: 200,
    }),
    (error) =>
      error instanceof WaaruConnectionError && error.requestId === "caller",
  );
});

test("parses Retry-After and makes exactly one attempt", async () => {
  const retryAfter = [
    ["7", 7],
    [new Date(Date.now() + 4000).toUTCString(), 4],
  ];
  for (const [header, expected] of retryAfter) {
    let calls = 0;
    const request = transport({
      fetch: async () => {
        calls += 1;
        return json(
          { code: "temporary", message: "safe" },
          429,
          { "Retry-After": header },
        );
      },
    });
    await assert.rejects(
      request.request({ method: "GET", path: "/v1/test", expectedStatus: 200 }),
      (error) =>
        error instanceof WaaruApiError &&
        Math.abs(error.retryAfterSeconds - expected) <= 1,
    );
    assert.equal(calls, 1);
  }

  for (const status of [408, 429, 500, 503]) {
    let calls = 0;
    const request = transport({
      fetch: async () => {
        calls += 1;
        return json({ code: "temporary", message: "safe" }, status);
      },
    });
    await assert.rejects(
      request.request({ method: "POST", path: "/v1/test", expectedStatus: 200 }),
      WaaruApiError,
    );
    assert.equal(calls, 1);
  }
});

test("keeps the deadline active until a binary response is consumed or cancelled", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array([1]));
      return new Promise(() => {});
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = transport({
    timeoutMs: 10,
    fetch: async () => new Response(stream, { status: 200 }),
  });
  const response = await request.request({
    method: "GET",
    path: "/v1/media/media-fixture",
    expectedStatus: 200,
    binary: true,
  });
  const reader = response.body.getReader();
  await reader.read();
  await assert.rejects(reader.read(), WaaruTimeoutError);
  assert.equal(cancelled, true);
});

test("rejects invalid JSON response metadata without exposing response bodies", async () => {
  const request = transport({ fetch: async () => json({ ok: true }, 201) });
  await assert.rejects(
    request.request({ method: "GET", path: "/v1/test", expectedStatus: 200 }),
    (error) => error instanceof WaaruProtocolError && !error.outcomeUnknown,
  );
});
