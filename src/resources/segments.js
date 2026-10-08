import { check, object } from "../validation.js";
import { managedResult, smallBody, pageQuery, pathId, responseCheck, responseObject, responsePage, trimmed } from "./helpers.js";

function segmentResult(data, outcomeUnknown = false) {
  responseObject(data, "segment", "segment", { outcomeUnknown });
  return responseCheck(
    data,
    typeof data.segment.id === "string" && data.segment.id.length > 0,
    "segment",
    { outcomeUnknown },
  );
}

function membershipResult(data) {
  responseObject(data, undefined, "membership change", { outcomeUnknown: true });
  return responseCheck(
    data,
    typeof data.segmentId === "string" &&
      data.segmentId.length > 0 &&
      typeof data.contactId === "string" &&
      data.contactId.length > 0 &&
      typeof data.changed === "boolean" &&
      Number.isInteger(data.memberCount) &&
      data.memberCount >= 0,
    "membership change",
    { outcomeUnknown: true },
  );
}

export function createSegments(request) {
  return Object.freeze({
    async list(query = {}, options) {
      return responsePage(await request({ method: "GET", path: "/v1/developer/segments", query: pageQuery(query, [], "Segment query"), options, expectedStatus: 200 }), "segment");
    },
    async get(id, options) {
      return segmentResult(await request({ method: "GET", path: `/v1/developer/segments/${pathId(id, "Segment ID")}`, options, expectedStatus: 200 }));
    },
    async create(body, options) {
      object(body, ["name", "description"], "Segment create");
      trimmed(body.name, 80, "Segment name");
      segmentDescription(body.description);
      const wire = body.description === null ? { ...body, description: "" } : body;
      smallBody(wire);
      return segmentResult(await request({ method: "POST", path: "/v1/developer/segments", body: wire, options, expectedStatus: 200 }), true);
    },
    async update(id, body, options) {
      const encoded = pathId(id, "Segment ID");
      object(body, ["name", "description"], "Segment patch");
      check(body.name !== undefined || body.description !== undefined, "Segment patch must contain at least one field.");
      if (body.name !== undefined) trimmed(body.name, 80, "Segment name");
      segmentDescription(body.description);
      const wire = body.description === null ? { ...body, description: "" } : body;
      smallBody(wire);
      return managedResult(await request({ method: "PATCH", path: `/v1/developer/segments/${encoded}`, body: wire, options, expectedStatus: 200 }), "segment");
    },
    async archive(id, options) {
      return managedResult(await request({ method: "POST", path: `/v1/developer/segments/${pathId(id, "Segment ID")}/archive`, body: {}, options, expectedStatus: 200 }), "segment");
    },
    async listMembers(id, query = {}, options) {
      return responsePage(await request({ method: "GET", path: `/v1/developer/segments/${pathId(id, "Segment ID")}/members`, query: pageQuery(query, [], "Member query"), options, expectedStatus: 200 }), "member");
    },
    async addMember(id, contactId, options) {
      return membershipResult(await request({ method: "PUT", path: `/v1/developer/segments/${pathId(id, "Segment ID")}/members/${pathId(contactId, "Contact ID")}`, options, expectedStatus: 200 }));
    },
    async removeMember(id, contactId, options) {
      return membershipResult(await request({ method: "DELETE", path: `/v1/developer/segments/${pathId(id, "Segment ID")}/members/${pathId(contactId, "Contact ID")}`, options, expectedStatus: 200 }));
    },
  });
}

function segmentDescription(value) {
  if (value === undefined || value === null) return;
  check(typeof value === "string" && value.trim().length <= 200, "Segment description must contain at most 200 characters.");
}
