import { WaaruProtocolError } from "../errors.js";
import {
  check,
  mediaLink,
  object,
  recipient,
  resourceId,
  string,
  template,
} from "../validation.js";
import { getResponseRequestId } from "../transport.js";
import { responseObject } from "./helpers.js";

function envelope(body, payloadKey) {
  object(
    body,
    ["messaging_product", "recipient_type", "to", "type", payloadKey],
    "Message",
  );
  check(body.messaging_product === "whatsapp", "messaging_product must be whatsapp.");
  if (body.recipient_type !== undefined) {
    check(body.recipient_type === "individual", "recipient_type must be individual.");
  }
  recipient(body.to);
}

function optionalString(value, max, label) {
  if (value !== undefined) {
    check(
      typeof value === "string" && value.length <= max,
      `${label} must be a string of at most ${max} characters.`,
    );
  }
}

function captionedMedia(value, label, { filename = false } = {}) {
  object(value, filename ? ["link", "caption", "filename"] : ["link", "caption"], label);
  mediaLink(value.link);
  optionalString(value.caption, 1024, `${label} caption`);
  if (filename && value.filename !== undefined) string(value.filename, 240, "Filename");
}

function interactive(value) {
  object(value, ["type", "header", "body", "footer", "action"], "Interactive message");
  check(["button", "list"].includes(value.type), "Unsupported interactive type.");
  if (value.header !== undefined) {
    object(value.header, ["type", "text"], "Interactive header");
    check(value.header.type === "text", "Interactive header type must be text.");
    string(value.header.text, 60, "Interactive header text");
  }
  object(value.body, ["text"], "Interactive body");
  string(value.body.text, 1024, "Interactive body text");
  if (value.footer !== undefined) {
    object(value.footer, ["text"], "Interactive footer");
    string(value.footer.text, 60, "Interactive footer text");
  }
  if (value.type === "button") {
    object(value.action, ["buttons"], "Interactive button action");
    check(
      Array.isArray(value.action.buttons) &&
        value.action.buttons.length >= 1 &&
        value.action.buttons.length <= 3,
      "Interactive buttons must contain 1 to 3 items.",
    );
    for (const button of value.action.buttons) {
      object(button, ["type", "reply"], "Interactive button");
      check(button.type === "reply", "Interactive button type must be reply.");
      object(button.reply, ["id", "title"], "Interactive reply");
      string(button.reply.id, 256, "Interactive reply ID");
      string(button.reply.title, 20, "Interactive reply title");
    }
    return;
  }
  object(value.action, ["button", "sections"], "Interactive list action");
  string(value.action.button, 20, "Interactive list button");
  check(
    Array.isArray(value.action.sections) &&
      value.action.sections.length >= 1 &&
      value.action.sections.length <= 10,
    "Interactive list must contain 1 to 10 sections.",
  );
  let rowCount = 0;
  for (const section of value.action.sections) {
    object(section, ["title", "rows"], "Interactive section");
    optionalString(section.title, 24, "Interactive section title");
    check(
      Array.isArray(section.rows) && section.rows.length >= 1 && section.rows.length <= 10,
      "Interactive section must contain 1 to 10 rows.",
    );
    rowCount += section.rows.length;
    for (const row of section.rows) {
      object(row, ["id", "title", "description"], "Interactive row");
      string(row.id, 200, "Interactive row ID");
      string(row.title, 24, "Interactive row title");
      optionalString(row.description, 72, "Interactive row description");
    }
  }
  check(rowCount <= 10, "Interactive lists support at most 10 rows.");
}

function contactCard(value) {
  object(value, ["name", "phones", "emails", "urls", "org"], "Contact card");
  object(
    value.name,
    ["formatted_name", "first_name", "last_name", "middle_name", "suffix", "prefix"],
    "Contact name",
  );
  string(value.name.formatted_name, 256, "Formatted contact name");
  for (const [field, max] of [
    ["first_name", 128],
    ["last_name", 128],
    ["middle_name", 128],
    ["suffix", 32],
    ["prefix", 32],
  ]) optionalString(value.name[field], max, `Contact ${field}`);
  if (value.phones !== undefined) {
    check(Array.isArray(value.phones) && value.phones.length <= 3, "Contact supports at most 3 phones.");
    for (const phone of value.phones) {
      object(phone, ["phone", "type", "wa_id"], "Contact phone");
      string(phone.phone, 32, "Contact phone");
      optionalString(phone.type, 32, "Contact phone type");
      optionalString(phone.wa_id, 32, "Contact WhatsApp ID");
    }
  }
  if (value.emails !== undefined) {
    check(Array.isArray(value.emails) && value.emails.length <= 3, "Contact supports at most 3 emails.");
    for (const email of value.emails) {
      object(email, ["email", "type"], "Contact email");
      check(
        typeof email.email === "string" &&
          email.email.length <= 320 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.email),
        "Contact email is invalid.",
      );
      optionalString(email.type, 32, "Contact email type");
    }
  }
  if (value.urls !== undefined) {
    check(Array.isArray(value.urls) && value.urls.length <= 3, "Contact supports at most 3 URLs.");
    for (const url of value.urls) {
      object(url, ["url", "type"], "Contact URL");
      mediaLink(url.url);
      optionalString(url.type, 32, "Contact URL type");
    }
  }
  if (value.org !== undefined) {
    object(value.org, ["company", "department", "title"], "Contact organization");
    optionalString(value.org.company, 256, "Contact company");
    optionalString(value.org.department, 256, "Contact department");
    optionalString(value.org.title, 256, "Contact title");
  }
}

