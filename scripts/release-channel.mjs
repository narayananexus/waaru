import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function releaseChannel(version, refName) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('Package version is not a supported release version.');
  }
  if (refName !== `v${version}`) {
    throw new Error(`Release tag ${refName || '(missing)'} does not match package version ${version}.`);
  }
  return version.includes('-') ? 'beta' : 'latest';
}

const entry = process.argv[1] && pathToFileURL(process.argv[1]).href;
if (entry === import.meta.url) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(releaseChannel(pkg.version, process.env.GITHUB_REF_NAME));
}
