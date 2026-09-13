import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  Waaru,
  WaaruApiError,
  WaaruConnectionError,
  WaaruValidationError,
  WaaruTimeoutError,
  WaaruProtocolError,
} from "../src/index.js";
const apiKey = `wak_${"a".repeat(64)}`;
const accepted = {
  messaging_product: "whatsapp",
  messageId: "message-fixture",
  status: "queued",
};
const text = { to: "+14155552671", text: "Hello" };
function mock(response = () => Response.json(accepted, { status: 202 })) {
  const calls = [];
  return {
    calls,
    client: new Waaru({
      apiKey,
      fetch: async (...args) => {
        calls.push(args);
        return response();
      },
    }),
  };
}
test("maps text, defaults, metadata and the number-bound key", async () => {
  const { client, calls } = mock(() =>
    Response.json(accepted, {
      status: 202,
      headers: { "x-request-id": "ref-1" },
    }),
  );
  assert.deepEqual(
    await client.messages.sendText({ ...text, previewUrl: false }),
    { ...accepted, requestId: "ref-1" },
  );
  assert.equal(calls[0][0], "https://api.waaru.app/v1/messages");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    messaging_product: "whatsapp",
    to: text.to,
    type: "text",
    text: { body: "Hello", preview_url: false },
  });
  assert.equal(calls[0][1].headers.Authorization, `Bearer ${apiKey}`);
  assert.equal(calls[0][1].redirect, "error");
  assert.equal(calls[0][1].credentials, "omit");
  assert.ok(!JSON.stringify(client).includes(apiKey));
});
test("loads the API key from the environment", async () => {
  const previous = process.env.WAARU_API_KEY;
  process.env.WAARU_API_KEY = apiKey;
  try {
    await new Waaru({
      fetch: async () => Response.json(accepted, { status: 202 }),
    }).messages.sendText(text);
  } finally {
    if (previous === undefined) delete process.env.WAARU_API_KEY;
    else process.env.WAARU_API_KEY = previous;
  }
});
test("maps approved template components and variable names exactly", async () => {
  const { client, calls } = mock();
  const components = [
    {
      type: "body",
      parameters: [{ type: "text", text: "Ada", parameter_name: "customer" }],
    },
    {
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            link: "https://example.com/invoice.pdf",
            filename: "invoice.pdf",
          },
        },
      ],
    },
  ];
  await client.messages.sendTemplate({
    to: text.to,
    name: "order_update",
    language: "en_US",
    components,
  });
  assert.deepEqual(JSON.parse(calls[0][1].body).template, {
    name: "order_update",
    language: { code: "en_US" },
    components,
  });
});
test("supports all current template parameter variants", async () => {
  const { client, calls } = mock();
  const parameters = [
    { type: "text", text: "Ada" },
    {
      type: "currency",
      currency: { fallback_value: "USD 12", code: "USD", amount_1000: 12000 },
    },
    { type: "date_time", date_time: { fallback_value: "Tomorrow" } },
    { type: "image", image: { link: "https://example.com/a.jpg" } },
    { type: "video", video: { link: "https://example.com/a.mp4" } },
    { type: "document", document: { link: "https://example.com/a.pdf" } },
  ];
  await client.messages.sendTemplate({
    to: text.to,
    name: "fixture",
    language: "en",
    components: [{ type: "body", parameters }],
  });
  assert.deepEqual(
    JSON.parse(calls[0][1].body).template.components[0].parameters,
    parameters,
  );
});
test("deadline covers response body; cancellation after dispatch is uncertain", async () => {
  const client = new Waaru({
    apiKey,
    timeoutMs: 10,
    fetch: async () =>
      new Response(new ReadableStream({ start() {} }), { status: 202 }),
  });
  await assert.rejects(client.messages.sendText(text), WaaruTimeoutError);
  const c = new AbortController();
  const pending = new Waaru({
    apiKey,
    fetch: () => new Promise(() => {}),
  }).messages.sendText(text, { signal: c.signal });
  c.abort();
  await assert.rejects(
    pending,
    (e) => e instanceof WaaruConnectionError && e.outcomeUnknown,
  );
});
test("rejects invalid input before making a request", async () => {
  const { client, calls } = mock();
  for (const input of [
    { ...text, to: ["+14155552671"] },
    { ...text, to: "4155552671" },
    { ...text, text: "" },
    { ...text, text: "a".repeat(4097) },
    { ...text, from: "+14155552672" },
    { ...text, previewUrl: "yes" },
  ])
    await assert.rejects(client.messages.sendText(input), WaaruValidationError);
  for (const components of [
    [
      {
        type: "body",
        parameters: [{ type: "image", image: { id: "meta-id" } }],
      },
    ],
    [
      {
        type: "header",
        parameters: [
          { type: "image", image: { link: "http://example.com/a" } },
        ],
      },
    ],
    [
      {
        type: "header",
        parameters: [{ type: "image", image: { link: "https://127.0.0.1/a" } }],
      },
    ],
  ])
    await assert.rejects(
      client.messages.sendTemplate({
        to: text.to,
        name: "x",
        language: "en",
        components,
      }),
      WaaruValidationError,
    );
  assert.equal(calls.length, 0);
});
test("no retry for any API failure; preserves codes and retry hints", async () => {
  for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
    const { client, calls } = mock(() =>
      Response.json(
        { code: "fixture_error", message: "server message" },
        { status, headers: { "Retry-After": "5" } },
      ),
    );
    await assert.rejects(
      client.messages.sendText(text),
      (e) =>
        e instanceof WaaruApiError &&
        e.status === status &&
        e.code === "fixture_error" &&
        e.retryAfterSeconds === 5,
    );
    assert.equal(calls.length, 1);
  }
});
test("ambiguous connection failures are never resent or logged", async () => {
  const { client, calls } = mock(() => {
    throw new Error(apiKey);
  });
  await assert.rejects(
    client.messages.sendText(text),
    (e) =>
      e instanceof WaaruConnectionError &&
      e.outcomeUnknown &&
      !String(e).includes(apiKey),
  );
  assert.equal(calls.length, 1);
});
test("malformed and oversized success responses fail with unknown outcome", async () => {
  for (const response of [
    () => new Response("oops", { status: 202 }),
    () => Response.json({ status: "sent" }, { status: 202 }),
    () => new Response("a".repeat(2 * 1024 * 1024 + 1), { status: 202 }),
  ]) {
    const { client } = mock(response);
    await assert.rejects(
      client.messages.sendText(text),
      (e) => e instanceof WaaruProtocolError && e.outcomeUnknown,
    );
  }
});
test("abort before dispatch does not send; deadline covers stalled transport", async () => {
  const { client, calls } = mock();
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    client.messages.sendText(text, { signal: c.signal }),
    (e) => e instanceof WaaruConnectionError && !e.outcomeUnknown,
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    new Waaru({
      apiKey,
      timeoutMs: 10,
      fetch: () => new Promise(() => {}),
    }).messages.sendText(text),
    WaaruTimeoutError,
  );
});
test("rejects unsafe origins and configuration", () => {
  for (const baseUrl of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/v1",
    "https://example.com?x=1",
  ])
    assert.throws(() => new Waaru({ apiKey, baseUrl }), WaaruValidationError);
  assert.throws(() => new Waaru({ apiKey: "bad" }), WaaruValidationError);
  assert.throws(
    () => new Waaru({ apiKey, timeoutMs: NaN }),
    WaaruValidationError,
  );
});
test("real HTTP sends once; lost response is ambiguous", async () => {
  let count = 0;
  const server = createServer(async (req, res) => {
    for await (const chunk of req) {
    }
    count++;
    if (count === 1) {
      res.writeHead(202, { "content-type": "application/json" });
      res.end(JSON.stringify(accepted));
    } else req.socket.destroy();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new Waaru({
      apiKey,
      baseUrl: `http://127.0.0.1:${server.address().port}`,
    });
    assert.equal(
      (await client.messages.sendText(text)).messageId,
      accepted.messageId,
    );
    await assert.rejects(
      client.messages.sendText(text),
      (e) => e.outcomeUnknown === true,
    );
    assert.equal(count, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
