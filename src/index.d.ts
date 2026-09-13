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
  | { type: "document"; document: { link: string; filename?: string } };
export interface TemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url" | "copy_code";
  index?: string;
  parameters: TemplateParameter[];
}
export interface TextMessage {
  to: string;
  text: string;
  previewUrl?: boolean;
}
export interface TemplateMessage {
  to: string;
  name: string;
  language: string;
  components?: TemplateComponent[];
}
export class Waaru {
  constructor(options?: WaaruOptions);
  readonly messages: {
    sendText(
      input: TextMessage,
      options?: RequestOptions,
    ): Promise<AcceptedMessage>;
    sendTemplate(
      input: TemplateMessage,
      options?: RequestOptions,
    ): Promise<AcceptedMessage>;
  };
}
export class WaaruError extends Error {}
export class WaaruValidationError extends WaaruError {}
export class WaaruApiError extends WaaruError {
  constructor(status: number, code: string, requestId?: string, retryAfterSeconds?: number, outcomeUnknown?: boolean);
  status: number;
  code: string;
  requestId?: string;
  retryAfterSeconds?: number;
  /** True means acceptance could not be ruled out. Never automatically resend. */
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
