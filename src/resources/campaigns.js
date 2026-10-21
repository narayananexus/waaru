import { string } from "../validation.js";
import { optionalEnum, pageQuery, pathId, queryBoolean, responseObject, responsePage } from "./helpers.js";

const statuses = ["DRAFT", "SCHEDULED", "QUEUED", "SENDING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"];
const recipientStatuses = ["WAITING_QUOTA", "ADMITTED", "QUEUED", "SEND_UNCERTAIN", "PROVIDER_ACCEPTED", "SENT", "DELIVERED", "READ", "REPLIED", "FAILED", "SKIPPED", "OPTED_OUT"];
const settlements = ["PENDING", "SETTLED_SUCCESS", "SETTLED_FAILURE", "UNCERTAIN"];
const failures = ["MARKETING_LIMIT", "PAIR_RATE_LIMIT", "SENDER_QUALITY", "MARKETING_SUPPRESSED", "WHATSAPP_UNREACHABLE", "PERMANENT_BOUNCE", "TEMPLATE_PAUSED", "SHARED_CONFIGURATION", "TEMPORARY_UNDELIVERED", "EXPIRED_UNDELIVERED"];
function campaignPath(id) {
  string(id, 191, "Campaign ID");
  return `/v1/developer/campaigns/${pathId(id, "Campaign ID")}`;
}

export function createCampaigns(request) {
  return Object.freeze({
    async list(query = {}, options) {
      const built = pageQuery(query, ["status"], "Campaign query");
      optionalEnum(built.status, statuses, "Campaign status");
      return responsePage(await request({ method: "GET", path: "/v1/developer/campaigns", query: built, options, expectedStatus: 200 }), "campaign");
    },
    async get(id, options) {
      return responseObject(await request({ method: "GET", path: campaignPath(id), options, expectedStatus: 200 }), "campaign", "campaign");
    },
    async recipients(id, query = {}, options) {
      const path = `${campaignPath(id)}/recipients`;
      const built = pageQuery(query, ["status", "settlementState", "failureClass", "retargetEligible"], "Campaign recipients query");
      optionalEnum(built.status, recipientStatuses, "Recipient status");
      optionalEnum(built.settlementState, settlements, "Settlement state");
      optionalEnum(built.failureClass, failures, "Failure class");
      queryBoolean(built.retargetEligible, "retargetEligible");
      return responsePage(await request({ method: "GET", path, query: built, options, expectedStatus: 200 }), "campaign recipients");
    },
  });
}
