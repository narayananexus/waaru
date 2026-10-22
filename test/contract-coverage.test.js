import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Waaru } from "../src/index.js";

const apiKey = `wak_${"a".repeat(64)}`;
const openapiBytes = await readFile(new URL("./fixtures/developer-openapi.json", import.meta.url));
const openapi = JSON.parse(openapiBytes);
const manifest = JSON.parse(await readFile(new URL("./fixtures/api-contract-manifest.json", import.meta.url)));

function operations(document) {
  const found = [];
  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const scope = /^Requires ([A-Za-z0-9:*_-]+)\./.exec(operation.description ?? "")?.[1];
      const status = Number(Object.keys(operation.responses).find((value) => value.startsWith("2")));
      found.push({
        operationId: operation.operationId,
        method: method.toUpperCase(),
        path,
        scope,
        status,
      });
    }
  }
  return found.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

test("pins the reviewed OpenAPI bytes and maps every operation exactly once", async () => {
  assert.equal(createHash("sha256").update(openapiBytes).digest("hex"), manifest.openapiSha256);
  const distributed = await readFile(new URL("../openapi/developer-openapi.json", import.meta.url));
  assert.deepEqual(distributed, openapiBytes);
  assert.equal(manifest.operations.length, 36);
  assert.equal(new Set(manifest.operations.map((item) => item.operationId)).size, 36);
  assert.equal(new Set(manifest.operations.map((item) => item.sdk)).size, 36);
  const expected = manifest.operations
    .map(({ sdk, ...operation }) => operation)
    .sort((a, b) => a.operationId.localeCompare(b.operationId));
  assert.deepEqual(operations(openapi), expected);
});

test("every manifest mapping resolves to one callable SDK method", () => {
  const client = new Waaru({ apiKey, fetch: async () => { throw new Error("contract inspection never dispatches"); } });
  for (const operation of manifest.operations) {
    const [namespace, method] = operation.sdk.split(".");
    assert.equal(typeof client[namespace]?.[method], "function", operation.sdk);
  }
  assert.ok(!manifest.operations.some((item) => item.sdk === "messages.sendText"));
  assert.ok(!manifest.operations.some((item) => item.sdk === "messages.sendTemplate"));
});

test("pinned schemas cover all send variants and repaired contact response shape", async () => {
  assert.equal(openapi.components.schemas.SendMessage.oneOf.length, 9);
  assert.ok(openapi.components.schemas.ContactRead.required.includes("optedOut"));
  const detail = openapi.paths["/v1/developer/contacts/{id}"].get.responses["200"];
  assert.ok(JSON.stringify(detail).includes("#/components/schemas/ContactRead"));
  assert.ok(openapi.components.schemas.ContactRead.properties.labelIds);
  assert.equal(manifest.contactReadStatus, "verified_by_authenticated_release_probe");
  assert.deepEqual(manifest.releaseBlockers, []);
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
  assert.equal(manifest.releaseVerification.version, pkg.version);
  assert.equal(manifest.releaseVerification.operations, manifest.operations.length);
  assert.equal(manifest.releaseVerification.reads + manifest.releaseVerification.expectedRejections, 36);
  assert.equal(manifest.releaseVerification.liveSends, 0);
  assert.equal(manifest.releaseVerification.validWrites, 0);
  assert.deepEqual(manifest.releaseVerification.capabilityChecks, [
    { capability: "contact_archived_lookup", result: "read_ok" },
    { capability: "contact_restore_validation", result: "expected_rejection", status: 404, code: "contact_not_found" },
  ]);
  assert.equal(manifest.historicalReleaseVerification.version, "1.0.0-beta.3");
  assert.equal(manifest.historicalReleaseVerification.operations, manifest.publishedBaseline.operationCount);
});

test("fixtures contain no raw API key, environment file or customer credential", () => {
  const content = `${openapiBytes}\n${JSON.stringify(manifest)}`;
  assert.doesNotMatch(content, /wak_[a-fA-F0-9]{64}/);
  assert.doesNotMatch(content, /WAARU_API_KEY\s*=/);
  assert.doesNotMatch(content, /BEGIN (?:RSA |EC )?PRIVATE KEY/);
});
