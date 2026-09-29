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
  check(
    typeof value === "string" && value.length <= 64 && Number.isFinite(Date.parse(value)),
    `${label} must be an RFC3339 timestamp.`,
  );
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
