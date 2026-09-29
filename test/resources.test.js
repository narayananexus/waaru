import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Waaru,
  WaaruApiError,
  WaaruProtocolError,
  WaaruValidationError,
} from "../src/index.js";

const apiKey = `wak_${"a".repeat(64)}`;
const contact = {
  id: "contact-1",
  phoneE164: "+14155552671",
  firstName: "Ada",
  lastName: null,
  email: "ada@example.com",
  countryCode: "US",
  locale: "en_US",
  customAttributes: { tier: "gold", score: 7, active: true, note: null },
  createdAt: "2026-09-29T09:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};
const message = {
  id: "message-1",
  conversationId: "conversation-1",
  contactId: "contact-1",
  direction: "inbound",
  status: "received",
  type: "text",
  occurredAt: "2026-09-29T10:00:00.000Z",
};
const conversation = {
  id: "conversation-1",
  contactId: "contact-1",
  phoneNumber: "+14155552671",
  contactName: "Ada",
  lastMessageAt: "2026-09-29T10:00:00.000Z",
  humanOwned: false,
  lastMessage: message,
};
const segment = {
  id: "segment-1",
  name: "Fixture segment",
  description: null,
  memberCount: 1,
  updatedAt: "2026-09-29T10:00:00.000Z",
};
const template = {
  id: "template-1",
  name: "order_update",
  language: "en_US",
  category: "UTILITY",
  parameterFormat: "POSITIONAL",
  components: [{ type: "BODY", text: "Hello {{1}}" }],
  status: "APPROVED",
  quality: null,
  statusSyncedAt: "2026-09-29T10:00:00.000Z",
  qualitySyncedAt: null,
};

function mock(response) {
  const calls = [];
  return {
    calls,
    client: new Waaru({
      apiKey,
      fetch: async (...args) => {
        calls.push(args);
        return Response.json(response, { status: 200 });
      },
    }),
  };
}

const operations = [
  {
    name: "conversations.list",
    response: { items: [conversation], nextCursor: null },
    invoke: (c) => c.conversations.list(),
    method: "GET",
    path: "/v1/conversations",
  },
  {
    name: "conversations.messages",
    response: { items: [message], nextCursor: null },
    invoke: (c) => c.conversations.messages("conversation-1"),
    method: "GET",
    path: "/v1/conversations/conversation-1/messages",
  },
  {
    name: "contacts.list",
    response: { items: [{ ...contact, optedOut: true }], nextCursor: null },
    invoke: (c) => c.contacts.list(),
    method: "GET",
    path: "/v1/developer/contacts",
  },
  {
    name: "contacts.get",
    response: { contact: { ...contact, optedOut: true, labelIds: ["label-1"] } },
    invoke: (c) => c.contacts.get("contact-1"),
    method: "GET",
    path: "/v1/developer/contacts/contact-1",
  },
  {
    name: "contacts.upsert",
    response: { contact },
    invoke: (c) => c.contacts.upsert({ phoneE164: contact.phoneE164, firstName: "Ada" }),
    method: "POST",
    path: "/v1/developer/contacts",
    body: { phoneE164: contact.phoneE164, firstName: "Ada" },
  },
  {
    name: "contacts.update",
    response: { contact: { ...contact, lastName: null } },
    invoke: (c) => c.contacts.update("contact-1", { lastName: null }),
    method: "PATCH",
    path: "/v1/developer/contacts/contact-1",
    body: { lastName: null },
  },
  {
    name: "labels.list",
    response: { items: [{ id: "label-1", name: "Priority" }], nextCursor: null },
    invoke: (c) => c.labels.list(),
    method: "GET",
    path: "/v1/developer/labels",
  },
  {
    name: "contacts.applyLabel",
    response: { contactId: "contact-1", labelId: "label-1", applied: true },
    invoke: (c) => c.contacts.applyLabel("contact-1", "label-1"),
    method: "PUT",
    path: "/v1/developer/contacts/contact-1/labels/label-1",
  },
  {
    name: "contacts.removeLabel",
    response: { contactId: "contact-1", labelId: "label-1", applied: false },
    invoke: (c) => c.contacts.removeLabel("contact-1", "label-1"),
    method: "DELETE",
    path: "/v1/developer/contacts/contact-1/labels/label-1",
  },
  {
    name: "segments.list",
    response: { items: [segment], nextCursor: null },
    invoke: (c) => c.segments.list(),
    method: "GET",
    path: "/v1/developer/segments",
  },
  {
    name: "segments.get",
    response: { segment },
    invoke: (c) => c.segments.get("segment-1"),
    method: "GET",
    path: "/v1/developer/segments/segment-1",
  },
  {
    name: "segments.create",
    response: { segment },
    invoke: (c) => c.segments.create({ name: segment.name, description: null }),
    method: "POST",
    path: "/v1/developer/segments",
    body: { name: segment.name, description: null },
  },
  {
    name: "segments.listMembers",
    response: { items: [{ id: "member-1", contactId: "contact-1", addedAt: "2026-09-29T10:00:00.000Z" }], nextCursor: null },
    invoke: (c) => c.segments.listMembers("segment-1"),
    method: "GET",
    path: "/v1/developer/segments/segment-1/members",
  },
  {
    name: "segments.addMember",
    response: { segmentId: "segment-1", contactId: "contact-1", changed: false, memberCount: 1 },
    invoke: (c) => c.segments.addMember("segment-1", "contact-1"),
    method: "PUT",
    path: "/v1/developer/segments/segment-1/members/contact-1",
  },
  {
    name: "segments.removeMember",
    response: { segmentId: "segment-1", contactId: "contact-1", changed: true, memberCount: 0 },
    invoke: (c) => c.segments.removeMember("segment-1", "contact-1"),
    method: "DELETE",
    path: "/v1/developer/segments/segment-1/members/contact-1",
  },
  {
    name: "templates.list",
    response: { items: [template], nextCursor: null },
    invoke: (c) => c.templates.list(),
    method: "GET",
    path: "/v1/developer/templates",
  },
  {
    name: "templates.get",
    response: { template },
    invoke: (c) => c.templates.get("template-1"),
    method: "GET",
    path: "/v1/developer/templates/template-1",
  },
  {
    name: "reports.activity",
    response: {
      retention: {
        days: 7,
        timezone: "UTC",
        dates: ["2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"],
        startsAt: "2026-09-23T00:00:00.000Z",
        endsAt: "2026-09-30T00:00:00.000Z",
      },
      api: {
        totalCalls: 2,
        daily: [{ date: "2026-09-29", count: 2 }],
        operations: [{ operation: "SEND_MESSAGE", count: 2 }],
        results: [{ result: "SUCCESS", count: 2 }],
      },
      webhook: {
        deliveryCount: 1,
        attemptCount: 1,
        daily: [{ date: "2026-09-29", count: 1 }],
        events: [{ event: "MESSAGE_DELIVERED", count: 1 }],
        statuses: [{ status: "DELIVERED", count: 1 }],
        recentDeliveries: [],
      },
    },
    invoke: (c) => c.reports.activity(),
    method: "GET",
    path: "/v1/developer/reports/activity",
  },
];

test("maps every JSON resource operation to its fixed contract", async () => {
  assert.equal(operations.length, 18);
  for (const operation of operations) {
    const { client, calls } = mock(operation.response);
    assert.deepEqual(await operation.invoke(client), operation.response, operation.name);
    assert.equal(calls.length, 1, operation.name);
    const url = new URL(calls[0][0]);
    assert.equal(url.pathname, operation.path, operation.name);
    assert.equal(calls[0][1].method, operation.method, operation.name);
    if (operation.body === undefined) assert.equal(calls[0][1].body, undefined, operation.name);
    else assert.deepEqual(JSON.parse(calls[0][1].body), operation.body, operation.name);
  }
});

test("treats a malformed successful resource mutation as an unknown write", async () => {
  let calls = 0;
  const client = new Waaru({
    apiKey,
    fetch: async () => {
      calls += 1;
      return Response.json({}, {
        status: 200,
        headers: { "x-request-id": "req_malformed_contact" },
      });
    },
  });
  await assert.rejects(
    client.contacts.upsert({ phoneE164: "+14155552671" }),
    (error) =>
      error instanceof WaaruProtocolError &&
      error.outcomeUnknown === true &&
      error.requestId === "req_malformed_contact",
  );
  assert.equal(calls, 1);
});

test("preserves contact read extensions but keeps write bodies bounded", async () => {
  const list = operations.find((item) => item.name === "contacts.list");
  const detail = operations.find((item) => item.name === "contacts.get");
  assert.equal((await list.invoke(mock(list.response).client)).items[0].optedOut, true);
  assert.deepEqual((await detail.invoke(mock(detail.response).client)).contact.labelIds, ["label-1"]);

  const { client, calls } = mock({ contact });
  for (const patch of [
    {},
    { contactId: "contact-1" },
    { phoneE164: "+14155552672" },
    { consent: true },
    { optedOut: false },
    { customAttributes: { nested: { unsafe: true } } },
  ]) {
    await assert.rejects(client.contacts.update("contact-1", patch), WaaruValidationError);
  }
  assert.equal(calls.length, 0);
});

test("maps pagination directions and preserves offset timestamps", async () => {
  const response = { items: [], nextCursor: null };
  const { client, calls } = mock(response);
  await client.contacts.list({ limit: 25, after: "contact-cursor", q: "Ada", updatedSince: "2026-09-29T12:00:00+05:30" });
  await client.conversations.list({ limit: 10, after: "opaque-conversation", contactId: "contact-1", q: "+1415", updatedSince: "2026-09-29T12:00:00+05:30" });
  await client.conversations.messages("conversation-1", { limit: 20, before: "history-cursor", since: "2026-09-29T12:00:00+05:30", direction: "outbound", status: "delivered" });
  await client.conversations.messages("conversation-1", { after: "incremental-cursor", since: "2026-09-29T12:00:00+05:30" });

  assert.deepEqual(Object.fromEntries(new URL(calls[0][0]).searchParams), {
    limit: "25", after: "contact-cursor", q: "Ada", updatedSince: "2026-09-29T12:00:00+05:30",
  });
  assert.equal(new URL(calls[1][0]).searchParams.get("after"), "opaque-conversation");
  assert.equal(new URL(calls[2][0]).searchParams.get("before"), "history-cursor");
  assert.equal(new URL(calls[3][0]).searchParams.get("after"), "incremental-cursor");
  assert.equal(new URL(calls[3][0]).searchParams.get("since"), "2026-09-29T12:00:00+05:30");
  await assert.rejects(
    client.conversations.messages("conversation-1", { before: "a", after: "b" }),
    WaaruValidationError,
  );
});

test("propagates representative resource errors without retries", async () => {
  for (const status of [400, 401, 403, 404, 409, 429, 503]) {
    let calls = 0;
    const client = new Waaru({
      apiKey,
      fetch: async () => {
        calls += 1;
        return Response.json({ code: `error_${status}`, message: "Safe fixture" }, { status });
      },
    });
    await assert.rejects(
      client.segments.get("segment-1"),
      (error) => error instanceof WaaruApiError && error.status === status,
    );
    assert.equal(calls, 1);
  }
});

test("does not interpret additive response fields as URLs, headers or logs", async () => {
  const response = {
    items: [{ ...template, futureField: { downloadPath: "https://attacker.example/secret", authorization: apiKey } }],
    nextCursor: null,
  };
  const { client, calls } = mock(response);
  assert.deepEqual(await client.templates.list(), response);
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0][0]).origin, "https://api.waaru.app");
});
