import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('CI verifies supported Node versions and exposes one stable required check', () => {
  const workflow = read('.github/workflows/ci.yml');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  for (const version of ['22.14.0', '24.x', '26.x']) assert.ok(workflow.includes(version));
  assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.match(workflow, /npm run verify/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /name: Required CI/);
});

test('workflows use immutable official actions and least privilege', () => {
  for (const path of ['.github/workflows/ci.yml', '.github/workflows/publish.yml']) {
    const workflow = read(path);
    const uses = [...workflow.matchAll(/uses:\s+([^\s]+)/g)].map((match) => match[1]);
    assert.ok(uses.length > 0, `${path} must use reviewed actions`);
    for (const action of uses) {
      assert.match(action, /^actions\/(checkout|setup-node)@[0-9a-f]{40}$/);
    }
    assert.doesNotMatch(workflow, /secrets\.|NODE_AUTH_TOKEN|write-all|pull_request_target/);
  }

  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(ci, /id-token:\s+write/);

  const publish = read('.github/workflows/publish.yml');
  assert.match(publish, /permissions:\n\s+contents: read\n\s+id-token: write/);
});

test('publishing is release-only, version-bound, tokenless, and provenance-enabled', async () => {
  const workflow = read('.github/workflows/publish.yml');

  assert.match(workflow, /release:\n\s+types: \[published\]/);
  assert.doesNotMatch(workflow, /workflow_dispatch|push:/);
  assert.match(workflow, /environment: npm/);
  assert.match(workflow, /npm run release:evidence/);
  assert.match(workflow, /npm publish --access public --provenance/);

  const { releaseChannel } = await import('../scripts/release-channel.mjs');
  assert.equal(releaseChannel('1.0.0-beta.3', 'v1.0.0-beta.3'), 'beta');
  assert.equal(releaseChannel('1.0.0', 'v1.0.0'), 'latest');
  assert.throws(() => releaseChannel('1.0.0', 'v9.9.9'), /does not match/);

  const mismatch = spawnSync(process.execPath, ['scripts/release-channel.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REF_NAME: 'v9.9.9' },
  });
  assert.notEqual(mismatch.status, 0);
  assert.doesNotMatch(`${mismatch.stdout}${mismatch.stderr}`, /wak_|npm_/);
});

test('only reviewed public automation is unignored', () => {
  const ignore = read('.gitignore');
  for (const path of [
    '.github/dependabot.yml',
    '.github/workflows/ci.yml',
    '.github/workflows/publish.yml',
  ]) {
    const tracked = spawnSync('git', ['check-ignore', '--quiet', path]);
    assert.notEqual(tracked.status, 0, `${path} must be eligible for commit`);
  }
  assert.match(ignore, /\.github\/\*/);
  assert.match(read('.github/dependabot.yml'), /package-ecosystem: "github-actions"/);
});
