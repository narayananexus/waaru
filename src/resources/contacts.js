import { check, object, recipient } from "../validation.js";
import { pageQuery, pathId, responseCheck, responseObject, responsePage, timestamp, trimmed } from "./helpers.js";

const CONTACT_FIELDS = [
  "phoneE164",
  "firstName",
  "lastName",
  "email",
  "countryCode",
  "locale",
  "customAttributes",
];

function nullableField(value, max, label, email = false) {
  if (value === undefined || value === null) return;
  check(typeof value === "string" && value.trim().length <= max, `${label} is invalid.`);
  if (email) check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), "Email is invalid.");
}

function customAttributes(value) {
  if (value === undefined) return;
  check(value !== null && typeof value === "object" && !Array.isArray(value), "customAttributes must be an object.");
  const entries = Object.entries(value);
  check(entries.length <= 1000, "customAttributes supports at most 1000 entries.");
  for (const [key, item] of entries) {
    check(key.length >= 1 && key.length <= 64, "Custom attribute keys must contain 1 to 64 characters.");
    check(
      item === null ||
        typeof item === "boolean" ||
        (typeof item === "number" && Number.isFinite(item)) ||
        (typeof item === "string" && item.length <= 500),
      "Custom attribute values must be bounded scalar values.",
    );
  }
}

function contactBody(body, { patch = false } = {}) {
  object(body, patch ? CONTACT_FIELDS.filter((field) => field !== "phoneE164") : CONTACT_FIELDS, patch ? "Contact patch" : "Contact upsert");
  if (patch) check(Object.keys(body).length > 0, "Contact patch must contain at least one field.");
  else recipient(body.phoneE164);
  nullableField(body.firstName, 80, "First name");
  nullableField(body.lastName, 80, "Last name");
  nullableField(body.email, 255, "Email", true);
  nullableField(body.countryCode, 4, "Country code");
  nullableField(body.locale, 16, "Locale");
  customAttributes(body.customAttributes);
}

function contactResult(data, outcomeUnknown = false) {
  responseObject(data, "contact", "contact", { outcomeUnknown });
  return responseCheck(
    data,
    typeof data.contact.id === "string" && data.contact.id.length > 0,
    "contact",
    { outcomeUnknown },
  );
}

function labelResult(data) {
  responseObject(data, undefined, "label change", { outcomeUnknown: true });
  return responseCheck(
    data,
    typeof data.contactId === "string" &&
      data.contactId.length > 0 &&
      typeof data.labelId === "string" &&
      data.labelId.length > 0 &&
      typeof data.applied === "boolean",
    "label change",
    { outcomeUnknown: true },
  );
}

export function createContactResources(request) {
  const contacts = Object.freeze({
    async list(query = {}, options) {
      const built = pageQuery(query, ["q", "updatedSince"], "Contact query");
      if (built.q !== undefined) trimmed(built.q, 256, "q");
      if (built.updatedSince !== undefined) timestamp(built.updatedSince, "updatedSince");
      return responsePage(await request({ method: "GET", path: "/v1/developer/contacts", query: built, options, expectedStatus: 200 }), "contact");
    },
    async get(id, options) {
      const encoded = pathId(id, "Contact ID");
      return contactResult(await request({ method: "GET", path: `/v1/developer/contacts/${encoded}`, options, expectedStatus: 200 }));
    },
    async upsert(body, options) {
      contactBody(body);
      return contactResult(await request({ method: "POST", path: "/v1/developer/contacts", body, options, expectedStatus: 200 }), true);
    },
    async update(id, body, options) {
      const encoded = pathId(id, "Contact ID");
      contactBody(body, { patch: true });
      return contactResult(await request({ method: "PATCH", path: `/v1/developer/contacts/${encoded}`, body, options, expectedStatus: 200 }), true);
    },
    async applyLabel(id, labelId, options) {
      return labelResult(await request({ method: "PUT", path: `/v1/developer/contacts/${pathId(id, "Contact ID")}/labels/${pathId(labelId, "Label ID")}`, options, expectedStatus: 200 }));
    },
    async removeLabel(id, labelId, options) {
      return labelResult(await request({ method: "DELETE", path: `/v1/developer/contacts/${pathId(id, "Contact ID")}/labels/${pathId(labelId, "Label ID")}`, options, expectedStatus: 200 }));
    },
  });

  const labels = Object.freeze({
    async list(query = {}, options) {
      return responsePage(await request({ method: "GET", path: "/v1/developer/labels", query: pageQuery(query, [], "Label query"), options, expectedStatus: 200 }), "label");
    },
  });

  return { contacts, labels };
}
