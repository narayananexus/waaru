import { test } from "node:test";
import assert from "node:assert/strict";
import { Waaru, WaaruApiError, WaaruTimeoutError, WaaruValidationError } from "../src/index.js";

const apiKey = `wak_${"a".repeat(64)}`;

test("streams media from the fixed media path without JSON parsing", async () => {
  const calls = [];
  const client = new Waaru({
    apiKey,
    fetch: async (...args) => {
      calls.push(args);
      return new Response(new Uint8Array([0, 255, 1]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    },
  });
  assert.equal(typeof client.media.download, "function");
  const response = await client.media.download("media/id");
  assert.ok(response instanceof Response);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([0, 255, 1]));
  assert.equal(calls[0][0], "https://api.waaru.app/v1/media/media%2Fid");
  assert.equal(calls[0][1].headers.Accept, "*/*");
});

test("keeps the original media deadline active through body consumption", async () => {
  let cancelled = false;
  const client = new Waaru({
    apiKey,
    timeoutMs: 10,
    fetch: async () => new Response(new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
        return new Promise(() => {});
      },
      cancel() { cancelled = true; },
    }), { status: 200 }),
  });
  const reader = (await client.media.download("media-1")).body.getReader();
  await reader.read();
  await assert.rejects(reader.read(), WaaruTimeoutError);
  assert.equal(cancelled, true);
});

test("propagates media API errors and rejects hostile IDs without dispatch", async () => {
  for (const status of [401, 404, 429]) {
    let calls = 0;
    const client = new Waaru({
      apiKey,
      fetch: async () => {
        calls += 1;
        return Response.json({ code: `media_${status}`, message: "Safe fixture" }, { status });
      },
    });
    await assert.rejects(
      client.media.download("media-1"),
      (error) => error instanceof WaaruApiError && error.status === status,
    );
    assert.equal(calls, 1);
  }

  let calls = 0;
  const client = new Waaru({ apiKey, fetch: async () => { calls += 1; return new Response(); } });
  for (const id of ["../secret", ".", "..", "%2e%2e/secret"]) {
    await assert.rejects(client.media.download(id), WaaruValidationError);
  }
  assert.equal(calls, 0);
});

test("never follows a downloadPath returned by a JSON resource", async () => {
  const calls = [];
  const client = new Waaru({
    apiKey,
    fetch: async (...args) => {
      calls.push(args);
      return Response.json({
        message: {
          id: "message-1",
          conversationId: "conversation-1",
          contactId: "contact-1",
          direction: "inbound",
          status: "received",
          type: "image",
          occurredAt: "2026-09-29T10:00:00.000Z",
          media: { availability: "ready", id: "media-1", downloadPath: "https://attacker.example/secret" },
        },
      });
    },
  });
  await client.messages.get("message-1");
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0][0]).origin, "https://api.waaru.app");
});
