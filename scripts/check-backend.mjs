import { readFileSync } from 'node:fs';
import { Waaru, WaaruApiError } from '../src/index.js';

// Release compatibility probe: reads and deliberately rejected writes only.
// No recipient, customer payload, callback target or valid write body is sent.
const manifest = JSON.parse(readFileSync(new URL('../test/fixtures/api-contract-manifest.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const client = new Waaru();
const baseUrl = process.env.WAARU_BASE_URL || 'https://api.waaru.app';
const missingId = '00000000-0000-4000-8000-000000000000';
const results = [];

async function check(operationId, invoke, expectedError) {
  try {
    await invoke();
    if (expectedError) throw new Error('Unexpected success on a rejection probe.');
    results.push({ operationId, result: 'read_ok' });
  } catch (error) {
    if (expectedError && error instanceof WaaruApiError && error.status === expectedError) {
      results.push({ operationId, result: 'expected_rejection', status: error.status, code: error.code });
      return;
    }
    throw new Error(`Compatibility check failed: ${operationId}; ${error instanceof WaaruApiError ? `HTTP ${error.status} ${error.code}` : error.name || 'failure'}.`);
  }
}

async function rejectWrite(operation) {
  const path = operation.path.replace(/\{[^}]+\}/g, missingId);
  const hasBody = operation.method !== 'DELETE' &&
    !(operation.method === 'PUT' && (path.includes('/labels/') || path.includes('/members/')));
  const response = await fetch(new URL(path, baseUrl), {
    method: operation.method,
    headers: {
      Authorization: `Bearer ${process.env.WAARU_API_KEY}`,
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(hasBody ? { body: '{}' } : {}),
    credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  const expectedStatus = /archive$/.test(path) || !hasBody ? 404 : 400;
  const data = await response.json();
  if (response.status !== expectedStatus || typeof data.code !== 'string' || typeof data.message !== 'string') {
    throw new Error(`Compatibility check failed: ${operation.operationId}; unexpected rejection response (HTTP ${response.status}).`);
  }
  results.push({ operationId: operation.operationId, result: 'expected_rejection', status: response.status, code: data.code });
}

try {
  const instance = await client.instance.get();
  if (!instance.apiAvailable || !Array.isArray(instance.scopes) ||
      manifest.operations.some(operation => !instance.scopes.includes(operation.scope))) {
    throw new Error('Use an active API-managed test number and a temporary key with every mapped scope.');
  }
  results.push({ operationId: 'getInstance', result: 'read_ok' });
  const contacts = await client.contacts.list({ limit: 1 });
  results.push({ operationId: 'listContacts', result: 'read_ok' });
  await check('getContact', () => client.contacts.get(contacts.items[0]?.id || missingId), contacts.items.length ? undefined : 404);
  await check('listLabels', () => client.labels.list({ limit: 1 }));
  const segments = await client.segments.list({ limit: 1 });
  results.push({ operationId: 'listSegments', result: 'read_ok' });
  await check('getSegment', () => client.segments.get(segments.items[0]?.id || missingId), segments.items.length ? undefined : 404);
  await check('listMembers', () => client.segments.listMembers(segments.items[0]?.id || missingId, { limit: 1 }), segments.items.length ? undefined : 404);
  const templates = await client.templates.list({ limit: 100 });
  results.push({ operationId: 'listTemplates', result: 'read_ok' });
  // Prefer a local template detail without provider Form discovery.
  const template = templates.items.find(item => !JSON.stringify(item.components).includes('FLOW'));
  await check('getTemplate', () => client.templates.get(template?.id || missingId), template ? undefined : 404);
  const conversations = await client.conversations.list({ limit: 1 });
  results.push({ operationId: 'listConversations', result: 'read_ok' });
  await check('listMessages', () => client.conversations.messages(conversations.items[0]?.id || missingId, { limit: 1 }), conversations.items.length ? undefined : 404);
  await check('getMessage', () => client.messages.get(missingId), 404);
  await check('downloadMedia', () => client.media.download(missingId), 404);
  await check('getActivity', () => client.reports.activity());
  await check('getWebhook', () => client.webhooks.get());
  for (const operation of manifest.operations.filter(operation => operation.method !== 'GET')) await rejectWrite(operation);
  const checked = new Set(results.map(result => result.operationId));
  if (checked.size !== manifest.operations.length || manifest.operations.some(operation => !checked.has(operation.operationId))) {
    throw new Error('The compatibility probe did not cover every mapped operation.');
  }
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), version: pkg.version,
    apiOrigin: new URL(baseUrl).origin, openapiSha256: manifest.openapiSha256,
    operations: results.length, reads: results.filter(result => result.result === 'read_ok').length,
    expectedRejections: results.filter(result => result.result === 'expected_rejection').length,
    liveSends: 0, validWrites: 0, results,
  }, null, 2));
} catch (error) {
  // Never print request/response payloads, credentials, customer IDs or causes.
  console.error(error instanceof WaaruApiError ? `Backend compatibility failed: HTTP ${error.status} ${error.code}.` :
    error.message?.startsWith('Compatibility check failed:') || error.message?.startsWith('Use an active') || error.message?.startsWith('The compatibility probe')
      ? error.message : 'Backend compatibility failed. Check the test key, API origin and service availability.');
  process.exitCode = 1;
}
