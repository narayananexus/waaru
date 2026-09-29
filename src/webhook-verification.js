import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhook({
  rawBody,
  timestamp,
  signature,
  secret,
  nowMs = Date.now(),
  toleranceSeconds = 300,
} = {}) {
  if (
    !(rawBody instanceof Uint8Array) ||
    typeof secret !== "string" ||
    secret.length < 1 ||
    typeof timestamp !== "string" ||
    !/^\d{1,12}$/.test(timestamp) ||
    typeof signature !== "string" ||
    signature.length > 512 ||
    !Number.isFinite(nowMs) ||
    !Number.isInteger(toleranceSeconds) ||
    toleranceSeconds < 1 ||
    toleranceSeconds > 300
  ) return false;

  const seconds = Number(timestamp);
  if (Math.abs(Math.floor(nowMs / 1000) - seconds) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();

  for (const part of signature.split(",")) {
    const candidate = part.trim();
    if (!/^v1=[a-f0-9]{64}$/.test(candidate)) continue;
    const digest = Buffer.from(candidate.slice(3), "hex");
    if (digest.length === expected.length && timingSafeEqual(expected, digest)) return true;
  }
  return false;
}
