import {
  Waaru,
  type Activity,
  type Contact,
  type ContactDetail,
  type Message,
  type Page,
  type Segment,
  type Template,
} from "../src/index.js";

const client = new Waaru({ apiKey: `wak_${"a".repeat(64)}` });

const conversations = client.conversations.list({
  limit: 10,
  after: "opaque",
  contactId: "contact-1",
  q: "+1415",
  updatedSince: "2026-09-29T12:00:00+05:30",
});
const messages: Promise<Page<Message>> = client.conversations.messages(
  "conversation-1",
  { after: "opaque", since: "2026-09-29T12:00:00+05:30", status: "delivered" },
);
const contacts: Promise<Page<Contact & { optedOut: boolean }>> = client.contacts.list({ after: "contact-1" });
const contact: Promise<{ contact: ContactDetail }> = client.contacts.get("contact-1");
client.contacts.upsert({ phoneE164: "+14155552671", firstName: null, customAttributes: { tier: "gold", score: 1, enabled: true, note: null } });
client.contacts.update("contact-1", { email: null });
client.contacts.applyLabel("contact-1", "label-1");
client.contacts.removeLabel("contact-1", "label-1");
client.labels.list({ limit: 50 });
const segments: Promise<Page<Segment>> = client.segments.list();
client.segments.get("segment-1");
client.segments.create({ name: "Fixture", description: null });
client.segments.listMembers("segment-1", { after: "member-1" });
client.segments.addMember("segment-1", "contact-1");
client.segments.removeMember("segment-1", "contact-1");
const templates: Promise<Page<Template>> = client.templates.list({ name: "order_update", language: "en_US" });
client.templates.get("template-1");
const activity: Promise<Activity> = client.reports.activity();
activity.then((report) => {
  const days: 7 = report.retention.days;
  const timezone: "UTC" = report.retention.timezone;
  const operation: string = report.api.operations[0].operation;
  const result: string = report.api.results[0].result;
  const event: string = report.webhook.events[0].event;
  const status: string = report.webhook.statuses[0].status;
  void days;
  void timezone;
  void operation;
  void result;
  void event;
  void status;
});
const media: Promise<Response> = client.media.download("media-1");

void conversations;
void messages;
void contacts;
void contact;
void segments;
void templates;
void media;

// @ts-expect-error phone is immutable in a contact patch
client.contacts.update("contact-1", { phoneE164: "+14155552672" });
// @ts-expect-error consent is never writable through this API
client.contacts.update("contact-1", { consent: true });
// @ts-expect-error custom attributes are bounded scalars, not nested JSON
client.contacts.upsert({ phoneE164: "+14155552671", customAttributes: { nested: { unsafe: true } } });
// @ts-expect-error before and after are mutually exclusive at runtime; callers should select one direction
client.conversations.messages("conversation-1", { before: "a", after: "b", invalidDirectionGuard: true });
