import { check, object, string } from "../validation.js";
import { pageQuery, pathId, responsePage, timestamp, trimmed } from "./helpers.js";

export function createConversations(request) {
  return Object.freeze({
    async list(query = {}, options) {
      const built = pageQuery(query, ["contactId", "q", "updatedSince"], "Conversation query");
      if (built.contactId !== undefined) string(built.contactId, 191, "Contact ID");
      if (built.q !== undefined) trimmed(built.q, 128, "q");
      if (built.updatedSince !== undefined) timestamp(built.updatedSince, "updatedSince");
      return responsePage(await request({ method: "GET", path: "/v1/conversations", query: built, options, expectedStatus: 200 }), "conversation");
    },
    async messages(id, query = {}, options) {
      object(query, ["limit", "before", "after", "since", "direction", "status"], "Message query");
      if (query.limit !== undefined) check(Number.isInteger(query.limit) && query.limit >= 1 && query.limit <= 100, "limit must be an integer from 1 through 100.");
      if (query.before !== undefined) string(query.before, 512, "before cursor");
      if (query.after !== undefined) string(query.after, 512, "after cursor");
      check(query.before === undefined || query.after === undefined, "before and after are mutually exclusive.");
      if (query.since !== undefined) timestamp(query.since, "since");
      if (query.direction !== undefined) check(["inbound", "outbound"].includes(query.direction), "Invalid message direction.");
      if (query.status !== undefined) check(["received", "queued", "sent", "delivered", "read", "failed"].includes(query.status), "Invalid message status.");
      return responsePage(await request({ method: "GET", path: `/v1/conversations/${pathId(id, "Conversation ID")}/messages`, query: { ...query }, options, expectedStatus: 200 }), "message");
    },
  });
}
