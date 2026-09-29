import { pathId } from "./helpers.js";

export function createMedia(request) {
  return Object.freeze({
    async download(id, options) {
      return request({
        method: "GET",
        path: `/v1/media/${pathId(id, "Media ID")}`,
        options,
        expectedStatus: 200,
        binary: true,
      });
    },
  });
}
