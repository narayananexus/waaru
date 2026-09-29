import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { releaseChannel } from './release-channel.mjs';

function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match || match.slice(1, 4).some((value) => !Number.isSafeInteger(Number(value)))) {
    throw new Error('Unsupported package version.');
  }
  const prerelease = match[4]?.split('.') ?? [];
  if (prerelease.some((value) => /^\d+$/.test(value) && !/^(0|[1-9]\d*)$/.test(value))) {
    throw new Error('Unsupported package version.');
  }
  return { core: match.slice(1, 4).map(Number), prerelease };
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < 3; i += 1) {
    if (a.core[i] !== b.core[i]) return a.core[i] < b.core[i] ? -1 : 1;
  }
  if (!a.prerelease.length || !b.prerelease.length) {
    return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length ? -1 : 1;
  }
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i += 1) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return BigInt(x) < BigInt(y) ? -1 : 1;
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export async function publishCandidate({ pkg, policy, refName, fetch = globalThis.fetch }) {
  if (pkg.name !== '@waaru/sdk' || pkg.private ||
      pkg.publishConfig?.access !== 'public' ||
      pkg.publishConfig?.registry !== 'https://registry.npmjs.org/') {
    throw new Error('Unexpected package publishing configuration.');
  }
  parseVersion(pkg.version);
  const tag = releaseChannel(pkg.version, refName ?? `v${pkg.version}`);
  if (policy?.ready !== true || policy.version !== pkg.version) {
    return { publish: false, reason: 'Version is not marked ready.', version: pkg.version, tag };
  }
  const response = await fetch('https://registry.npmjs.org/@waaru%2Fsdk', {
    signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Registry inspection failed (HTTP ${response.status}).`);
  const metadata = await response.json();
  if (!metadata || typeof metadata.versions !== 'object' || metadata.versions === null ||
      typeof metadata['dist-tags'] !== 'object' || metadata['dist-tags'] === null) {
    throw new Error('Registry returned invalid package metadata.');
  }
  if (Object.hasOwn(metadata.versions, pkg.version)) {
    return { publish: false, reason: 'Version is already published.', version: pkg.version, tag };
  }
  const current = metadata['dist-tags'][tag];
  if (current !== undefined && (typeof current !== 'string' || compareVersions(pkg.version, current) <= 0)) {
    throw new Error('Publishing would move the distribution tag backwards.');
  }
  return { publish: true, reason: 'Verified new release candidate.', version: pkg.version, tag };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const policy = JSON.parse(readFileSync('.github/release-policy.json', 'utf8'));
  const result = await publishCandidate({ pkg, policy, refName: process.env.RELEASE_TAG || undefined });
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `publish=${result.publish}\nversion=${result.version}\ntag=${result.tag}\n`);
  }
  console.log(JSON.stringify(result));
}
