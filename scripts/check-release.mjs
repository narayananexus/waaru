import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (pkg.private) throw new Error('Remove private:true before publishing.');
if (pkg.publishConfig?.access !== 'public') throw new Error('Public npm access must be explicit.');
if (pkg.version.includes('-') && pkg.publishConfig?.tag !== 'beta') throw new Error('Prereleases must use the beta tag.');
// A dry run can inspect the package before the owner's license decision.
// Real publication must not distribute a package with unresolved usage rights.
const dryRun = process.env.npm_config_dry_run === 'true';
if (!dryRun && (pkg.license === 'UNLICENSED' || !existsSync(new URL('../LICENSE', import.meta.url)))) {
  throw new Error('The approved SDK license and LICENSE file are required before publishing.');
}
console.log(dryRun && pkg.license === 'UNLICENSED'
  ? 'Package dry run: distribution license still needs owner selection.'
  : 'Package release metadata passed.');
