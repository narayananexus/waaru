import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const run = (command, args) => execFileSync(command, args, {
  encoding: 'utf8', stdio: 'pipe', maxBuffer: 4 * 1024 * 1024,
}).trim();
try {
  const clean = () => {
    if (run('git', ['status', '--porcelain', '--untracked-files=normal']))
      throw new Error('Commit or isolate SDK changes before creating release evidence.');
  };
  clean();
  const commit = run('git', ['rev-parse', 'HEAD']);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (pkg.name !== '@waaru/sdk') throw new Error('Run from the Waaru SDK repository root.');
  run('npm', ['run', 'verify']);
  clean();
  const destination = mkdtempSync(join(tmpdir(), 'waaru-release-artifact-'));
  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--dry-run=false', '--json', '--pack-destination', destination]));
  const tarballPath = join(destination, packed.filename);
  const integrity = 'sha512-' + createHash('sha512').update(readFileSync(tarballPath)).digest('base64');
  if (packed.integrity !== integrity) throw new Error('Packed integrity mismatch.');
  clean();
  if (run('git', ['rev-parse', 'HEAD']) !== commit) throw new Error('Commit changed during verification.');
  console.log(JSON.stringify({
    name: pkg.name, version: pkg.version, commit, node: process.version,
    npm: run('npm', ['--version']), verifiedAt: new Date().toISOString(),
    verification: 'npm run verify passed', published: false,
    tarballPath, integrity, shasum: packed.shasum,
    files: packed.files.map(file => file.path),
  }, null, 2));
} catch (error) {
  // Never print captured subprocess output: it may contain machine/account data.
  console.error(error.status === undefined ? error.message : 'Release evidence failed: verification or packaging command failed. Run npm run verify for details.');
  process.exitCode = 1;
}
