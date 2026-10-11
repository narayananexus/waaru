import { test } from "node:test";
import assert from "node:assert/strict";
import { Waaru, WaaruApiError, WaaruProtocolError, WaaruValidationError } from "../src/index.js";

// Synthetic credential only; never use real API credentials in fixtures.
const apiKey = `wak_${"a".repeat(64)}`;
const filters = [
  ["contact search", "contacts", "q", 256],
  ["conversation search", "conversations", "q", 128],
  ["template name", "templates", "name", 512],
  ["template language", "templates", "language", 32],
];

for (const [name, resource, field, max] of filters) {
  test(`${name} rejects raw whitespace padding beyond its query bound before dispatch`, async () => {
    let calls = 0;
    const client = new Waaru({ apiKey, fetch: async () => {
      calls += 1;
      return Response.json({ items: [], nextCursor: null });
    } });
    for (const value of [" ".repeat(max) + "x", "x" + "\t".repeat(max), "\u2003".repeat(max) + "x"]) {
      await assert.rejects(client[resource].list({ [field]: value }), WaaruValidationError);
    }
    assert.equal(calls, 0);
  });

  test(`${name} preserves bounded filters and accepts the exact raw boundary`, async () => {
    const urls = [];
    const client = new Waaru({ apiKey, fetch: async (url) => {
      urls.push(new URL(url));
      return Response.json({ items: [], nextCursor: null });
    } });
    await client[resource].list({ [field]: " x " });
    await client[resource].list({ [field]: "x".repeat(max) });
    assert.equal(urls[0].searchParams.get(field), " x ");
    assert.equal(urls[1].searchParams.get(field), "x".repeat(max));
  });
}

for (const reflected of [apiKey, `prefix:${apiKey}:suffix`, apiKey.toUpperCase(), `wak_${"b".repeat(64)}`]) {
  test("credential-shaped upstream error codes never enter safe diagnostics", async () => {
    const client = new Waaru({ apiKey, fetch: async () => Response.json(
      { code: reflected, message: "Rejected" }, { status: 400 },
    ) });
    await assert.rejects(client.messages.sendText({ to: "+14155552671", text: "Fixture" }), (error) => {
      assert.ok(error instanceof WaaruApiError);
      assert.equal(error.code, "http_error");
      assert.equal(error.outcomeUnknown, true);
      assert.ok(!JSON.stringify(error).includes(reflected));
      assert.ok(!String(error).includes(reflected));
      return true;
    });
  });

  for (const header of ["x-request-id", "x-waaru-request-id"]) {
    test(`${header} drops reflected credentials from errors and accepted sends`, async () => {
      for (const status of [400, 202, 200]) {
        const client = new Waaru({ apiKey, fetch: async () => Response.json(
          status === 400 ? { code: "invalid_message", message: "Rejected" } :
            status === 202 ? { messaging_product: "whatsapp", messageId: "message-fixture", status: "queued" } : { invalid: true },
          { status, headers: { [header]: reflected } },
        ) });
        const pending = client.messages.sendText({ to: "+14155552671", text: "Fixture" }, { requestId: "caller-safe" });
        if (status === 202) {
          const result = await pending;
          assert.equal(result.requestId, "caller-safe");
          assert.ok(!JSON.stringify(result).includes(reflected));
        } else {
          await assert.rejects(pending, (error) => {
            assert.ok(error instanceof (status === 400 ? WaaruApiError : WaaruProtocolError));
            assert.equal(error.requestId, "caller-safe");
            assert.ok(!JSON.stringify(error).includes(reflected));
            return true;
          });
        }
      }
    });
  }
}

test("a rejected primary request ID falls through to the safe secondary header", async () => {
  const client = new Waaru({ apiKey, fetch: async () => Response.json(
    { code: "new_backend_code", message: "Rejected" },
    { status: 403, headers: { "x-request-id": apiKey, "x-waaru-request-id": "safe-secondary" } },
  ) });
  await assert.rejects(client.instance.get(), (error) => {
    assert.equal(error.code, "new_backend_code");
    assert.equal(error.requestId, "safe-secondary");
    return true;
  });
});

test("reflected credentials without a safe request ID remain absent", async () => {
  const client = new Waaru({ apiKey, fetch: async () => Response.json(
    { code: "invalid_message", message: "Rejected" },
    { status: 400, headers: { "x-request-id": apiKey, "x-waaru-request-id": apiKey } },
  ) });
  await assert.rejects(client.instance.get(), (error) => {
    assert.equal(error.requestId, undefined);
    assert.ok(!JSON.stringify(error).includes(apiKey));
    return true;
  });
});
