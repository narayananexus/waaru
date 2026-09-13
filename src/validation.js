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
function link(value) {
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
export function template(input) {
  string(input.name, 512, "Template name");
  string(input.language, 32, "Template language");
  if (input.components === undefined) return;
  check(
    Array.isArray(input.components) && input.components.length <= 100,
    "Template supports at most 100 components.",
  );
  for (const c of input.components) {
    object(c, ["type", "sub_type", "index", "parameters"], "Component");
    check(
      ["header", "body", "button"].includes(c.type),
      "Invalid component type.",
    );
    if (c.sub_type !== undefined)
      check(
        ["quick_reply", "url", "copy_code"].includes(c.sub_type),
        "Invalid button subtype.",
      );
    if (c.index !== undefined)
      check(
        typeof c.index === "string" && /^\d{1,2}$/.test(c.index),
        "Button index must be a one- or two-digit string.",
      );
    check(
      Array.isArray(c.parameters) && c.parameters.length <= 100,
      "Component parameters must be an array of at most 100 items.",
    );
    for (const p of c.parameters) {
      object(
        p,
        [
          "type",
          "text",
          "currency",
          "date_time",
          "parameter_name",
          "image",
          "video",
          "document",
        ],
        "Parameter",
      );
      const named = ["text", "currency", "date_time"].includes(p.type);
      object(
        p,
        named ? ["type", p.type, "parameter_name"] : ["type", p.type],
        "Parameter",
      );
      if (p.parameter_name !== undefined)
        string(p.parameter_name, 128, "Parameter name");
      if (p.type === "text") string(p.text, 1024, "Parameter text");
      else if (p.type === "currency") {
        object(
          p.currency,
          ["fallback_value", "code", "amount_1000"],
          "Currency",
        );
        string(p.currency.fallback_value, 1024, "Currency fallback");
        check(
          typeof p.currency.code === "string" && p.currency.code.length === 3,
          "Currency code must have three characters.",
        );
        check(
          Number.isInteger(p.currency.amount_1000),
          "Currency amount_1000 must be an integer.",
        );
      } else if (p.type === "date_time") {
        object(p.date_time, ["fallback_value"], "Date/time");
        string(p.date_time.fallback_value, 1024, "Date/time fallback");
      } else if (["image", "video", "document"].includes(p.type)) {
        object(
          p[p.type],
          p.type === "document" ? ["link", "filename"] : ["link"],
          "Media parameter",
        );
        link(p[p.type].link);
        if (p.type === "document" && p.document.filename !== undefined)
          string(p.document.filename, 240, "Filename");
      } else check(false, "Unsupported template parameter type.");
    }
  }
}
