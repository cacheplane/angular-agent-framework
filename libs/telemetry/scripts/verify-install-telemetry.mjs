#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TELEMETRY_DEP = '@threadplane/telemetry';
const POSTINSTALL = 'threadplane-telemetry-postinstall || true';

export function verifyInstallTelemetryManifest(pkg, manifestPath = 'package.json') {
  if (pkg?.name === TELEMETRY_DEP) return;
  if (typeof pkg?.name !== 'string' || !pkg.name.startsWith('@threadplane/')) {
    throw new Error(`${manifestPath} is not an @threadplane package manifest`);
  }

  const actualDep = pkg.dependencies?.[TELEMETRY_DEP];
  if (actualDep !== '*') {
    throw new Error(`${pkg.name} is missing dependencies["${TELEMETRY_DEP}"] = "*" in ${manifestPath}`);
  }

  const actualPostinstall = pkg.scripts?.postinstall;
  if (actualPostinstall !== POSTINSTALL) {
    throw new Error(`${pkg.name} is missing scripts.postinstall = "${POSTINSTALL}" in ${manifestPath}`);
  }
}

export async function verifyInstallTelemetryManifests(packageRoots) {
  if (packageRoots.length === 0) {
    throw new Error('Usage: node libs/telemetry/scripts/verify-install-telemetry.mjs <package-root> [...]');
  }

  for (const root of packageRoots) {
    const manifestPath = join(root, 'package.json');
    const pkg = JSON.parse(await readFile(manifestPath, 'utf8'));
    verifyInstallTelemetryManifest(pkg, manifestPath);
  }
}

async function main() {
  try {
    await verifyInstallTelemetryManifests(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
