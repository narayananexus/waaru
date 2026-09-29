import { createTransport } from "./transport.js";
import { createMessages } from "./resources/messages.js";
import { createContactResources } from "./resources/contacts.js";
import { createSegments } from "./resources/segments.js";
import { createTemplates } from "./resources/templates.js";
import { createConversations } from "./resources/conversations.js";
import { createMedia } from "./resources/media.js";
import { createReports } from "./resources/reports.js";
import { createWebhooks } from "./resources/webhooks.js";

export * from "./errors.js";
export { verifyWebhook } from "./webhook-verification.js";

export class Waaru {
  constructor(options = {}) {
    const transport = createTransport(options);
    this.messages = createMessages(transport.request);
    this.conversations = createConversations(transport.request);
    this.media = createMedia(transport.request);
    const contactResources = createContactResources(transport.request);
    this.contacts = contactResources.contacts;
    this.labels = contactResources.labels;
    this.segments = createSegments(transport.request);
    this.templates = createTemplates(transport.request);
    this.reports = createReports(transport.request);
    this.webhooks = createWebhooks(transport.request);
  }
}

export default Waaru;
