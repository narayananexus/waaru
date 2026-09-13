import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Waaru, WaaruApiError, WaaruConnectionError } from '../src/index.js';

const apiKey = 'wak_' + 'a'.repeat(64);
const input = { to: '+14155552671', text: 'Synthetic fixture' };

test('HTTP failures distinguish uncertain outcomes without retrying', async () => {
  for (const [status, body, expected] of [
    [400, { code: 'invalid_message', message: 'Invalid message' }, false],
    [401, { code: 'invalid_api_key', message: 'Invalid key' }, false],
    [409, { code: 'service_window_closed', message: 'Closed window' }, false],
    [429, { code: 'rate_limited', message: 'Slow down' }, false],
    [408, { code: 'timeout', message: 'Timeout' }, true],
    [500, { code: 'server_error', message: 'Error' }, true],
    [503, { code: 'temporarily_unavailable', message: 'Unavailable' }, true],
    [502, '<html>Gateway failure</html>', true],
    [504, { unexpected: true }, true],
    [400, { code: 'bad_shape' }, true],
  ]) {
    let calls = 0;
    const client = new Waaru({ apiKey, fetch: async () => {
      calls++;
      return typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status });
    }});
    await assert.rejects(client.messages.sendText(input), e => {
      assert.ok(e instanceof WaaruApiError);
      assert.equal(e.status, status);
      assert.equal(e.outcomeUnknown, expected);
      if (expected) assert.match(e.message, /unknown/i);
      assert.equal(calls, 1);
      return true;
    });
  }
});

test('request correlation survives lost response and rejects unsafe response IDs', async () => {
  const client = new Waaru({ apiKey, fetch: async () => { throw Error('private transport data'); } });
  await assert.rejects(client.messages.sendText(input, { requestId: 'support-case-1' }), e => {
    assert.ok(e instanceof WaaruConnectionError);
    assert.equal(e.requestId, 'support-case-1');
    assert.ok(!JSON.stringify(e).includes('private transport data'));
    return true;
  });
  const c = new Waaru({ apiKey, fetch: async () => Response.json(
    { code: 'invalid_message', message: apiKey },
    { status: 400, headers: { 'x-request-id': 'x'.repeat(129) } },
  ) });
  await assert.rejects(c.messages.sendText(input, { requestId: 'safe-local-id' }), e => {
    assert.equal(e.requestId, 'safe-local-id');
    assert.ok(!JSON.stringify(e).includes(apiKey));
    assert.ok(!e.message.includes(apiKey));
    return true;
  });
});

test('pre-dispatch cancellation reports known no-send with caller correlation', async () => {
  const signal = AbortSignal.abort();
  const client = new Waaru({ apiKey, fetch: () => { throw Error('must not dispatch'); } });
  await assert.rejects(client.messages.sendText(input, { signal, requestId: 'cancel-1' }), e => {
    assert.equal(e.outcomeUnknown, false);
    assert.equal(e.requestId, 'cancel-1');
    return true;
  });
});
