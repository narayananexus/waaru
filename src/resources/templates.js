import { object } from "../validation.js";
import { optionalEnum, pageQuery, pathId, queryBoolean, responseObject, responsePage, trimmed } from "./helpers.js";

const statuses = ["PENDING", "APPROVED", "REJECTED", "PAUSED", "DISABLED"];
function lifecycle(query) {
  if (query.name !== undefined) trimmed(query.name, 512, "Template name");
  if (query.language !== undefined) trimmed(query.language, 32, "Template language");
  optionalEnum(query.category, ["AUTHENTICATION", "MARKETING", "UTILITY"], "Template category");
  optionalEnum(query.status, statuses, "Template status");
  queryBoolean(query.includeUnavailable, "includeUnavailable");
}

export function createTemplates(request) {
  return Object.freeze({
    async list(query = {}, options) {
      const built = pageQuery(query, ["name", "language", "category", "status", "includeUnavailable"], "Template query");
      lifecycle(built);
      return responsePage(await request({ method: "GET", path: "/v1/developer/templates", query: built, options, expectedStatus: 200 }), "template");
    },
    async get(id, queryOrOptions = {}, options) {
      const hasQuery = options !== undefined || (queryOrOptions !== null && typeof queryOrOptions === "object" && ["name", "language", "category", "status", "includeUnavailable"].some(key => Object.hasOwn(queryOrOptions, key)));
      const query = hasQuery ? queryOrOptions : {};
      object(query, ["name", "language", "category", "status", "includeUnavailable"], "Template detail query");
      lifecycle(query);
      return responseObject(await request({ method: "GET", path: `/v1/developer/templates/${pathId(id, "Template ID")}`, query, options: hasQuery ? options : queryOrOptions, expectedStatus: 200 }), "template", "template");
    },
  });
}
