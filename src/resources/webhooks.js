import { isIP } from "node:net";
import { check, object, string } from "../validation.js";
import { responseCheck, responseObject } from "./helpers.js";

const EVENTS = [
  "MESSAGE_RECEIVED",
  "MESSAGE_SENT",
  "MESSAGE_DELIVERED",
  "MESSAGE_READ",
  "MESSAGE_FAILED",
];

function revision(value, { nullable = false } = {}) {
  check(
    (nullable && value === null) || (Number.isInteger(value) && value > 0),
    nullable ? "revision must be null or a positive integer." : "revision must be a positive integer.",
  );
}

function callbackUrl(value) {
  string(value, 2048, "callbackUrl");
  let url;
  try {
    url = new URL(value);
  } catch {
    check(false, "callbackUrl must be a public HTTPS URL.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  check(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      isIP(host) === 0 &&
      host !== "localhost" &&
      !host.endsWith(".localhost") &&
      !host.endsWith(".local"),
    "callbackUrl must be a public HTTPS URL on port 443 without credentials, query or fragment.",
  );
}

function webhookWrite(body) {
  object(body, ["revision", "callbackUrl", "selectedEvents"], "Webhook configuration");
  revision(body.revision, { nullable: true });
  check(
    Array.isArray(body.selectedEvents) &&
      body.selectedEvents.length >= 1 &&
      body.selectedEvents.length <= 5 &&
      new Set(body.selectedEvents).size === body.selectedEvents.length &&
      body.selectedEvents.every((event) => EVENTS.includes(event)),
    "selectedEvents must contain 1 to 5 unique uppercase webhook events.",
  );
  if (body.revision === null) check(body.callbackUrl !== undefined, "callbackUrl is required when creating a webhook.");
  if (body.callbackUrl !== undefined) callbackUrl(body.callbackUrl);
}

function positiveRevision(value) {
  return Number.isInteger(value) && value > 0;
}

function webhookSaveResult(data, creating) {
  responseObject(data, "webhook", "webhook", { outcomeUnknown: true });
  return responseCheck(
    data,
    typeof data.webhook.id === "string" &&
      data.webhook.id.length > 0 &&
      positiveRevision(data.webhook.revision) &&
      typeof data.webhook.state === "string" &&
      Array.isArray(data.webhook.selectedEvents) &&
      (!creating || (typeof data.signingSecret === "string" && data.signingSecret.length > 0)),
    "webhook",
    { outcomeUnknown: true },
  );
}

export function createWebhooks(request) {
  return Object.freeze({
    async get(options) {
      const data = await request({ method: "GET", path: "/v1/webhook", options, expectedStatus: 200 });
      return responseCheck(
        data,
        data !== null && typeof data === "object" &&
          (data.webhook === null || (data.webhook !== null && typeof data.webhook === "object")),
        "webhook",
      );
    },
    async save(body, options) {
      webhookWrite(body);
      return webhookSaveResult(await request({ method: "PUT", path: "/v1/webhook", body, options, expectedStatus: 200 }), body.revision === null);
    },
    async rotate(value, options) {
      revision(value);
      const data = await request({ method: "POST", path: "/v1/webhook/rotate", body: { revision: value }, options, expectedStatus: 200 });
      responseObject(data, undefined, "webhook rotation", { outcomeUnknown: true });
      return responseCheck(
        data,
        typeof data.signingSecret === "string" &&
          data.signingSecret.length > 0 &&
          positiveRevision(data.revision) &&
          typeof data.previousSecretExpiresAt === "string",
        "webhook rotation",
        { outcomeUnknown: true },
      );
    },
    async test(value, options) {
      revision(value);
      const data = await request({ method: "POST", path: "/v1/webhook/test", body: { revision: value }, options, expectedStatus: 200 });
      responseObject(data, undefined, "webhook test", { outcomeUnknown: true });
      return responseCheck(data, data.delivered === true && typeof data.eventId === "string" && data.eventId.length > 0, "webhook test", { outcomeUnknown: true });
    },
    async setState(value, state, options) {
      revision(value);
      check(["ACTIVE", "DISABLED"].includes(state), "state must be ACTIVE or DISABLED.");
      const data = await request({ method: "POST", path: "/v1/webhook/state", body: { revision: value, state }, options, expectedStatus: 200 });
      responseObject(data, undefined, "webhook state", { outcomeUnknown: true });
      return responseCheck(data, positiveRevision(data.revision) && data.state === state, "webhook state", { outcomeUnknown: true });
    },
  });
}
