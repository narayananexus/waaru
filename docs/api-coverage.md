# Developer API coverage

This document describes the SDK surface introduced in `1.0.0-beta.3`. Use `npm install @waaru/sdk@beta` to select the newest prerelease. Earlier package versions do not expose the expanded methods below.

The SDK maps 32 Developer API operations and 14 scopes against a pinned OpenAPI contract. The fixture checksum records the reviewed public interface. Every release requires backend compatibility checks as well as SDK and package-consumer CI; API access and provider eligibility are checked again at runtime.

| SDK method | Scope | HTTP operation |
| --- | --- | --- |
| `instance.get` | `instance:read` | `GET /v1/developer/instance` |
| `labels.create` | `workspace:labels:manage` | `POST /v1/developer/labels` |
| `labels.update` | `workspace:labels:manage` | `PATCH /v1/developer/labels/{id}` |
| `labels.archive` | `workspace:labels:manage` | `POST /v1/developer/labels/{id}/archive` |
| `segments.update` | `workspace:segments:manage` | `PATCH /v1/developer/segments/{id}` |
| `segments.archive` | `workspace:segments:manage` | `POST /v1/developer/segments/{id}/archive` |
| `messages.send` | `messages:send` | `POST /v1/messages` (202) |
| `messages.get` | `messages:read` | `GET /v1/messages/{messageId}` |
| `conversations.list` | `messages:read` | `GET /v1/conversations` |
| `conversations.messages` | `messages:read` | `GET /v1/conversations/{conversationId}/messages` |
| `media.download` | `media:read` | `GET /v1/media/{id}` |
| `contacts.list` | `workspace:contacts:read` | `GET /v1/developer/contacts` |
| `contacts.get` | `workspace:contacts:read` | `GET /v1/developer/contacts/{id}` |
| `contacts.upsert` | `workspace:contacts:write` | `POST /v1/developer/contacts` |
| `contacts.update` | `workspace:contacts:write` | `PATCH /v1/developer/contacts/{id}` |
| `labels.list` | `workspace:contacts:read` | `GET /v1/developer/labels` |
| `contacts.applyLabel` | `workspace:contacts:write` | `PUT /v1/developer/contacts/{id}/labels/{labelId}` |
| `contacts.removeLabel` | `workspace:contacts:write` | `DELETE /v1/developer/contacts/{id}/labels/{labelId}` |
| `segments.list` | `workspace:segments:read` | `GET /v1/developer/segments` |
| `segments.get` | `workspace:segments:read` | `GET /v1/developer/segments/{id}` |
| `segments.create` | `workspace:segments:write` | `POST /v1/developer/segments` |
| `segments.listMembers` | `workspace:segments:read` | `GET /v1/developer/segments/{id}/members` |
| `segments.addMember` | `workspace:segments:write` | `PUT /v1/developer/segments/{id}/members/{contactId}` |
| `segments.removeMember` | `workspace:segments:write` | `DELETE /v1/developer/segments/{id}/members/{contactId}` |
| `templates.list` | `templates:read` | `GET /v1/developer/templates` |
| `templates.get` | `templates:read` | `GET /v1/developer/templates/{id}` |
| `reports.activity` | `reports:read` | `GET /v1/developer/reports/activity` |
| `webhooks.get` | `webhooks:read` | `GET /v1/webhook` |
| `webhooks.save` | `webhooks:manage` | `PUT /v1/webhook` |
| `webhooks.rotate` | `webhooks:manage` | `POST /v1/webhook/rotate` |
| `webhooks.test` | `webhooks:manage` | `POST /v1/webhook/test` |
| `webhooks.setState` | `webhooks:manage` | `POST /v1/webhook/state` |

`messages.sendText` and `messages.sendTemplate` are convenience adapters over `messages.send`; they are not additional API operations. `verifyWebhook` is local cryptographic verification and does not make an HTTP request.

## Important behavior

