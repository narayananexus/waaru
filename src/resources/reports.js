import { responseObject } from "./helpers.js";

export function createReports(request) {
  return Object.freeze({
    async activity(options) {
      return responseObject(await request({ method: "GET", path: "/v1/developer/reports/activity", options, expectedStatus: 200 }), undefined, "activity");
    },
  });
}
