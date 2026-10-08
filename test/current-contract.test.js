import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Waaru, WaaruValidationError, WaaruProtocolError, WaaruApiError } from '../src/index.js';
const apiKey = `wak_${'a'.repeat(64)}`;
function mock(data, status = 200) {
  const calls = [];
  const client = new Waaru({ apiKey, fetch: async (...args) => {
    calls.push(args); return Response.json(data, { status, headers: { 'x-request-id': 'current-contract' } });
  }});
  return { client, calls };
}
const label = { id: 'label-1', name: 'Priority', archivedAt: null };
const segment = { id: 'segment-1', name: 'Audience', description: null, memberCount: 0, updatedAt: '2026-10-08T00:00:00Z', archivedAt: null };
test('all six current operations use fixed paths, wire bodies and managed envelopes', async () => {
  const cases = [
    ['GET', '/v1/developer/instance', undefined, { instance: { id: 'number-1', status: 'DISCONNECTED', inboundHandlerMode: 'WAARU_LOGIC_FLOW' }, scopes: ['instance:read'], apiAvailable: false }, c => c.instance.get()],
    ['POST', '/v1/developer/labels', { name: 'Priority' }, { label }, c => c.labels.create({ name: 'Priority' })],
    ['PATCH', '/v1/developer/labels/label%20one', { name: 'Priority' }, { label }, c => c.labels.update('label one', { name: 'Priority' })],
    ['POST', '/v1/developer/labels/label-1/archive', {}, { label: { ...label, archivedAt: '2026-10-08T00:00:00Z' } }, c => c.labels.archive('label-1')],
    ['PATCH', '/v1/developer/segments/segment-1', { description: '' }, { segment }, c => c.segments.update('segment-1', { description: null })],
    ['POST', '/v1/developer/segments/segment-1/archive', {}, { segment: { ...segment, archivedAt: '2026-10-08T00:00:00Z' } }, c => c.segments.archive('segment-1')],
  ];
  for (const [method, path, body, response, invoke] of cases) {
    const { client, calls } = mock(response);
    assert.deepEqual(await invoke(client), response);
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0][0]).pathname, path);
    assert.equal(calls[0][1].method, method);
    assert.deepEqual(calls[0][1].body === undefined ? undefined : JSON.parse(calls[0][1].body), body);
    assert.equal(calls[0][1].headers.Authorization, `Bearer ${apiKey}`);
  }
});
test('resource normalization, empty descriptions and 4 KiB body bounds', async () => {
  const { client, calls } = mock({ label });
  await client.labels.create({ name: ' '.repeat(60) + 'Ｐｒｉｏｒｉｔｙ' });
  for (const value of [{ name: ' '.repeat(4096) + 'A' }, { name: 'x'.repeat(49) }, { name: ' ' }, { name: 'A', color: 'red' }])
    await assert.rejects(client.labels.create(value), WaaruValidationError);
  assert.equal(calls.length, 1);
  const m = mock({ segment });
  await m.client.segments.create({ name: 'Audience', description: null });
  assert.equal(JSON.parse(m.calls[0][1].body).description, '');
  await m.client.segments.update('segment-1', { description: '' });
  for (const body of [{}, { name: undefined }, { description: 1 }, { description: 'x'.repeat(201) }, { type: 'DYNAMIC' }])
    await assert.rejects(m.client.segments.update('segment-1', body), WaaruValidationError);
});
test('managed writes preserve unknown outcome and request correlation, errors never retry', async () => {
  for (const invoke of [c => c.labels.create({ name: 'A' }), c => c.labels.archive('a'), c => c.segments.update('a', { name: 'A' }), c => c.segments.archive('a')]) {
    const { client, calls } = mock({});
    await assert.rejects(invoke(client), e => e instanceof WaaruProtocolError && e.outcomeUnknown && e.requestId === 'current-contract');
    assert.equal(calls.length, 1);
  }
  for (const code of ['resource_in_use', 'label_not_found', 'instance_unavailable', 'insufficient_scope']) {
    const { client, calls } = mock({ code, message: 'Fixture' }, 409);
    await assert.rejects(client.labels.archive('a'), e => e instanceof WaaruApiError && e.code === code);
    assert.equal(calls.length, 1);
  }
});
const accepted = { messaging_product: 'whatsapp', status: 'queued', messageId: 'm1' };
const base = { to: '+14155552671', name: 'fixture', language: 'en_US' };
const flow = { buttonIndex: 0, contractHash: 'a'.repeat(64), inputs: { name: 'Ada', count: 1, ready: true, choices: ['A'] } };
const carousel = { type: 'carousel', cards: [0, 1].map(card_index => ({ card_index, components: [
  { type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn.example/card.jpg' } }] },
  { type: 'body', parameters: [{ type: 'text', text: 'Ada', parameter_name: 'name' }] },
  { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'select' }] },
]})) };
test('current template inputs retain wire placement through convenience and raw sends', async () => {
  const { client, calls } = mock(accepted, 202);
  const components = [
    { type: 'header', parameters: [{ type: 'location', location: { latitude: '12.5', longitude: 30, name: 'Store' } }] },
    { type: 'limited_time_offer', parameters: [{ type: 'limited_time_offer', limited_time_offer: { expiration_time_ms: 1900000000000 } }] },
    { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: 'SAVE' }] },
    { type: 'button', sub_type: 'flow', index: '1', parameters: [{ type: 'action', action: { flow_token: 'external_token' } }] },
  ];
  await client.messages.sendTemplate({ ...base, components, templateFlowLaunch: flow });
  assert.deepEqual(JSON.parse(calls[0][1].body), { messaging_product: 'whatsapp', to: base.to, type: 'template', templateFlowLaunch: flow, template: { name: base.name, language: { code: base.language }, components } });
  const bindings = [{ card_index: 0, asset_id: '123e4567-e89b-42d3-a456-426614174000' }];
  await client.messages.sendTemplate({ ...base, components: [carousel], media_assets: bindings });
  assert.deepEqual(JSON.parse(calls[1][1].body).template.media_assets, bindings);
  await client.messages.send({ messaging_product: 'whatsapp', to: base.to, type: 'template', template: { name: base.name, language: { code: base.language }, components: [carousel] } });
  assert.equal(calls.length, 3);
});
test('rejects invalid launch metadata and provider/private overrides before dispatch', async () => {
  const { client, calls } = mock(accepted, 202);
  for (const templateFlowLaunch of [
    { ...flow, contractHash: 'wrong' }, { ...flow, buttonIndex: 10 },
    { ...flow, inputs: { flow_token: 'override' } }, { ...flow, inputs: { prototype: 'override' } },
    { ...flow, inputs: { nested: {} } }, { ...flow, inputs: { value: null } },
    { ...flow, inputs: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`key${i}`, 'x'])) },
    { ...flow, inputs: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`key${i}`, 'x'.repeat(4096)])) },
    { ...flow, instanceId: 'foreign' },
  ]) await assert.rejects(client.messages.sendTemplate({ ...base, templateFlowLaunch }), WaaruValidationError);
  for (const components of [
    [{ type: 'button', sub_type: 'flow', parameters: [{ type: 'action', action: { flow_token: 'wfl1_' + 'a'.repeat(43) } }] }],
    [{ ...carousel, cards: [carousel.cards[0]] }],
    [{ ...carousel, cards: [{ ...carousel.cards[0], card_index: 10 }, carousel.cards[1]] }],
    [{ type: 'header', parameters: [{ type: 'location', location: { latitude: 'NaN', longitude: 0 } }] }],
    [{ type: 'limited_time_offer', parameters: [{ type: 'limited_time_offer', limited_time_offer: { expiration_time_ms: 0 } }] }],
    [{ type: 'button', parameters: [{ type: 'coupon_code', coupon_code: 'x'.repeat(21) }] }],
  ]) await assert.rejects(client.messages.sendTemplate({ ...base, components }), WaaruValidationError);
  await assert.rejects(client.messages.sendTemplate({ ...base, media_assets: [{ card_index: 0, asset_id: 'bad' }] }), WaaruValidationError);
  assert.equal(calls.length, 0);
});