function validateSend(body) {
  check(body !== null && typeof body === "object" && !Array.isArray(body), "Message must be an object.");
  check(
    ["text", "template", "image", "video", "audio", "document", "interactive", "location", "contacts"].includes(body.type),
    "Unsupported message type.",
  );
  envelope(body, body.type);
  if (body.type === "text") {
    object(body.text, ["body", "preview_url"], "Text message");
    string(body.text.body, 4096, "Text");
    if (body.text.preview_url !== undefined) check(typeof body.text.preview_url === "boolean", "preview_url must be boolean.");
  } else if (body.type === "template") {
    object(body.template, ["name", "language", "components"], "Template message");
    object(body.template.language, ["code"], "Template language");
    template({
      name: body.template.name,
      language: body.template.language.code,
      ...(body.template.components === undefined ? {} : { components: body.template.components }),
    });
  } else if (body.type === "image" || body.type === "video") {
    captionedMedia(body[body.type], `${body.type} message`);
  } else if (body.type === "audio") {
    object(body.audio, ["link"], "Audio message");
    mediaLink(body.audio.link);
  } else if (body.type === "document") {
    captionedMedia(body.document, "Document message", { filename: true });
  } else if (body.type === "interactive") {
    interactive(body.interactive);
  } else if (body.type === "location") {
    object(body.location, ["latitude", "longitude", "name", "address"], "Location message");
    check(Number.isFinite(body.location.latitude) && Math.abs(body.location.latitude) <= 90, "Latitude is invalid.");
    check(Number.isFinite(body.location.longitude) && Math.abs(body.location.longitude) <= 180, "Longitude is invalid.");
    optionalString(body.location.name, 1000, "Location name");
    optionalString(body.location.address, 1000, "Location address");
  } else {
    check(Array.isArray(body.contacts) && body.contacts.length === 1, "Exactly one contact card is required.");
    contactCard(body.contacts[0]);
  }
}

function acceptedMessage(data) {
  const requestId = getResponseRequestId(data);
  if (
    data?.messaging_product !== "whatsapp" ||
    data?.status !== "queued" ||
    typeof data?.messageId !== "string" ||
    !data.messageId
  ) {
    throw new WaaruProtocolError(
      "Unexpected acceptance response. The send outcome is unknown.",
      true,
      requestId,
    );
  }
  return {
    messaging_product: "whatsapp",
    messageId: data.messageId,
    status: "queued",
    ...(requestId ? { requestId } : {}),
  };
}

export function createMessages(request) {
  const send = async (body, options = {}) => {
    validateSend(body);
    return acceptedMessage(
      await request({
        method: "POST",
        path: "/v1/messages",
        body,
        options,
        expectedStatus: 202,
        idempotencyKey: options.idempotencyKey,
      }),
    );
  };

  const sendText = async (input, options) => {
    object(input, ["to", "text", "previewUrl"], "Text message");
    recipient(input.to);
    string(input.text, 4096, "Text");
    if (input.previewUrl !== undefined) check(typeof input.previewUrl === "boolean", "previewUrl must be boolean.");
    return send(
      {
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: {
          body: input.text,
          ...(input.previewUrl === undefined ? {} : { preview_url: input.previewUrl }),
        },
      },
      options,
    );
  };

  const sendTemplate = async (input, options) => {
    object(input, ["to", "name", "language", "components"], "Template message");
    recipient(input.to);
    template(input);
    return send(
      {
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.name,
          language: { code: input.language },
          ...(input.components === undefined ? {} : { components: input.components }),
        },
      },
      options,
    );
  };

  const get = async (id, options) => {
    resourceId(id, "Message ID");
    const data = await request({
      method: "GET",
      path: `/v1/messages/${encodeURIComponent(id)}`,
      options,
      expectedStatus: 200,
    });
    return responseObject(data, "message", "message");
  };

  return Object.freeze({ send, sendText, sendTemplate, get });
}
