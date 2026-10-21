# Developer API coverage

This document describes `1.0.0-beta.5`: 36 Developer API operations and 15 scopes. Install with `npm install @waaru/sdk` or pin `@waaru/sdk@1.0.0-beta.5`; confirm the live distribution tags before upgrading.

Beta.4 maps 32 operations and 14 scopes. Beta.5 adds message-change and campaign reads, template lifecycle options, explicit all-origin webhook observation and revision-checked contact restoration. The bundled [OpenAPI](../openapi/developer-openapi.json) describes the reviewed public interface, including the additive restoration schema. Its SHA-256 is `392dde45672f90c1455c026fd1818964a9e11933a186858131d1dfb3c911d3f7`. CI checks the operation map, schema regressions and installed contract bytes. API authority and provider eligibility are checked again at runtime.

The authenticated beta.3 compatibility probe completed on 2026-10-09: 11 successful reads and 21 expected validation or missing-resource rejections covered all 32 operations. No live messages or valid mutations were submitted. This evidence verifies deployed reads and rejection contracts, not successful resource mutations, media delivery or WhatsApp provider acceptance. Those outcomes still depend on the caller's data, grants and provider eligibility.

## Release verification boundary

Beta.5 retains beta.4's raw filter bounds and credential-shaped diagnostic filtering. Beta.3 lacks those protections. The beta.5 publication gate remains held until fresh 36-operation backend acceptance and the required hosted CI checks pass; historical evidence is not relabeled as a current live check.

SDK tests and packed ESM/CommonJS/TypeScript consumers verify local request mapping, response handling and package contents in hosted CI. These checks do not prove provider delivery, successful restoration or webhook mutation, or media availability. Fresh authenticated reads and expected rejection checks are required separately for release; valid writes and live sends are not part of that probe.

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

## Observation contract

| SDK method | Scope | HTTP operation |
| --- | --- | --- |
| `messages.changes` | `messages:read` | `GET /v1/messages/changes` |
| `campaigns.list` | `campaigns:read` | `GET /v1/developer/campaigns` |
| `campaigns.get` | `campaigns:read` | `GET /v1/developer/campaigns/{id}` |
| `campaigns.recipients` | `campaigns:read` | `GET /v1/developer/campaigns/{id}/recipients` |

These methods require beta.5 and are absent from the published beta.4
artifact. `campaigns:read` requires an explicit authorized key edit; no automatic
scope upgrade or sender override exists. All are GET reads and do not schedule,
send, retarget, change handling mode or claim human ownership. The exact paths,
filters and projections are pinned in the bundled OpenAPI contract. The beta.3
authenticated receipt remains historical 32-operation evidence; it does not
establish deployed support for these additional reads.

`messages.changes({ after, limit }, options)` accepts opaque cursors up to 2048
characters and limit 1 through 100. Bootstrap without `after`, then persist
`resumeCursor` **before** reconciling retained message history. Continue
`nextCursor` even on empty pages, commit each page durably, then save its
`resumeCursor`. Revisions are decimal strings and can exceed JavaScript's safe
integer range; never convert them to numbers. Outbound creation status may be
null. Dedupe by change ID and use current message reads for current status.
`history: "retained_only"` makes no permanent-history or tombstone promise. On
400 `invalid_cursor` or 410 `cursor_expired`, bootstrap and reconcile again.
Every cursor has a seven-day lease, not a seven-day retention guarantee.

Campaign pages use limit 1 through 100 and opaque `after` cursors up to 512
characters. Keep resource/parent/filter identity stable; these are current-state
pages rather than snapshots. `recipients` accepts closed status,
settlementState, failureClass and retargetEligible (boolean or exact true/false
string) filters. Responses expose safe public cohorts and outcomes, not phones,
provider IDs, rendered variables or diagnostics. Foreign/sibling/missing IDs
remain server-rejected; IDs are encoded within a fixed path.

