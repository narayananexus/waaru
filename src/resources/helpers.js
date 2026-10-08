import { check, object, resourceId, string } from "../validation.js";
import { WaaruProtocolError } from "../errors.js";
import { getResponseRequestId } from "../transport.js";

export function pathId(value, label) {
  resourceId(value, label);
  return encodeURIComponent(value);
}

export function pageQuery(query = {}, extraKeys = [], label = "Query") {
  object(query, ["limit", "after", ...extraKeys], label);
  if (query.limit !== undefined) {
    check(
      Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 100,
      "limit must be an integer from 1 through 100.",
    );
  }
  if (query.after !== undefined) string(query.after, 512, "after cursor");
  return { ...query };
}

export function timestamp(value, label) {
  const match = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  const year = match && Number(match[1]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = match && [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(match[2]) - 1];
  check(match && value.length <= 64 && Number(match[2]) >= 1 && Number(match[2]) <= 12 && Number(match[3]) >= 1 && Number(match[3]) <= days && Number.isFinite(Date.parse(value)), `${label} must be an RFC3339 timestamp.`);
}

export function trimmed(value, max, label, { nullable = false } = {}) {
  if (nullable && value === null) return;
  check(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    `${label} must be a nonempty string of at most ${max} characters.`,
  );
}

export function smallBody(body) {
  check(Buffer.byteLength(JSON.stringify(body)) <= 4096, "Resource body exceeds the 4 KiB limit.");
  return body;
}

export function managedResult(data, field) {
  responseObject(data, field, field, { outcomeUnknown: true });
  const item = data[field];
  return responseCheck(data,
    typeof item.id === "string" && item.id.length > 0 &&
    typeof item.name === "string" &&
    (item.archivedAt === null || (typeof item.archivedAt === "string" && Number.isFinite(Date.parse(item.archivedAt)))),
    field, { outcomeUnknown: true });
}

export function responseCheck(value, valid, label, { outcomeUnknown = false } = {}) {
  if (!valid) {
    throw new WaaruProtocolError(
      `Waaru returned an invalid ${label} response.`,
      outcomeUnknown,
      getResponseRequestId(value),
    );
  }
  return value;
}

export function responseObject(value, field, label, options) {
  return responseCheck(
    value,
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (field === undefined ||
        (value[field] !== null &&
          typeof value[field] === "object" &&
          !Array.isArray(value[field]))),
    label,
    options,
  );
}

export function responsePage(value, label) {
  return responseCheck(
    value,
    value !== null &&
      typeof value === "object" &&
      Array.isArray(value.items) &&
      (value.nextCursor === null || typeof value.nextCursor === "string"),
    `${label} page`,
  );
}
