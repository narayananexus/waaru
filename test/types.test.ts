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
  const queued: number = report.messages.daily[0].pending;
  const stopped: number = report.webhook.outcomes[0].stopped;
  void queued; void stopped;
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

client.instance.get().then(value => { const available: boolean = value.apiAvailable; void available; });
client.labels.create({ name: 'Priority' }).then(value => { const date: string | null = value.label.archivedAt; void date; });
client.labels.update('label-1', { name: 'Renamed' });
client.labels.archive('label-1');
client.segments.update('segment-1', { description: null });
client.segments.archive('segment-1');
client.templates.get('template-1').then(value => { const hash: string | undefined = value.template.flowLaunch?.contractHash; void hash; });
client.messages.sendTemplate({
  to: '+14155552671', name: 'form', language: 'en_US',
  templateFlowLaunch: { buttonIndex: 0, contractHash: 'a'.repeat(64), inputs: { ready: true, choices: ['A'] } },
  components: [{ type: 'header', parameters: [{ type: 'location', location: { latitude: '12.5', longitude: 30 } }] }],
});
client.messages.sendTemplate({
  to: '+14155552671', name: 'carousel', language: 'en_US',
  components: [{ type: 'carousel', cards: [0, 1].map(card_index => ({ card_index, components: [{ type: 'header', parameters: [{ type: 'product', product: { catalog_id: 'catalog', product_retailer_id: 'sku' } }] }] })) }],
  media_assets: [{ card_index: 0, asset_id: '123e4567-e89b-42d3-a456-426614174000' }],
});
// @ts-expect-error managed launch values exclude null and nested objects
client.messages.sendTemplate({ to: '+14155552671', name: 'form', language: 'en_US', templateFlowLaunch: { buttonIndex: 0, contractHash: 'a', inputs: { nested: {} } } });
// @ts-expect-error a key cannot select another sending instance
client.instance.get({ instanceId: 'foreign' });
// @ts-expect-error new resource methods do not administer grants
client.labels.create({ name: 'A', scopes: ['workspace:labels:manage'] });
