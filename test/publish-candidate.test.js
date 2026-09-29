import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishCandidate, compareVersions } from '../scripts/publish-candidate.mjs';

const pkg = {
  name: '@waaru/sdk', version: '1.0.0-beta.3',
  publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/' },
};
const policy = { version: pkg.version, ready: true };
const metadata = { versions: { '1.0.0-beta.2': {} }, 'dist-tags': { beta: '1.0.0-beta.2', latest: '1.0.0-beta.2' } };
const fetch = async () => Response.json(metadata);

test('publishes a reviewed new version to its own channel', async () => {
  assert.deepEqual(await publishCandidate({ pkg, policy, fetch }), {
    publish: true, reason: 'Verified new release candidate.', version: pkg.version, tag: 'beta',
  });
  const stable = { ...pkg, version: '1.0.0' };
  assert.equal((await publishCandidate({ pkg: stable, policy: { ...policy, version: stable.version }, fetch })).tag, 'latest');
});

test('disabled or stale release approval never reaches the registry', async () => {
  for (const value of [{ ...policy, ready: false }, { ...policy, version: '1.0.0-beta.2' }, undefined]) {
    let calls = 0;
    const result = await publishCandidate({ pkg, policy: value, fetch: async () => { calls += 1; throw new Error('must not call'); } });
    assert.equal(result.publish, false);
    assert.equal(calls, 0);
  }
});

test('an already-published version is skipped without changing distribution tags', async () => {
  const result = await publishCandidate({ pkg, policy, fetch: async () => Response.json({ ...metadata, versions: { [pkg.version]: {} } }) });
  assert.equal(result.publish, false);
  assert.equal(result.reason, 'Version is already published.');
});

test('registry errors and tag downgrades fail closed', async () => {
  await assert.rejects(publishCandidate({ pkg, policy, fetch: async () => new Response('', { status: 503 }) }), /Registry inspection failed/);
  await assert.rejects(publishCandidate({ pkg, policy, fetch: async () => { throw new Error('network'); } }), /network/);
  await assert.rejects(publishCandidate({ pkg, policy, fetch: async () => Response.json({}) }), /invalid package metadata/);
  await assert.rejects(publishCandidate({ pkg, policy, fetch: async () => Response.json({ ...metadata, 'dist-tags': { beta: '1.0.0-beta.10' } }) }), /backwards/);
});

test('release tag and package identity must match', async () => {
  await assert.rejects(publishCandidate({ pkg, policy, refName: 'v9.9.9', fetch }), /does not match/);
  await assert.rejects(publishCandidate({ pkg: { ...pkg, name: 'other' }, policy, fetch }), /Unexpected package/);
  await assert.rejects(publishCandidate({ pkg: { ...pkg, version: '1.0.0-beta.03' }, policy, fetch }), /Unsupported package/);
});

test('semver comparison handles numeric prereleases and stable releases', () => {
  assert.equal(compareVersions('1.0.0-beta.10', '1.0.0-beta.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0-beta.10'), 1);
  assert.equal(compareVersions('1.0.0-beta.3', '1.0.0-beta.3'), 0);
  assert.equal(compareVersions('1.0.0-beta.3', '1.0.1-beta.1'), -1);
});
