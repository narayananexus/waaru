import { verifyWebhook } from '@waaru/sdk';

const EVENT_TYPES = new Set([
  'message.received',
  'message.sent',
  'message.delivered',
  'message.read',
  'message.failed',
  'webhook.test',
]);

function header(headers, name) {
  if (headers instanceof Headers) return headers.get(name);
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? undefined : value;
}

/**
 * Authenticate and durably admit one callback.
 * persistAndEnqueue must atomically insert the unique event ID and enqueue work.
 */
export async function receiveWebhook({
  rawBody,
  headers,
  secret,
  expectedInstanceId,
  persistAndEnqueue,
  nowMs = Date.now(),
}) {
  const timestamp = header(headers, 'x-waaru-timestamp');
  const signature = header(headers, 'x-waaru-signature');
  const headerEventId = header(headers, 'x-waaru-event-id');
  if (!verifyWebhook({ rawBody, timestamp, signature, secret, nowMs })) {
    return { status: 400, duplicate: false };
  }

  let event;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return { status: 400, duplicate: false };
  }
  if (
    !event ||
    typeof event !== 'object' ||
    typeof event.id !== 'string' ||
    event.id !== headerEventId ||
    event.apiVersion !== 'v1' ||
    !EVENT_TYPES.has(event.type) ||
    event.instance?.id !== expectedInstanceId ||
    !event.data ||
    typeof event.data !== 'object' ||
    typeof persistAndEnqueue !== 'function'
  ) return { status: 400, duplicate: false };

  const result = await persistAndEnqueue(event);
  if (!result || typeof result.inserted !== 'boolean') {
    throw new TypeError('persistAndEnqueue must return { inserted: boolean }.');
  }
  return { status: 204, duplicate: !result.inserted };
}

export async function readRawBody(request, maxBytes = 256 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > maxBytes) throw new RangeError('Webhook body exceeds the configured limit.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
