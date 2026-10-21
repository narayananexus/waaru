import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const document = JSON.parse(readFileSync(new URL("./fixtures/developer-openapi.json", import.meta.url), "utf8"));

test("OpenAPI documents exact archived lookup without widening contact lists", () => {
  const detail = document.paths["/v1/developer/contacts/{id}"].get;
  const query = detail.parameters.find(parameter => parameter.name === "includeArchived");
  assert.equal(query?.in, "query");
  assert.equal(query?.schema.type, "boolean");
  assert.equal(query?.schema.default, false);
  const list = document.paths["/v1/developer/contacts"].get;
  assert.ok(!list.parameters.some(parameter => parameter.name === "includeArchived"));
});

test("OpenAPI exposes archive lifecycle fields and requires a reviewed restore revision", () => {
  for (const name of ["Contact", "ContactRead"]) {
    const schema = document.components.schemas[name];
    assert.ok(schema.required.includes("archivedAt"));
    assert.ok(schema.required.includes("revision"));
    assert.equal(schema.properties.revision.type, "integer");
    assert.equal(schema.properties.revision.minimum, 0);
    assert.equal(schema.properties.revision.maximum, Number.MAX_SAFE_INTEGER);
  }
  const patch = document.components.schemas.ContactPatch;
  assert.equal(patch.properties.restoreArchived?.type, "boolean");
  assert.equal(patch.properties.expectedRevision?.minimum, 0);
  const revisionRule = patch.allOf?.find(rule => rule.if?.properties?.restoreArchived?.const === true);
  assert.deepEqual(revisionRule?.if.required, ["restoreArchived"]);
  assert.deepEqual(revisionRule?.then.required, ["expectedRevision"]);
  const upsert = document.components.schemas.ContactUpsert;
  assert.equal(upsert.properties.restoreArchived, undefined);
  assert.equal(upsert.properties.expectedRevision, undefined);
});
