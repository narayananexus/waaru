export interface WaaruOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  requestId?: string;
}

export interface SendRequestOptions extends RequestOptions {
  /** Persist per logical send and reuse with the identical body during reconciliation. */
  idempotencyKey?: string;
}

export interface AcceptedMessage {
  messaging_product: "whatsapp";
  messageId: string;
  status: "queued";
  requestId?: string;
}

export type TemplateParameter =
  | { type: "text"; text: string; parameter_name?: string }
  | {
      type: "currency";
      currency: { fallback_value: string; code: string; amount_1000: number };
      parameter_name?: string;
    }
  | {
      type: "date_time";
      date_time: { fallback_value: string };
      parameter_name?: string;
    }
  | { type: "image"; image: { link: string } }
  | { type: "video"; video: { link: string } }
  | { type: "document"; document: { link: string; filename?: string } }
  | { type: "location"; location: { latitude: number | string; longitude: number | string; name?: string; address?: string } }
  | { type: "limited_time_offer"; limited_time_offer: { expiration_time_ms: number } }
  | { type: "coupon_code"; coupon_code: string }
  | { type: "action"; action: { flow_token: string } };

export interface TemplateComponent {
  type: "header" | "body" | "button" | "limited_time_offer";
  sub_type?: "quick_reply" | "url" | "copy_code" | "flow";
  index?: string;
  parameters: TemplateParameter[];
}

export type CarouselBodyParameter = Extract<TemplateParameter, { type: "text" | "currency" | "date_time" }>;
export type CarouselHeaderParameter =
  | { type: "image"; image: { link: string } | { id: string } }
  | { type: "video"; video: { link: string } | { id: string } }
  | { type: "product"; product: { catalog_id: string; product_retailer_id: string } };
export type CarouselCardComponent =
  | { type: "header"; parameters: [CarouselHeaderParameter] }
  | { type: "body"; parameters: CarouselBodyParameter[] }
  | { type: "button"; sub_type: "url"; index: 0 | 1 | "0" | "1"; parameters: [{ type: "text"; text: string }] }
  | { type: "button"; sub_type: "quick_reply"; index: 0 | 1 | "0" | "1"; parameters: [{ type: "payload"; payload: string }] };
export interface CarouselComponent {
  type: "carousel";
  cards: Array<{ card_index: number; components: CarouselCardComponent[] }>;
}
export interface CarouselMediaBinding { card_index: number; asset_id: string }
export type TemplateSendComponent = TemplateComponent | CarouselComponent;
export type FlowLaunchValue = string | number | boolean | string[];
export interface TemplateFlowLaunchRequest {
  buttonIndex: number;
  contractHash: string;
  inputs?: Record<string, FlowLaunchValue>;
}
export interface TemplateFlowLaunch {
  buttonIndex: number;
  contractHash: string;
  providerFlowId: string;
  hosting: "WAARU" | "EXTERNAL";
  action: "navigate" | "data_exchange";
  screen?: string;
  inputs: Array<{ name: string; type: "string" | "number" | "boolean" | "string_array"; required: boolean; default?: FlowLaunchValue }>;
  requiresActiveLogicFlow: boolean;
  unavailableReason?: string;
}

interface SendEnvelope {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string;
}

export interface TextSendMessage extends SendEnvelope {
  type: "text";
  text: { body: string; preview_url?: boolean };
}

export interface TemplateSendMessage extends SendEnvelope {
  type: "template";
  templateFlowLaunch?: TemplateFlowLaunchRequest;
  template: {
    name: string;
    language: { code: string };
    components?: TemplateSendComponent[];
    media_assets?: CarouselMediaBinding[];
  };
}

export interface ImageSendMessage extends SendEnvelope {
  type: "image";
  image: { link: string; caption?: string };
}

export interface VideoSendMessage extends SendEnvelope {
  type: "video";
  video: { link: string; caption?: string };
}

export interface AudioSendMessage extends SendEnvelope {
  type: "audio";
  audio: { link: string };
}

export interface DocumentSendMessage extends SendEnvelope {
  type: "document";
  document: { link: string; caption?: string; filename?: string };
}

