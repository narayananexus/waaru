# Troubleshooting Waaru SDK

Use [Waaru documentation](https://www.waaru.app/docs) and the [npm package page](https://www.npmjs.com/package/@waaru/sdk). If documentation is unavailable, use this packaged guide and your existing authenticated Waaru support channel. No support response-time guarantee is implied.

## Before the first send

1. Use Node.js 22.14+ on a server. Load `.env` with `node --env-file=.env your-script.mjs` or your framework. The SDK reads environment variables; it does not load the file itself.
2. Create an instance-bound key with `messages:send`. Each sender needs its own key/client. Never use Meta credentials or a dashboard session token.
3. Confirm the selected sender is connected and in Developer API mode. Switching changes inbound ownership away from Logic Flow and automatic replies; it is not only an API-key switch.
4. Use a consented eligible recipient and an approved template matching the sender's WABA, name and language. Text requires the open customer-service window. Human ownership and safety restrictions can block sends.
5. Check the installed version with `npm ls @waaru/sdk`. Install `@waaru/sdk@beta` for the current prerelease. Idempotency keys, resource methods and webhook verification require beta.3 or later; HTTP `outcomeUnknown` requires beta.2 or later.

## What did the send result mean?

HTTP 202 and `status: queued` mean durable acceptance, not delivery. Save the opaque `messageId`. Use `messages.get(messageId)` with `messages:read`, inspect delivery in Waaru, or receive signed callbacks authenticated with `verifyWebhook`. See the [durable receiver recipe](docs/recipes/webhook-receiver.md).

The SDK never retries automatically. Persist one `idempotencyKey` per logical send before its first attempt. During deliberate reconciliation, reuse the identical body and key; a changed body returns an idempotency conflict. Without a key, repeating a call can create another send. An `x-request-id` is a support correlation label and does not suppress duplicates.

`WaaruApiError.outcomeUnknown` is conservative: true for HTTP 408, every 5xx, and errors without the expected JSON code/message envelope. Some explicit server 503 denials happen before admission, but a generic HTTP response cannot safely prove this in every intermediary failure. Reconcile before another send. False on a structured 4xx denial does not mean the same request will succeed on retry.

`WaaruConnectionError`, `WaaruTimeoutError`, and `WaaruProtocolError` also expose `outcomeUnknown`. Cancellation before dispatch has false; after dispatch it is true. Aborting does not recall a durably accepted message.

## Error-code actions

| Error/code | Action |
| --- | --- |
| `WaaruValidationError` | Fix the local shape, key format, URL, recipient or size. Do not retry unchanged. |
| `invalid_message` | Verify the documented template/text shape; API validation is authoritative. |
| `invalid_api_key`, `unauthorized` | Check environment loading, active key and rotation. Do not send the key to support. |
| `insufficient_scope`, `api_key_not_allowed` | Use a key with the endpoint's declared scope; SDK methods do not override permissions. |
| `idempotency_conflict` | Reconcile the original send. Reuse its original body and key; do not generate a new key to bypass the conflict. |
| `revision_conflict` | Refresh `webhooks.get()`, review the current configuration and deliberately submit against its revision. Never automatically retry secret creation or rotation. |
| `invalid_custom_attributes` | Match active workspace field definitions and types. Custom attributes merge; null does not remove a field. |
| `resource_in_use` | Review active segment dependencies before archiving the label or segment. |
| `template_action_unavailable`, `template_provider_unavailable` | Refresh `templates.get()` and its Form contract. Review provider availability and whether the Form requires an active Logic Flow. |
| `instance_not_api_managed`, `instance_unavailable` | Review the sender's connected state and inbound mode in Waaru. Do not silently switch mode. |
| `conversation_owned_by_human` | Ask an authorized operator to review and release the conversation. |
| `service_window_closed` | Use an eligible approved template, not another free-form attempt. |
| `template_not_found`, `template_not_approved` | Check exact name, language, sender/WABA and approval. |
| `quality_blocked` | Review current phone/template quality. Do not bypass it with another API. |
| `contact_opted_out`, `contact_instance_restricted`, `contact_marketing_restricted`, `message_not_allowed` | Resolve the specific consent or provider-policy issue through the product. No SDK override exists. |
| `rate_limited` | Reduce concurrency; honor `retryAfterSeconds` before deciding whether a new attempt is appropriate. |
| `backlog_full`, `temporarily_unavailable` | Service safety admission is constrained; inspect status, pause submissions, and seek support if persistent. Do not automatically repeat an uncertain send. |
| `http_error`, timeout, non-JSON gateway error | Keep the outcome uncertain, capture safe diagnostics, and reconcile before resending. |

If the hostname does not resolve or documentation returns 404, this is a service/docs availability issue, not evidence that your template was rejected. Do not switch to a guessed staging host or disable TLS. `baseUrl`/`WAARU_BASE_URL` must be an explicit trusted origin approved for your environment.

## Safe support information

Supply SDK version (`npm ls @waaru/sdk`), Node version, UTC occurrence time, SDK method, HTTP status, error code, `outcomeUnknown`, and request ID. An opaque message ID can be shared through authenticated support where needed. Use a synthetic reproduction for public reports.

For correlation even when the response is lost, pass a random non-sensitive ID:

```js
import { randomUUID } from 'node:crypto';
const requestId = randomUUID();
await waaru.messages.sendText({ to, text }, { requestId });
```

The error retains the caller ID if no valid response ID is available. Request-ID values must never contain a phone number, email, API key, or message text. Do not log full error causes, raw requests/responses, environment files, headers, template variables, signing secrets, or customer message content. The SDK intentionally omits raw server error messages.

## Limits and scope

The current API uses technical send limits per key and instance, plus workspace admission limits. Respect the server's response rather than treating these as a guaranteed throughput entitlement. No subscription/paid-user restriction was introduced.

Template recipes illustrate admitted shapes, not pre-approved templates or tested provider delivery. Media links must be public HTTPS on port 443; private storage paths cannot be used as links. Carousel card headers additionally accept supported provider media IDs or workspace-owned asset bindings. Coupon-code buttons and carousel quick-reply payloads are supported; ordinary template quick-reply payload parameters remain outside the admitted subset. See [API coverage](docs/api-coverage.md) for the exact shapes.
