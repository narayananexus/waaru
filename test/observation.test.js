import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Waaru, WaaruValidationError, WaaruProtocolError, WaaruApiError } from '../src/index.js';

const apiKey = `wak_${'a'.repeat(64)}`;
function fixture(response = { items: [], nextCursor: null }) {
  const calls = [];
  const client = new Waaru({ apiKey, fetch: async (url, init) => {
    calls.push({ url: new URL(url), init });
    return Response.json(response, { headers: { 'x-request-id': 'observation-safe' } });
  }});
  return { client, calls };
}

test('message changes preserves bootstrap, empty catch-up cursors and decimal revisions', async () => {
  const page = { items: [], nextCursor: 'next+/=', resumeCursor: 'resume+/=', history: 'retained_only' };
  const { client, calls } = fixture(page);
  assert.deepEqual(await client.messages.changes({ after: 'x'.repeat(2048), limit: 100 }), page);
  assert.equal(calls[0].url.pathname, '/v1/messages/changes');
  assert.equal(calls[0].url.searchParams.get('after').length, 2048);
  const change = { id: 'change-a', revision: '18446744073709551615', messageId: 'message-a', type: 'message.created', status: null, occurredAt: '2026-10-18T00:00:00Z' };
  const f = fixture({ ...page, items: [change], nextCursor: null });
  assert.equal((await f.client.messages.changes()).items[0].revision, change.revision);
  assert.equal((await f.client.messages.changes()).items[0].status, null);
  assert.equal(f.calls[0].url.search, '');
});

test('campaign reads encode exact parent IDs, enums, false booleans and opaque cursors', async () => {
  const { client, calls } = fixture();
  await client.campaigns.list({ status: 'COMPLETED', after: 'opaque+/=', limit: 1 });
  await client.campaigns.recipients('campaign/one', { status: 'SEND_UNCERTAIN', settlementState: 'UNCERTAIN', failureClass: 'PERMANENT_BOUNCE', retargetEligible: false });
  const detail = fixture({ campaign: { id: 'campaign/one', failureCohorts: {}, settlementCohorts: {} } });
  assert.equal((await detail.client.campaigns.get('campaign/one')).campaign.id, 'campaign/one');
  assert.equal(calls[0].url.pathname, '/v1/developer/campaigns');
  assert.equal(calls[0].url.searchParams.get('after'), 'opaque+/=');
  assert.equal(calls[1].url.pathname, '/v1/developer/campaigns/campaign%2Fone/recipients');
  assert.equal(calls[1].url.searchParams.get('retargetEligible'), 'false');
  assert.equal(detail.calls[0].url.pathname, '/v1/developer/campaigns/campaign%2Fone');
  for (const call of [...calls, ...detail.calls]) {
    assert.equal(call.init.method, 'GET'); assert.equal(call.init.body, undefined);
    assert.equal(call.init.redirect, 'error'); assert.equal(call.init.credentials, 'omit');
    assert.equal(call.init.headers.Authorization, `Bearer ${apiKey}`);
  }
});

for (const [name, invoke] of [
  ['change cursor overflow', c => c.messages.changes({ after: 'x'.repeat(2049) })],
  ['change limit', c => c.messages.changes({ limit: 101 })],
  ['change extra filter', c => c.messages.changes({ instanceId: 'foreign' })],
  ['campaign cursor overflow', c => c.campaigns.list({ after: 'x'.repeat(513) })],
  ['campaign status', c => c.campaigns.list({ status: 'UNKNOWN' })],
  ['recipient status', c => c.campaigns.recipients('a', { status: 'UNKNOWN' })],
  ['settlement state', c => c.campaigns.recipients('a', { settlementState: 'UNKNOWN' })],
  ['failure class', c => c.campaigns.recipients('a', { failureClass: 'UNKNOWN' })],
  ['ambiguous boolean', c => c.campaigns.recipients('a', { retargetEligible: 'yes' })],
  ['recipient sender override', c => c.campaigns.recipients('a', { instanceId: 'foreign' })],
  ['parent traversal', c => c.campaigns.recipients('../other')],
]) test(`${name} rejects before transport`, async () => {
  const { client, calls } = fixture();
  await assert.rejects(invoke(client), WaaruValidationError);
  assert.equal(calls.length, 0);
});

