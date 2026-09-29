# Developer API coverage

This document describes the expansion candidate in this source branch. The public npm `latest` package remains `1.0.0-beta.2` until a separately approved release. Source support is not proof that the corresponding API version is deployed.

The candidate maps 26 Developer API operations against a pinned OpenAPI contract. The fixture checksum records the reviewed public interface without exposing private repository identifiers or planning documents. Publication requires backend verification and integration checks for the supported API release.

| SDK method | Scope | HTTP operation |
| --- | --- | --- |
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

- API keys are server secrets and bind one connected `EXTERNAL_API` number. No method accepts a sender/instance override.
- Workspace contact/label/segment scopes intentionally cover the workspace, not only the bound number.
- The SDK performs zero automatic retries. Persist one `idempotencyKey` before a logical send and reuse the identical body/key during deliberate reconciliation.
- `requestId` is correlation only. It does not suppress duplicates.
- A 202/replay is queued acceptance, not delivery. Use `messages.get` or authenticated callbacks for current status.
- Resource pages use `after`. Conversation history uses `before`; incremental message reads use `after` and optionally `since`. `since` filters message occurrence time, so it will not surface a later status change for an older message; use authenticated callbacks or `messages.get` for status reconciliation. No unbounded all-pages collector is provided.
- Contact read attributes are a bounded scalar projection and are unsuitable for lossless backup or replacement writes.
- Webhook mutations use optimistic revisions. Never automatically retry creation or secret rotation: a lost one-time secret response requires explicit reconciliation and one deliberate rotation.
- Media returns a streaming `Response`. Consume or cancel its body before the request deadline.
- Errors expose safe status/code/request correlation only. `outcomeUnknown` on a failed write requires reconciliation before retrying.
