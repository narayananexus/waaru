import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as sdk from "../src/index.js";

const secret = "fixture-signing-secret";
const timestamp = "1790676000";
const nowMs = Number(timestamp) * 1000;
const rawBody = new TextEncoder().encode('{ "id": "event-1", "type": "message.received", "text": "नमस्ते" }');

function signature(body = rawBody, key = secret, time = timestamp) {
  return `v1=${createHmac("sha256", key).update(`${time}.`).update(body).digest("hex")}`;
}

function verify(overrides = {}) {
  assert.equal(typeof sdk.verifyWebhook, "function", "verifyWebhook must be exported");
  return sdk.verifyWebhook({ rawBody, timestamp, signature: signature(), secret, nowMs, ...overrides });
}

test("verifies exact raw multibyte bytes and either rotation signature", () => {
  assert.equal(verify(), true);
  const previous = signature(rawBody, "previous-secret");
  assert.equal(verify({ signature: `${previous}, ${signature()}` }), true);
  assert.equal(verify({ signature: `${signature()}, ${previous}` }), true);
});

test("rejects body whitespace, content and secret tampering", () => {
  const changedWhitespace = new TextEncoder().encode('{"id":"event-1","type":"message.received","text":"नमस्ते"}');
  assert.equal(verify({ rawBody: changedWhitespace }), false);
  const changedContent = new Uint8Array(rawBody);
  changedContent[5] ^= 1;
  assert.equal(verify({ rawBody: changedContent }), false);
  assert.equal(verify({ secret: "wrong-secret" }), false);
});

test("rejects malformed or oversized signatures without throwing", () => {
  for (const value of [
    "",
    "v1=xyz",
    `v1=${"A".repeat(64)}`,
    `v2=${"a".repeat(64)}`,
    `v1=${"a".repeat(63)}`,
    "x".repeat(513),
  ]) assert.equal(verify({ signature: value }), false);
});

test("enforces finite time and the configured freshness boundary", () => {
  assert.equal(verify({ nowMs: nowMs + 300_000 }), true);
  assert.equal(verify({ nowMs: nowMs - 300_000 }), true);
  assert.equal(verify({ nowMs: nowMs + 301_000 }), false);
  assert.equal(verify({ nowMs: nowMs - 301_000 }), false);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(verify({ nowMs: value }), false);
  for (const value of [0, 301, 1.5]) assert.equal(verify({ toleranceSeconds: value }), false);
  for (const value of ["", "not-time", "1234567890123"]) assert.equal(verify({ timestamp: value }), false);
});

test("accepts Buffer only through the Uint8Array contract and rejects parsed objects", () => {
  assert.equal(verify({ rawBody: Buffer.from(rawBody) }), true);
  assert.equal(verify({ rawBody: JSON.parse(new TextDecoder().decode(rawBody)) }), false);
  assert.equal(verify({ rawBody: "raw string" }), false);
});