export interface InteractiveButton {
  type: "button";
  header?: { type: "text"; text: string };
  body: { text: string };
  footer?: { text: string };
  action: {
    buttons: Array<{
      type: "reply";
      reply: { id: string; title: string };
    }>;
  };
}

export interface InteractiveList {
  type: "list";
  header?: { type: "text"; text: string };
  body: { text: string };
  footer?: { text: string };
  action: {
    button: string;
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  };
}

export interface InteractiveSendMessage extends SendEnvelope {
  type: "interactive";
  interactive: InteractiveButton | InteractiveList;
}

export interface LocationSendMessage extends SendEnvelope {
  type: "location";
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

export interface ContactCard {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    suffix?: string;
    prefix?: string;
  };
  phones?: Array<{ phone: string; type?: string; wa_id?: string }>;
  emails?: Array<{ email: string; type?: string }>;
  urls?: Array<{ url: string; type?: string }>;
  org?: { company?: string; department?: string; title?: string };
}

export interface ContactsSendMessage extends SendEnvelope {
  type: "contacts";
  contacts: [ContactCard];
}

export type SendMessage =
  | TextSendMessage
  | TemplateSendMessage
  | ImageSendMessage
  | VideoSendMessage
  | AudioSendMessage
  | DocumentSendMessage
  | InteractiveSendMessage
  | LocationSendMessage
  | ContactsSendMessage;

