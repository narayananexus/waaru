import { test } from "node:test";
import assert from "node:assert/strict";
import { Waaru } from "../src/index.js";

const module = await import("../scripts/backend-capabilities.mjs").catch(() => ({}));
const missingId = "00000000-0000-4000-8000-000000000000";
const current = { id: "contact-fixture", archivedAt: null, revision: 1 };

async function probe(client) {
  assert.equal(typeof module.verifyContactRestoration, "function");
  return module.verifyContactRestoration(client, "contact-fixture", missingId);
}

function fixture(contact = current, { missingExists = false, restoreStatus = 404 } = {}) {
  const calls = [];
  const client = new Waaru({ apiKey: `wak_${"a".repeat(64)}`, fetch: async (url, init) => {
    calls.push({ url: new URL(url), init });
    if (init.method === "PATCH") return Response.json(
      { code: restoreStatus === 404 ? "contact_not_found" : "invalid_input", message: "Rejected" },
      { status: restoreStatus },
    );
    if (new URL(url).pathname.endsWith(missingId) && !missingExists) {
      return Response.json({ code: "contact_not_found", message: "Missing" }, { status: 404 });
    }
    return Response.json({ contact });
  } });
  return { client, calls };
}

test("restoration capability check reads lifecycle fields and rejects a missing-ID restore without customer output", async () => {
  const { client, calls } = fixture();
  const result = await probe(client);
  assert.deepEqual(result, [
    { capability: "contact_archived_lookup", result: "read_ok" },
    { capability: "contact_restore_validation", result: "expected_rejection", status: 404, code: "contact_not_found" },
  ]);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url.searchParams.get("includeArchived"), "true");
  assert.equal(calls[1].url.searchParams.get("includeArchived"), "true");
  assert.equal(calls[2].url.pathname, `/v1/developer/contacts/${missingId}`);
  assert.deepEqual(JSON.parse(calls[2].init.body), { restoreArchived: true, expectedRevision: 0 });
  assert.ok(!JSON.stringify(result).includes(current.id));
});

for (const contact of [
  { id: "contact-fixture" },
  { ...current, revision: -1 },
  { ...current, revision: Number.MAX_SAFE_INTEGER + 1 },
  { ...current, archivedAt: "invalid" },
]) test("missing or invalid lifecycle fields fail before any restore-shaped request", async () => {
  const { client, calls } = fixture(contact);
  await assert.rejects(probe(client), /Compatibility check failed: contact_restoration/);
  assert.equal(calls.length, 1);
});

test("if the designated missing ID exists, the probe stops before PATCH", async () => {
  const { client, calls } = fixture(current, { missingExists: true });
  await assert.rejects(probe(client), /Compatibility check failed: contact_restoration/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.init.method === "GET"));
});

test("older servers rejecting restoration as an unknown field cannot pass acceptance", async () => {
  const { client, calls } = fixture(current, { restoreStatus: 400 });
  await assert.rejects(probe(client), /Compatibility check failed: contact_restoration/);
  assert.equal(calls.length, 3);
});
