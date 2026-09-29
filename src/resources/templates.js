import { pageQuery, pathId, responseObject, responsePage, trimmed } from "./helpers.js";

export function createTemplates(request) {
  return Object.freeze({
    async list(query = {}, options) {
      const built = pageQuery(query, ["name", "language"], "Template query");
      if (built.name !== undefined) trimmed(built.name, 512, "Template name");
      if (built.language !== undefined) trimmed(built.language, 32, "Template language");
      return responsePage(await request({ method: "GET", path: "/v1/developer/templates", query: built, options, expectedStatus: 200 }), "template");
    },
    async get(id, options) {
      return responseObject(await request({ method: "GET", path: `/v1/developer/templates/${pathId(id, "Template ID")}`, options, expectedStatus: 200 }), "template", "template");
    },
  });
}