export interface Message {
  id: string;
  conversationId: string;
  contactId: string;
  direction: "inbound" | "outbound";
  status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  type: string;
  occurredAt: string;
  text?: Record<string, unknown>;
  template?: Record<string, unknown>;
  image?: Record<string, unknown>;
  video?: Record<string, unknown>;
  audio?: Record<string, unknown>;
  document?: Record<string, unknown>;
  media?: Record<string, unknown>;
  interactive?: Record<string, unknown>;
  location?: Record<string, unknown>;
  contacts?: Array<Record<string, unknown>>;
  failureCode?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageQuery {
  limit?: number;
  after?: string;
}

export interface ConversationQuery extends PageQuery {
  contactId?: string;
  q?: string;
  updatedSince?: string;
}

export interface MessageQuery {
  limit?: number;
  before?: string;
  after?: string;
  since?: string;
  direction?: "inbound" | "outbound";
  status?: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
}

export interface Conversation {
  id: string;
  contactId: string;
  phoneNumber: string;
  contactName: string | null;
  lastMessageAt: string;
  humanOwned: boolean;
  lastMessage: Message | null;
}

export type CustomAttributeValue = string | number | boolean | null;

export interface Contact {
  id: string;
  phoneE164: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  countryCode: string | null;
  locale: string | null;
  customAttributes: Record<string, CustomAttributeValue>;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRead extends Contact {
  optedOut: boolean;
}

export interface ContactDetail extends ContactRead {
  labelIds: string[];
}

export interface ContactQuery extends PageQuery {
  q?: string;
  updatedSince?: string;
}

export interface ContactUpsert {
  phoneE164: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  countryCode?: string | null;
  locale?: string | null;
  customAttributes?: Record<string, CustomAttributeValue>;
}

export type ContactPatch = Omit<ContactUpsert, "phoneE164">;

export interface Label {
  id: string;
  name: string;
}

export interface LabelInput { name: string }
export interface LabelManaged extends Label { archivedAt: string | null }
export interface SegmentPatch { name?: string; description?: string | null }
export interface SegmentManaged extends Segment { archivedAt: string | null }
export type DeveloperApiScope =
  | "messages:send" | "messages:read" | "media:read"
  | "workspace:contacts:read" | "workspace:contacts:write"
  | "workspace:segments:read" | "workspace:segments:write" | "workspace:segments:manage"
  | "workspace:labels:manage" | "templates:read" | "webhooks:read" | "webhooks:manage"
  | "reports:read" | "instance:read";
export interface InstanceCapabilities {
  instance: { id: string; status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "UNAUTHORIZED"; inboundHandlerMode: string };
  scopes: DeveloperApiScope[];
  /** Connected + EXTERNAL_API; does not guarantee permission or send eligibility. */
  apiAvailable: boolean;
}

export interface LabelChange {
  contactId: string;
  labelId: string;
  applied: boolean;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  updatedAt: string;
}

export interface SegmentCreate {
  name: string;
  description?: string | null;
}

export interface Member {
  id: string;
  contactId: string;
  addedAt: string;
}

export interface MembershipChange {
  segmentId: string;
  contactId: string;
  changed: boolean;
  memberCount: number;
}

export interface TemplateQuery extends PageQuery {
  name?: string;
  language?: string;
}

export interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  parameterFormat: string;
  components: Array<Record<string, unknown>>;
  status: "APPROVED";
  quality: string | null;
  statusSyncedAt: string | null;
  qualitySyncedAt: string | null;
}

export interface TemplateDetail extends Template { flowLaunch?: TemplateFlowLaunch }

export interface Activity {
  retention: {
    days: 7;
    timezone: "UTC";
    dates: string[];
    startsAt: string;
    endsAt: string;
  };
  api: {
    totalCalls: number;
    daily: Array<{ date: string; count: number }>;
    operations: Array<{
      operation:
        | "SEND_MESSAGE"
        | "GET_MESSAGE"
        | "LIST_CONVERSATIONS"
        | "LIST_CONVERSATION_MESSAGES"
        | "GET_MEDIA"
        | "LEGACY_API_KEY";
      count: number;
    }>;
    results: Array<{
      result: "SUCCESS" | "CLIENT_ERROR" | "RATE_LIMITED" | "SERVER_ERROR";
      count: number;
    }>;
  };
  webhook: {
    deliveryCount: number;
    attemptCount: number;
    daily: Array<{ date: string; count: number }>;
    events: Array<{ event: WebhookConfigurationEvent; count: number }>;
    statuses: Array<{
      status: "PENDING" | "CLAIMED" | "DELIVERED" | "TERMINAL";
      count: number;
    }>;
    recentDeliveries: Array<{
      eventType: WebhookConfigurationEvent;
      status: "PENDING" | "CLAIMED" | "DELIVERED" | "TERMINAL";
      attempts: number;
      responseStatus: number | null;
      lastErrorCode:
        | "terminal_response"
        | "endpoint_paused"
        | "delivery_expired"
        | "retryable_response"
        | "media_ingest_expired"
        | null;
      createdAt: string;
      deliveredAt: string | null;
      terminalAt: string | null;
    }>;
  };
}

export type WebhookConfigurationEvent =
  | "MESSAGE_RECEIVED"
  | "MESSAGE_SENT"
  | "MESSAGE_DELIVERED"
  | "MESSAGE_READ"
  | "MESSAGE_FAILED";

export type WebhookEndpointState = "ACTIVE" | "DEGRADED" | "PAUSED" | "DISABLED";

export interface WebhookDelivery {
  id: string;
  eventType: string;
  status: "PENDING" | "CLAIMED" | "DELIVERED" | "TERMINAL";
  attempts: number;
  responseStatus: number | null;
  lastErrorCode: string | null;
  deliveredAt: string | null;
  terminalAt: string | null;
  createdAt: string;
}

export interface WebhookSummary {
  id: string;
  revision: number;
  state: WebhookEndpointState;
  selectedEvents: WebhookConfigurationEvent[];
}

export interface WebhookDetail extends WebhookSummary {
  callbackUrl: string;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  deliveries: WebhookDelivery[];
}

export interface WebhookWrite {
  revision: number | null;
  callbackUrl?: string;
  selectedEvents: WebhookConfigurationEvent[];
}

export interface VerifyWebhookInput {
  rawBody: Uint8Array;
  timestamp: string;
  signature: string;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}

/** Authenticates exact bytes and freshness. It does not deduplicate events. */
export function verifyWebhook(input: VerifyWebhookInput): boolean;

export interface TextMessage {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface TemplateMessage {
  to: string;
  name: string;
  language: string;
  components?: TemplateSendComponent[];
  media_assets?: CarouselMediaBinding[];
  templateFlowLaunch?: TemplateFlowLaunchRequest;
}

export class Waaru {
  constructor(options?: WaaruOptions);
  readonly messages: {
    send(body: SendMessage, options?: SendRequestOptions): Promise<AcceptedMessage>;
    sendText(input: TextMessage, options?: SendRequestOptions): Promise<AcceptedMessage>;
    sendTemplate(input: TemplateMessage, options?: SendRequestOptions): Promise<AcceptedMessage>;
    get(id: string, options?: RequestOptions): Promise<{ message: Message }>;
  };
  readonly conversations: {
    list(query?: ConversationQuery, options?: RequestOptions): Promise<Page<Conversation>>;
    messages(id: string, query?: MessageQuery, options?: RequestOptions): Promise<Page<Message>>;
  };
  readonly media: {
    download(id: string, options?: RequestOptions): Promise<Response>;
  };
  readonly contacts: {
    list(query?: ContactQuery, options?: RequestOptions): Promise<Page<ContactRead>>;
    get(id: string, options?: RequestOptions): Promise<{ contact: ContactDetail }>;
    upsert(body: ContactUpsert, options?: RequestOptions): Promise<{ contact: Contact }>;
    update(id: string, body: ContactPatch, options?: RequestOptions): Promise<{ contact: Contact }>;
    applyLabel(id: string, labelId: string, options?: RequestOptions): Promise<LabelChange>;
    removeLabel(id: string, labelId: string, options?: RequestOptions): Promise<LabelChange>;
  };
  readonly instance: { get(options?: RequestOptions): Promise<InstanceCapabilities> };
  readonly labels: {
    list(query?: PageQuery, options?: RequestOptions): Promise<Page<Label>>;
    create(body: LabelInput, options?: RequestOptions): Promise<{ label: LabelManaged }>;
    update(id: string, body: LabelInput, options?: RequestOptions): Promise<{ label: LabelManaged }>;
    archive(id: string, options?: RequestOptions): Promise<{ label: LabelManaged }>;
  };
  readonly segments: {
    list(query?: PageQuery, options?: RequestOptions): Promise<Page<Segment>>;
    get(id: string, options?: RequestOptions): Promise<{ segment: Segment }>;
    create(body: SegmentCreate, options?: RequestOptions): Promise<{ segment: Segment }>;
    update(id: string, body: SegmentPatch, options?: RequestOptions): Promise<{ segment: SegmentManaged }>;
    archive(id: string, options?: RequestOptions): Promise<{ segment: SegmentManaged }>;
    listMembers(id: string, query?: PageQuery, options?: RequestOptions): Promise<Page<Member>>;
    addMember(id: string, contactId: string, options?: RequestOptions): Promise<MembershipChange>;
    removeMember(id: string, contactId: string, options?: RequestOptions): Promise<MembershipChange>;
  };
  readonly templates: {
    list(query?: TemplateQuery, options?: RequestOptions): Promise<Page<Template>>;
    get(id: string, options?: RequestOptions): Promise<{ template: TemplateDetail }>;
  };
  readonly reports: {
    activity(options?: RequestOptions): Promise<Activity>;
  };
  readonly webhooks: {
    get(options?: RequestOptions): Promise<{ webhook: WebhookDetail | null }>;
    save(
      body: WebhookWrite,
      options?: RequestOptions,
    ): Promise<{ webhook: WebhookSummary; signingSecret?: string }>;
    rotate(
      revision: number,
      options?: RequestOptions,
    ): Promise<{ signingSecret: string; revision: number; previousSecretExpiresAt: string }>;
    test(revision: number, options?: RequestOptions): Promise<{ delivered: true; eventId: string }>;
    setState(
      revision: number,
      state: "ACTIVE" | "DISABLED",
      options?: RequestOptions,
    ): Promise<{ revision: number; state: "ACTIVE" | "DISABLED" }>;
  };
}

export class WaaruError extends Error {}
export class WaaruValidationError extends WaaruError {}
export class WaaruApiError extends WaaruError {
  constructor(
    status: number,
    code: string,
    requestId?: string,
    retryAfterSeconds?: number,
    outcomeUnknown?: boolean,
  );
  status: number;
  code: string;
  requestId?: string;
  retryAfterSeconds?: number;
  /** True means a write may have been admitted. Reconcile before retrying. */
  outcomeUnknown: boolean;
}
export class WaaruConnectionError extends WaaruError {
  constructor(message?: string, outcomeUnknown?: boolean, requestId?: string);
  outcomeUnknown: boolean;
  requestId?: string;
}
export class WaaruTimeoutError extends WaaruConnectionError {}
export class WaaruProtocolError extends WaaruConnectionError {}
export default Waaru;
