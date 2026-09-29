# Durable webhook receiver

Use [`examples/receive-webhook.mjs`](../../examples/receive-webhook.mjs) after capturing the exact request bytes. Do not parse or reserialize JSON before verification.

Your application supplies `persistAndEnqueue(event)`. It must use durable storage to atomically:

1. insert the authenticated event ID under a unique constraint;
2. enqueue the business work in the same transaction/outbox boundary;
3. return `{ inserted: true }`, or `{ inserted: false }` for an already admitted event.

Only then return 2xx. Return 5xx when durable admission fails so Waaru can retry. A process-local `Set`, cache or freshness check is not durable duplicate protection.

```js
// Copy the reviewed example into your application and keep durable storage injected.
import { receiveWebhook, readRawBody } from './receive-webhook.mjs';

const rawBody = await readRawBody(request);
try {
  const result = await receiveWebhook({
    rawBody,
    headers: request.headers,
    secret: process.env.WAARU_WEBHOOK_SECRET,
    expectedInstanceId: process.env.WAARU_INSTANCE_ID,
    persistAndEnqueue: repository.admitWebhookEvent,
  });
  response.writeHead(result.status).end();
} catch {
  response.writeHead(503).end();
}
```

The helper verifies timestamp freshness and the HMAC over `timestamp + "." + exact raw bytes`, then validates the API version, lowercase event type, authenticated header/body event-ID equality and expected instance. Signature verification does not prove the business instance by itself and does not deduplicate callbacks. During secret rotation, application code may call `verifyWebhook` against each currently trusted secret; keep the 300-second freshness bound.
