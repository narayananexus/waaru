import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Waaru } from '../src/index.js';

test('documented template recipes map to valid one-recipient wire requests', async () => {
  const file = new URL('../examples/template-recipes.mjs', import.meta.url);
  assert.ok(existsSync(file), 'runnable template recipes must exist');
  const { sendRecipe } = await import(file);
  for (const [recipe, componentType] of [
    ['no-variables', undefined], ['positional', 'body'], ['named', 'body'],
    ['image-header', 'header'], ['document-header', 'header'], ['url-button', 'button'],
  ]) {
    const calls = [];
    const client = new Waaru({ apiKey: 'wak_' + 'a'.repeat(64), fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return Response.json({ messaging_product: 'whatsapp', messageId: 'example-id', status: 'queued' }, { status: 202 });
    }});
    const result = await sendRecipe(client, recipe, {
      to: '+14155552671', name: 'approved_fixture', language: 'en_US',
      value: 'Ada', parameterName: 'customer', mediaUrl: 'https://example.com/file',
    });
    assert.equal(result.messageId, 'example-id');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.waaru.app/v1/messages');
    assert.equal(calls[0].body.type, 'template');
    assert.equal(calls[0].body.to, '+14155552671');
    assert.equal(calls[0].body.template.components?.[0]?.type, componentType);
    if (recipe === 'named') assert.equal(calls[0].body.template.components[0].parameters[0].parameter_name, 'customer');
    if (recipe === 'url-button') assert.equal(calls[0].body.template.components[0].sub_type, 'url');
  }
  await assert.rejects(sendRecipe({}, 'unsupported', {}), /Unknown recipe/);
});