- API keys are server secrets bound to one number. Operations require an active workspace and connected `EXTERNAL_API` number, except `instance.get`, which also diagnoses disconnected or non-API-managed numbers. No method accepts a sender/instance override. `apiAvailable` does not imply send scope, quality, consent, service-window or ownership eligibility.
- Workspace contact/label/segment scopes intentionally cover the workspace, not only the bound number.
- The SDK performs zero automatic retries. Persist one `idempotencyKey` before a logical send and reuse the identical body/key during deliberate reconciliation.
- `requestId` is correlation only. It does not suppress duplicates.
- A 202/replay is queued acceptance, not delivery. Use `messages.get` or authenticated callbacks for current status.
- Resource pages use `after`. Conversation history uses `before`; incremental message reads use `after` and optionally `since`. `since` filters message occurrence time, so it will not surface a later status change for an older message; use authenticated callbacks or `messages.get` for status reconciliation. No unbounded all-pages collector is provided.
- Contact read attributes are a bounded scalar projection and are unsuitable for lossless backup or replacement writes.
- Webhook mutations use optimistic revisions. Never automatically retry creation or secret rotation: a lost one-time secret response requires explicit reconciliation and one deliberate rotation.
- Media returns a streaming `Response`. Consume or cancel its body before the request deadline.
- Errors expose safe status/code/request correlation only. `outcomeUnknown` on a failed write requires reconciliation before retrying.

## Resource requirements

Existing keys do not gain new scopes automatically. Ask an authorized workspace administrator to grant the required scopes in Settings; the SDK cannot create keys, elevate grants or switch inbound mode. Every request rechecks current authority. Reads share key/number/workspace budgets, and writes have separate shared limits; 429 and fail-closed 503 responses expose retry guidance without triggering SDK retries.

Labels are the workspace tags exposed by this API. Creating or renaming a label validates its NFKC-normalized, trimmed, whitespace-collapsed name (1–48 characters) and the 4 KiB JSON body. System labels cannot be renamed or archived. Archiving retains history and reserves the name; active segment dependencies can return `409 resource_in_use`. Static segment updates accept name and/or description; `description: ""` clears it. The SDK translates `description: null` to `""` in create/update to preserve its existing convenience input. Management responses include `archivedAt`; list/get responses retain their established shapes. Restoration and permanent deletion are unavailable through these public operations.

Contact `customAttributes` are partial scalar merges into registered workspace fields, subject to declared types, active definitions and the resulting per-contact limit. Set up definitions in Waaru before syncing. New unknown/archived keys or changed null values for typed fields can return `409 invalid_custom_attributes`; null does not remove an attribute. Basic contact fields such as firstName/email still accept null. Reads expose at most 25 scalar attributes and truncate strings to 500 characters, so never replace a stored record from the read projection.

CSV imports, catalog administration, custom-attribute removal, dynamic segments, key management, inbound-mode changes and broadcast scheduling are not API-key SDK endpoints. Use the dashboard's governed import for CSVs; a server sync can deliberately call `contacts.upsert` per record and handle failures individually, with no implicit batch/retry semantics. OAuth `/external/v1` integrations and reviewed OAuth MCP tools have separate credentials, grants and contracts.

## Current template capabilities

`messages.sendTemplate` and raw `messages.send` support managed Form launches, carousel media/product cards, location headers, limited-time offers and coupon codes. `templates.get` exposes optional typed `flowLaunch` metadata. Submit its exact `buttonIndex` and `contractHash` with declared inputs via root `templateFlowLaunch`; the server assigns managed tokens. A stale contract or a Form requiring an awaited Logic Flow fails closed. External Flow tokens use an `action` parameter and cannot use the reserved `wfl1_` prefix.

Carousel `media_assets` bindings belong inside `template` on raw sends and use workspace-owned asset UUIDs per card; they do not upload media or override ownership. Card header media accepts a public HTTPS link or provider ID; product cards require the bound WABA's catalog/product eligibility. Template definition, parameter slots, rendered-size limits, ownership, quality and future offer expiration are server-validated. Read component definitions contain no upload examples/handles.

```js
const { template } = await waaru.templates.get('template-id');
const launch = template.flowLaunch;
if (!launch || launch.requiresActiveLogicFlow) throw new Error('Choose an API-launchable Form');
await waaru.messages.sendTemplate({
  to: '+14155552671', name: template.name, language: template.language,
  templateFlowLaunch: {
    buttonIndex: launch.buttonIndex, contractHash: launch.contractHash,
    inputs: { customer_name: 'Ada' }, // match this Form's declared inputs
  },
}, { idempotencyKey: 'form:ORDER-123' });
```
