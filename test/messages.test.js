import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Waaru,
  WaaruApiError,
  WaaruValidationError,
} from "../src/index.js";

const apiKey = `wak_${"a".repeat(64)}`;
const accepted = {
  messaging_product: "whatsapp",
  messageId: "message-fixture",
  status: "queued",
};
const envelope = {
  messaging_product: "whatsapp",
  to: "+14155552671",
};

function clientWith(response = () => Response.json(accepted, { status: 202 })) {
  const calls = [];
  return {
    calls,
    client: new Waaru({
      apiKey,
      fetch: async (...args) => {
        calls.push(args);
        return response(...args);
      },
    }),
  };
}

const variants = [
  {
    ...envelope,
    recipient_type: "individual",
    type: "text",
    text: { body: "Hello", preview_url: false },
  },
  {
    ...envelope,
    type: "template",
    template: {
      name: "order_update",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: "Ada", parameter_name: "customer" }],
        },
      ],
    },
  },
  {
    ...envelope,
    type: "image",
    image: { link: "https://example.com/image.jpg", caption: "Fixture" },
  },
  {
    ...envelope,
    type: "video",
    video: { link: "https://example.com/video.mp4" },
  },
  {
    ...envelope,
    type: "audio",
    audio: { link: "https://example.com/audio.mp3" },
  },
  {
    ...envelope,
    type: "document",
    document: {
      link: "https://example.com/document.pdf",
      caption: "Invoice",
      filename: "invoice.pdf",
    },
  },
  {
    ...envelope,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: "Choose" },
      body: { text: "Continue?" },
      footer: { text: "Synthetic fixture" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "continue", title: "Continue" } },
        ],
      },
    },
  },
  {
    ...envelope,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Choose one" },
      action: {
        button: "Options",
        sections: [
          {
            title: "Examples",
            rows: [{ id: "one", title: "One", description: "First" }],
          },
        ],
      },
    },
  },
  {
    ...envelope,
    type: "location",
    location: {
      latitude: 19.076,
      longitude: 72.8777,
      name: "Fixture place",
      address: "Synthetic address",
    },
  },
  {
    ...envelope,
    type: "contacts",
    contacts: [
      {
        name: { formatted_name: "Ada Example", first_name: "Ada" },
        phones: [{ phone: "+14155552671", type: "WORK" }],
        emails: [{ email: "ada@example.com", type: "WORK" }],
        urls: [{ url: "https://example.com", type: "WORK" }],
        org: { company: "Example", title: "Engineer" },
      },
    ],
  },
];

test("maps every supported send variant to the exact wire body", async () => {
  const { client, calls } = clientWith();
  assert.equal(typeof client.messages.send, "function");
  for (const body of variants) {
    assert.deepEqual(await client.messages.send(body), accepted);
  }
  assert.equal(calls.length, variants.length);
  for (const [index, body] of variants.entries()) {
    assert.equal(calls[index][0], "https://api.waaru.app/v1/messages");
    assert.equal(calls[index][1].method, "POST");
    assert.deepEqual(JSON.parse(calls[index][1].body), body);
  }
});

test("rejects unsupported or malformed sends before dispatch", async () => {
  const { client, calls } = clientWith();
  const invalid = [
    { ...envelope, type: "sticker", sticker: { link: "https://example.com/a" } },
    { ...variants[0], from: "+14155552672" },
    { ...variants[0], instanceId: "instance-fixture" },
    { ...variants[2], image: { id: "provider-media-id" } },
    { ...variants[8], location: { latitude: 91, longitude: 0 } },
    { ...variants[9], contacts: [] },
    { ...variants[9], contacts: [variants[9].contacts[0], variants[9].contacts[0]] },
    {
      ...variants[6],
      interactive: {
        ...variants[6].interactive,
        action: { buttons: [] },
      },
    },
  ];
  for (const body of invalid) {
    await assert.rejects(client.messages.send(body), WaaruValidationError);
  }
  assert.equal(calls.length, 0);
});

