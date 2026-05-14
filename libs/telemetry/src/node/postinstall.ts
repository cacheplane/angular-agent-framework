import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { capturePostinstall } from './client.js';
import { isTelemetryDisabled } from '../shared/env.js';

interface PostinstallDeps {
  readPackageJson: () => { name: string; version: string };
  write: (s: string) => void;
  env: NodeJS.ProcessEnv;
}

export async function capturePostinstallScript(deps: PostinstallDeps): Promise<void> {
  if (isTelemetryDisabled(deps.env)) return;
  let pkg: { name: string; version: string };
  try {
    pkg = deps.readPackageJson();
  } catch {
    return;
  }
  try {
    await capturePostinstall({ pkg: pkg.name, version: pkg.version });
    if (!deps.env.CI) {
      deps.write(
        `@ngaf/telemetry: sent install ping (${pkg.name}@${pkg.version}). ` +
        `Disable: DO_NOT_TRACK=1 or NGAF_TELEMETRY_DISABLED=1. ` +
        `See https://github.com/cacheplane/angular-agent-framework/blob/main/libs/telemetry/README.md\n`,
      );
    }
  } catch {
    // never break npm install
  }
}

// Entry point — invoked by package.json scripts.postinstall.
async function main(): Promise<void> {
  await capturePostinstallScript({
    readPackageJson: () => {
      const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
      return JSON.parse(readFileSync(pkgPath, 'utf8'));
    },
    write: (s) => process.stdout.write(s),
    env: process.env,
  });
}

// Only run as main entry, not when imported by tests.
const isDirectRun =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) main();
