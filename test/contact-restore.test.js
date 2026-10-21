import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Waaru, WaaruValidationError, WaaruApiError } from '../src/index.js';

function fixture(response = { contact: { id: 'contact/a', archivedAt: null, revision: 8 } }, status = 200) {
  const calls = [];
  const client = new Waaru({ apiKey: `wak_${'a'.repeat(64)}`, fetch: async (url, init) => {
    calls.push({ url: new URL(url), init });
    return Response.json(response, { status });
  }});
  return { client, calls };
}

test('contact restore transmits explicit revision and profile in a single PATCH', async () => {
  const { client, calls } = fixture();
  const body = { restoreArchived: true, expectedRevision: 7, firstName: 'Ada', email: null };
  const result = await client.contacts.update('contact/a', body, { requestId: 'restore-correlation' });
  assert.equal(result.contact.archivedAt, null);
  assert.equal(result.contact.revision, 8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/v1/developer/contacts/contact%2Fa');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].init.body), body);
  assert.equal(calls[0].init.headers['x-request-id'], 'restore-correlation');
});

test('restore-only zero revision and explicit false profile patches are transmitted unchanged', async () => {
  const { client, calls } = fixture();
  for (const body of [{ restoreArchived: true, expectedRevision: 0 }, { firstName: null, restoreArchived: false, expectedRevision: 7 }]) {
    await client.contacts.update('contact/a', body);
    assert.deepEqual(JSON.parse(calls.at(-1).init.body), body);
  }
});

test('exact archived lookup accepts only exact booleans and preserves request options', async () => {
  const archivedAt = '2026-10-19T00:00:00.000Z';
  const { client, calls } = fixture({ contact: { id: 'contact/a', archivedAt, revision: 7, optedOut: true, labelIds: [] } });
  for (const includeArchived of [true, false, 'true', 'false']) {
    const result = await client.contacts.get('contact/a', { includeArchived }, { requestId: 'lookup-correlation', timeoutMs: 1000 });
    assert.equal(result.contact.archivedAt, archivedAt);
    assert.equal(result.contact.revision, 7);
    assert.equal(result.contact.optedOut, true);
    assert.equal(calls.at(-1).url.searchParams.get('includeArchived'), String(includeArchived));
    assert.equal(calls.at(-1).init.headers['x-request-id'], 'lookup-correlation');
    assert.equal(calls.at(-1).init.method, 'GET');
    assert.equal(calls.at(-1).init.body, undefined);
  }
});

test('legacy get options and active-only list retain their wire contract and response extensions', async () => {
  const old = fixture();
  const controller = new AbortController();
  await old.client.contacts.get('contact/a', { timeoutMs: 1000, signal: controller.signal, requestId: 'legacy-contact' });
  await old.client.contacts.get('contact/a');
  await old.client.contacts.get('contact/a', {}, { requestId: 'empty-query' });
  await old.client.contacts.update('contact/a', { email: null });
  assert.equal(old.calls[0].url.search, '');
  assert.equal(old.calls[0].init.headers['x-request-id'], 'legacy-contact');
  assert.equal(old.calls[1].url.search, '');
  assert.equal(old.calls[2].init.headers['x-request-id'], 'empty-query');
  assert.deepEqual(JSON.parse(old.calls[3].init.body), { email: null });
  const page = fixture({ items: [{ id: 'contact/a', archivedAt: null, revision: 8 }], nextCursor: null });
  assert.equal((await page.client.contacts.list()).items[0].revision, 8);
  await assert.rejects(page.client.contacts.list({ includeArchived: true }), WaaruValidationError);
  assert.equal(page.calls.length, 1);
});

for (const [name, body] of [
  ['missing revision', { restoreArchived: true }],
  ['negative revision', { restoreArchived: true, expectedRevision: -1 }],
  ['fraction revision', { restoreArchived: true, expectedRevision: 1.5 }],
  ['unsafe revision', { restoreArchived: true, expectedRevision: Number.MAX_SAFE_INTEGER + 1 }],
  ['string revision', { restoreArchived: true, expectedRevision: '7' }],
  ['string restore', { restoreArchived: 'true', expectedRevision: 7, firstName: 'Ada' }],
  ['revision-only', { expectedRevision: 7 }],
  ['false-only', { restoreArchived: false, expectedRevision: 7 }],
  ['consent override', { restoreArchived: true, expectedRevision: 7, optedOut: false }],
  ['raw deletion', { restoreArchived: true, expectedRevision: 7, deletedAt: null }],
]) test(`contact restore rejects ${name} before transport`, async () => {
  const { client, calls } = fixture();
  await assert.rejects(client.contacts.update('contact/a', body), WaaruValidationError);
  assert.equal(calls.length, 0);
});

for (const includeArchived of ['yes', 1, null]) test(`contact lookup rejects ambiguous ${JSON.stringify(includeArchived)} before transport`, async () => {
  const { client, calls } = fixture();
  await assert.rejects(client.contacts.get('contact/a', { includeArchived }), WaaruValidationError);
  assert.equal(calls.length, 0);
});

test('restore options cannot leak into upsert or request options and no retry follows a conflict', async () => {
  const { client, calls } = fixture({ error: { code: 'contact_archive_changed', message: 'Review revision' } }, 409);
  await assert.rejects(client.contacts.upsert({ phoneE164: '+14155552671', restoreArchived: true, expectedRevision: 7 }), WaaruValidationError);
  await assert.rejects(client.contacts.get('contact/a', { includeArchived: true, timeoutMs: 1000 }), WaaruValidationError);
  assert.equal(calls.length, 0);
  await assert.rejects(client.contacts.update('contact/a', { restoreArchived: true, expectedRevision: 7 }), error => error instanceof WaaruApiError && error.status === 409);
  assert.equal(calls.length, 1);
});

test('older API responses remain valid without invented archive state or revision', async () => {
  const { client } = fixture({ contact: { id: 'contact/a', firstName: 'Ada' } });
  const result = await client.contacts.get('contact/a');
  assert.equal(Object.hasOwn(result.contact, 'archivedAt'), false);
  assert.equal(Object.hasOwn(result.contact, 'revision'), false);
});
