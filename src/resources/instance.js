import { responseObject, responseCheck } from "./helpers.js";

export function createInstance(request) {
  return Object.freeze({
    async get(options) {
      const data = await request({ method: "GET", path: "/v1/developer/instance", options, expectedStatus: 200 });
      responseObject(data, "instance", "instance capabilities");
      return responseCheck(data,
        typeof data.instance.id === "string" && data.instance.id.length > 0 &&
        typeof data.instance.status === "string" &&
        typeof data.instance.inboundHandlerMode === "string" &&
        Array.isArray(data.scopes) && data.scopes.every((scope) => typeof scope === "string") &&
        typeof data.apiAvailable === "boolean",
        "instance capabilities");
    },
  });
}
