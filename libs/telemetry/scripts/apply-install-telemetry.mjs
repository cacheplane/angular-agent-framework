#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TELEMETRY_DEP = '@ngaf/telemetry';
const POSTINSTALL = 'ngaf-telemetry-postinstall || true';

async function patchPackageManifest(packageRoot) {
  const manifestPath = join(packageRoot, 'package.json');
  const pkg = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (pkg.name === TELEMETRY_DEP) return;
  if (typeof pkg.name !== 'string' || !pkg.name.startsWith('@ngaf/')) {
    throw new Error(`${manifestPath} is not an @ngaf package manifest`);
  }

  pkg.dependencies = { ...(pkg.dependencies ?? {}), [TELEMETRY_DEP]: '*' };
  pkg.scripts = { ...(pkg.scripts ?? {}), postinstall: POSTINSTALL };

  await writeFile(manifestPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`[install-telemetry] patched ${manifestPath}`);
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error('Usage: node libs/telemetry/scripts/apply-install-telemetry.mjs <package-root> [...]');
  process.exit(1);
}

for (const root of roots) {
  await patchPackageManifest(root);
}