Template list and detail support exact name/language/category plus status/includeUnavailable. Detail accepts
`templates.get(id, { status, includeUnavailable }, options)` while
`templates.get(id, options)` stays compatible. Default inspection is approved
and not provider-missing; lifecycle inspection does not authorize sending.
Types include lifecycle timestamps/reasons and safe message attribution.

Webhook `save` now accepts boolean `observeAllOrigins`. Set it explicitly on
**every save** to retain all-origin observation; omission writes false on the
current server. The SDK does not silently read-modify-write or retry a revision
conflict. Signing credentials and endpoint control remain governed by existing
webhook scopes. This is not an OAuth/MCP client or a grant-management SDK.

All new calls use existing deadlines, safe diagnostics and zero automatic
retries. Return page envelopes unchanged; no unbounded all-pages collector is
added. Real backend/DB/provider/device/browser acceptance remains separate.

## Important behavior

- API keys are server secrets bound to one number. Current observations require an active workspace and live authorized key/number; permitted retained reads work in either handling mode and after disconnection. Sends and workspace mutations still require connected `EXTERNAL_API`; webhook administration requires connected status. `instance.get` diagnoses lifecycle/mode without granting send eligibility. No method accepts a sender/instance override. `apiAvailable` does not imply send scope, quality, consent, service-window or ownership eligibility.
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

Labels are the workspace tags exposed by this API. Creating or renaming a label validates its NFKC-normalized, trimmed, whitespace-collapsed name (1–48 characters) and the 4 KiB JSON body. System labels cannot be renamed or archived. Archiving retains history and reserves the name; active segment dependencies can return `409 resource_in_use`. Static segment updates accept name and/or description; `description: ""` clears it. The SDK translates `description: null` to `""` in create/update to preserve its existing convenience input. Management responses include `archivedAt`; list/get responses retain their established shapes. Label/static-segment restoration and permanent deletion are unavailable through these public operations.

Contact `customAttributes` are partial scalar merges into registered workspace fields, subject to declared types, active definitions and the resulting per-contact limit. Set up definitions in Waaru before syncing. New unknown/archived keys or changed null values for typed fields can return `409 invalid_custom_attributes`; null does not remove an attribute. Basic contact fields such as firstName/email still accept null. Reads expose at most 25 scalar attributes and truncate strings to 500 characters, so never replace a stored record from the read projection.

Beta.5 supports the additive contact-restoration contract. Use `contacts.get(id, { includeArchived: true }, options)` for exact lookup, then `contacts.update(id, { restoreArchived: true, expectedRevision: contact.revision, ...profileFields }, options)`. Exact lookup accepts boolean or exact `"true"`/`"false"` values; lists remain active-only. `contacts.get(id, options)` remains supported. Keep query fields and request options in separate arguments.

`Contact.archivedAt` is a nullable ISO timestamp; `Contact.revision` is a nonnegative archive/restore lifecycle revision, not a profile-edit ETag. Both fields are optional in SDK types because older API servers omit them; the matching restoration API returns both. Check presence before constructing a restore request; never invent a revision or infer active/archive state from an absent field. Explicit true restoration requires the reviewed revision even when a contact is already active. A revision alone or false-only request is not an update; omitted/false restoration retains active-only profile edits. A stale archived revision returns `409 contact_archive_changed`; active restoration is a no-op before revision comparison. Restoration and supplied profile changes are atomic server behavior, not multiple SDK calls. The SDK never retries automatically. Opt-outs, restrictions, history and previously removed segment memberships are not reset; upsert never restores. Current scopes and connected EXTERNAL_API write policy remain enforced by the server.

Beta.4 rejects restoration fields and the archived-lookup option locally before HTTP; it preserves additive response fields but does not declare their types. Use beta.5 or later and a matching deployed API for restoration. Ordinary profile updates and active-only reads keep their existing behavior. Restoration modifies the existing contact PATCH operation; it does not add a new endpoint or scope.

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