test("forwards only an explicit persistent idempotency key", async () => {
  const { client, calls } = clientWith();
  await client.messages.send(variants[0]);
  await client.messages.send(variants[0], { requestId: "correlation-only" });
  const key = "logical-send:fixture-1";
  await client.messages.send(variants[0], { idempotencyKey: key });
  await client.messages.send(variants[0], { idempotencyKey: key });

  assert.equal(calls[0][1].headers["Idempotency-Key"], undefined);
  assert.equal(calls[1][1].headers["Idempotency-Key"], undefined);
  assert.equal(calls[1][1].headers["x-request-id"], "correlation-only");
  assert.equal(calls[2][1].headers["Idempotency-Key"], key);
  assert.equal(calls[3][1].headers["Idempotency-Key"], key);
  assert.equal(calls[2][1].body, calls[3][1].body);
});

test("rejects invalid idempotency keys before dispatch", async () => {
  const { client, calls } = clientWith();
  for (const idempotencyKey of ["", "contains space", "x".repeat(129), "slash/key"]) {
    await assert.rejects(
      client.messages.send(variants[0], { idempotencyKey }),
      WaaruValidationError,
    );
  }
  assert.equal(calls.length, 0);
});

test("treats an idempotent replay as queued acceptance, not delivery", async () => {
  let calls = 0;
  const { client } = clientWith(() => {
    calls += 1;
    return Response.json(accepted, {
      status: 202,
      headers: { "x-waaru-request-id": `accept-${calls}` },
    });
  });
  const options = { idempotencyKey: "logical-send:fixture" };
  assert.deepEqual(await client.messages.send(variants[0], options), {
    ...accepted,
    requestId: "accept-1",
  });
  assert.deepEqual(await client.messages.send(variants[0], options), {
    ...accepted,
    requestId: "accept-2",
  });
  assert.equal(calls, 2);
});

test("surfaces idempotency conflicts once without inventing a replacement key", async () => {
  for (const code of ["idempotency_conflict", "idempotency_result_unavailable"]) {
    let calls = 0;
    const { client } = clientWith(() => {
      calls += 1;
      return Response.json({ code, message: "Reconcile the original send" }, { status: 409 });
    });
    await assert.rejects(
      client.messages.send(variants[0], { idempotencyKey: "logical-send:fixture" }),
      (error) =>
        error instanceof WaaruApiError &&
        error.status === 409 &&
        error.code === code &&
        !error.outcomeUnknown,
    );
    assert.equal(calls, 1);
  }
});

test("retrieves the definitive message status from the fixed message path", async () => {
  const message = {
    id: "message/id",
    conversationId: "conversation-fixture",
    contactId: "contact-fixture",
    direction: "outbound",
    status: "delivered",
    type: "text",
    occurredAt: "2026-09-29T12:00:00.000Z",
    text: { body: "Synthetic fixture" },
  };
  const { client, calls } = clientWith(() => Response.json({ message }));
  assert.equal(typeof client.messages.get, "function");
  assert.deepEqual(await client.messages.get("message/id"), { message });
  assert.equal(calls[0][0], "https://api.waaru.app/v1/messages/message%2Fid");
  assert.equal(calls[0][1].method, "GET");
});

test("preserves the published text and template convenience shapes", async () => {
  const { client, calls } = clientWith();
  await client.messages.sendText({
    to: envelope.to,
    text: "Hello",
    previewUrl: false,
  });
  await client.messages.sendTemplate({
    to: envelope.to,
    name: "order_update",
    language: "en_US",
  });
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    ...envelope,
    type: "text",
    text: { body: "Hello", preview_url: false },
  });
  assert.deepEqual(JSON.parse(calls[1][1].body), {
    ...envelope,
    type: "template",
    template: { name: "order_update", language: { code: "en_US" } },
  });
});
