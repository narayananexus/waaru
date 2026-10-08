import { isIP } from "node:net";
import { WaaruValidationError } from "./errors.js";
export function check(ok, message) {
  if (!ok) throw new WaaruValidationError(message);
}
export function object(value, keys, label) {
  check(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object.`,
  );
  check(
    Object.keys(value).every((key) => keys.includes(key)),
    `${label} contains unsupported fields.`,
  );
}
export function string(value, max, label) {
  check(
    typeof value === "string" && value.length > 0 && value.length <= max,
    `${label} must be a nonempty string of at most ${max} characters.`,
  );
}
export function recipient(to) {
  check(
    typeof to === "string" && /^\+[1-9]\d{7,14}$/.test(to),
    "Recipient must use +E.164 format, for example +14155552671.",
  );
}
export function timeout(value) {
  check(
    Number.isInteger(value) && value > 0 && value <= 300000,
    "Timeout must be an integer between 1 and 300000 milliseconds.",
  );
  return value;
}
export function requestId(value) {
  check(
    typeof value === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value),
    "Invalid request ID.",
  );
  return value;
}
export function idempotencyKey(value) {
  check(
    typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value),
    "Invalid idempotency key.",
  );
  return value;
}
export function resourceId(value, label = "Resource ID") {
  string(value, 512, label);
  check(
    !value.split(/[\\/]/).some((part) => part === "." || part === "..") &&
      !/%2e/i.test(value),
    `${label} is invalid.`,
  );
  return value;
}
export function mediaLink(value) {
  string(value, 2048, "Media link");
  let url;
  try {
    url = new URL(value);
  } catch {
    check(false, "Media link must be a public HTTPS URL.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  check(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      !isIP(host) &&
      host !== "localhost" &&
      !host.endsWith(".localhost") &&
      !host.endsWith(".local"),
    "Media link must be a public HTTPS URL on port 443.",
  );
}
export { validateTemplate as template } from "./template-validation.js";