test('template lifecycle filters preserve list/detail wire values and legacy get options', async () => {
  const list = fixture();
  await list.client.templates.list({ status: 'PAUSED', category: 'UTILITY', includeUnavailable: true });
  assert.equal(list.calls[0].url.searchParams.get('status'), 'PAUSED');
  assert.equal(list.calls[0].url.searchParams.get('includeUnavailable'), 'true');
  const detail = fixture({ template: { id: 'template-a', status: 'PAUSED', unavailableReason: 'status_paused' } });
  await detail.client.templates.get('template-a', { status: 'PAUSED', includeUnavailable: 'false' }, { requestId: 'detail-correlation' });
  await detail.client.templates.get('template-a', { requestId: 'legacy-correlation', timeoutMs: 1000 });
  assert.equal(detail.calls[0].url.searchParams.get('includeUnavailable'), 'false');
  assert.equal(detail.calls[0].init.headers['x-request-id'], 'detail-correlation');
  assert.equal(detail.calls[1].url.search, '');
  assert.equal(detail.calls[1].init.headers['x-request-id'], 'legacy-correlation');
  for (const query of [{ status: 'UNKNOWN' }, { category: 'UNKNOWN' }, { includeUnavailable: 1 }]) await assert.rejects(list.client.templates.list(query), WaaruValidationError);
  assert.equal(list.calls.length, 1);
});

test('webhook save preserves explicit all-origin selection and rejects non-boolean authority hints', async () => {
  const f = fixture({ webhook: { id: 'webhook-a', revision: 2, state: 'ACTIVE', selectedEvents: ['MESSAGE_RECEIVED'], observeAllOrigins: true } });
  const body = { revision: 1, selectedEvents: ['MESSAGE_RECEIVED'], observeAllOrigins: true };
  assert.equal((await f.client.webhooks.save(body)).webhook.observeAllOrigins, true);
  assert.deepEqual(JSON.parse(f.calls[0].init.body), body);
  await assert.rejects(f.client.webhooks.save({ ...body, observeAllOrigins: 'true' }), WaaruValidationError);
  assert.equal(f.calls.length, 1);
});

test('observation protocol failures retain correlation and never trigger retry', async () => {
  for (const body of [{ items: [], nextCursor: null }, { items: [], nextCursor: null, resumeCursor: 'a', history: 'all' }]) {
    const f = fixture(body);
    await assert.rejects(f.client.messages.changes(), error => error instanceof WaaruProtocolError && error.requestId === 'observation-safe' && !error.outcomeUnknown);
    assert.equal(f.calls.length, 1);
  }
  let calls = 0;
  const client = new Waaru({ apiKey, fetch: async () => { calls++; return Response.json({ code: 'cursor_expired' }, { status: 410 }); } });
  await assert.rejects(client.messages.changes({ after: 'expired' }), e => e instanceof WaaruApiError && e.code === 'cursor_expired' && e.status === 410);
  assert.equal(calls, 1);
});

test('qualified timestamp filters require seconds like the current REST schema', async () => {
  const f = fixture();
  await assert.rejects(f.client.contacts.list({ updatedSince: '2026-10-18T12:00Z' }), WaaruValidationError);
  await f.client.contacts.list({ updatedSince: '2026-10-18T12:00:00+05:30' });
  assert.equal(f.calls.length, 1);
});

test('template detail supports the full cached exact-match filters accepted by REST', async () => {
  const f = fixture({ template: { id: 'template-a' } });
  await f.client.templates.get('template-a', { name: 'order_update', language: 'en', category: 'UTILITY' });
  assert.equal(f.calls[0].url.searchParams.get('name'), 'order_update');
  assert.equal(f.calls[0].url.searchParams.get('language'), 'en');
  assert.equal(f.calls[0].url.searchParams.get('category'), 'UTILITY');
});
