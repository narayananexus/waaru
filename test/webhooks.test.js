import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Waaru,
  WaaruApiError,
  WaaruConnectionError,
  WaaruProtocolError,
} from "../src/index.js";

const apiKey = `wak_${"a".repeat(64)}`;
const detail = {
  id: "webhook-1",
  revision: 3,
  state: "ACTIVE",
  selectedEvents: ["MESSAGE_RECEIVED", "MESSAGE_DELIVERED"],
  callbackUrl: "https://hooks.example.com/waaru",
  consecutiveFailures: 0,
  lastSuccessAt: "2026-09-29T10:00:00.000Z",
  lastFailureAt: null,
  lastFailureCode: null,
  deliveries: [],
};

function mock(responses) {
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  const calls = [];
  return {
    calls,
    client: new Waaru({
      apiKey,
      fetch: async (...args) => {
        calls.push(args);
        const response = queue.shift();
        return response instanceof Response ? response : Response.json(response, { status: 200 });
      },
    }),
  };
}

test("maps all webhook management operations and one-time secrets", async () => {
  const created = {
    webhook: { id: "webhook-1", revision: 1, state: "ACTIVE", selectedEvents: ["MESSAGE_RECEIVED"] },
    signingSecret: "one-time-create-secret",
  };
  const updated = {
    webhook: { id: "webhook-1", revision: 2, state: "ACTIVE", selectedEvents: ["MESSAGE_RECEIVED", "MESSAGE_READ"] },
  };
  const rotated = {
    signingSecret: "one-time-rotated-secret",
    revision: 3,
    previousSecretExpiresAt: "2026-09-30T10:00:00.000Z",
  };
  const tested = { delivered: true, eventId: "event-1" };
  const state = { revision: 4, state: "DISABLED" };
  const { client, calls } = mock([
    { webhook: null },
    { webhook: detail },
    created,
    updated,
    rotated,
    tested,
    state,
  ]);
  assert.equal(typeof client.webhooks.get, "function");
  assert.deepEqual(await client.webhooks.get(), { webhook: null });
  assert.deepEqual(await client.webhooks.get(), { webhook: detail });
  assert.deepEqual(await client.webhooks.save({
    revision: null,
    callbackUrl: "https://hooks.example.com/waaru",
    selectedEvents: ["MESSAGE_RECEIVED"],
  }), created);
  assert.deepEqual(await client.webhooks.save({
    revision: 1,
    selectedEvents: ["MESSAGE_RECEIVED", "MESSAGE_READ"],
  }), updated);
  assert.deepEqual(await client.webhooks.rotate(2), rotated);
  assert.deepEqual(await client.webhooks.test(3), tested);
  assert.deepEqual(await client.webhooks.setState(3, "DISABLED"), state);

  assert.deepEqual(calls.map(([url, init]) => [new URL(url).pathname, init.method]), [
    ["/v1/webhook", "GET"],
    ["/v1/webhook", "GET"],
    ["/v1/webhook", "PUT"],
    ["/v1/webhook", "PUT"],
    ["/v1/webhook/rotate", "POST"],
    ["/v1/webhook/test", "POST"],
    ["/v1/webhook/state", "POST"],
  ]);
  assert.deepEqual(JSON.parse(calls[2][1].body), {
    revision: null,
    callbackUrl: "https://hooks.example.com/waaru",
    selectedEvents: ["MESSAGE_RECEIVED"],
  });
  assert.deepEqual(JSON.parse(calls[4][1].body), { revision: 2 });
  assert.deepEqual(JSON.parse(calls[6][1].body), { revision: 3, state: "DISABLED" });
});

test("does not retry revision conflicts or recover lost secret responses", async () => {
  let calls = 0;
  const conflict = new Waaru({
    apiKey,
    fetch: async () => {
      calls += 1;
      return Response.json({ code: "revision_conflict", message: "Refresh first" }, { status: 409 });
    },
  });
  await assert.rejects(
    conflict.webhooks.rotate(4),
    (error) => error instanceof WaaruApiError && error.code === "revision_conflict",
  );
  assert.equal(calls, 1);

  for (const invoke of [
    (client) => client.webhooks.save({ revision: null, callbackUrl: "https://hooks.example.com/waaru", selectedEvents: ["MESSAGE_RECEIVED"] }),
    (client) => client.webhooks.rotate(4),
  ]) {
    calls = 0;
    const client = new Waaru({ apiKey, fetch: async () => { calls += 1; throw new TypeError("lost response"); } });
    await assert.rejects(
      invoke(client),
      (error) => error instanceof WaaruConnectionError && error.outcomeUnknown,
    );
    assert.equal(calls, 1);
  }
});

test("treats malformed successful create and rotation responses as unknown writes", async () => {
  for (const invoke of [
    (client) => client.webhooks.save({
      revision: null,
      callbackUrl: "https://hooks.example.com/waaru",
      selectedEvents: ["MESSAGE_RECEIVED"],
    }),
    (client) => client.webhooks.rotate(4),
  ]) {
    let calls = 0;
    const client = new Waaru({
      apiKey,
      fetch: async () => {
        calls += 1;
        return Response.json({}, {
          status: 200,
          headers: { "x-request-id": "req_malformed_write" },
        });
      },
    });
    await assert.rejects(
      invoke(client),
      (error) =>
        error instanceof WaaruProtocolError &&
        error.outcomeUnknown === true &&
        error.requestId === "req_malformed_write",
    );
    assert.equal(calls, 1);
  }
});

test("uses uppercase configuration events and rejects unsupported state locally", async () => {
  const { client, calls } = mock({
    webhook: { id: "webhook-1", revision: 1, state: "ACTIVE", selectedEvents: ["MESSAGE_RECEIVED"] },
    signingSecret: "one-time-create-secret",
  });
  await client.webhooks.save({ revision: null, callbackUrl: "https://hooks.example.com/waaru", selectedEvents: ["MESSAGE_RECEIVED"] });
  await assert.rejects(
    client.webhooks.save({ revision: 1, selectedEvents: ["message.received"] }),
    /selectedEvents/,
  );
  await assert.rejects(client.webhooks.setState(1, "PAUSED"), /state/);
  assert.equal(calls.length, 1);
});
