import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { capturePostinstall } from './client.js';
import { isTelemetryDisabled } from '../shared/env.js';

interface PostinstallDeps {
  readPackageJson: () => { name: string; version: string };
  write: (s: string) => void;
  env: NodeJS.ProcessEnv;
}

export async function capturePostinstallScript(deps: PostinstallDeps): Promise<void> {
  // Single opt-out gate. DO_NOT_TRACK, NGAF_TELEMETRY_DISABLED, and CI envs
  // all funnel through isTelemetryDisabled and return early — no event sent,
  // no stdout notice. Matches libs/telemetry/README.md trust contract.
  if (isTelemetryDisabled(deps.env)) return;
  let pkg: { name: string; version: string };
  try {
    pkg = deps.readPackageJson();
  } catch {
    return;
  }
  try {
    await capturePostinstall({ pkg: pkg.name, version: pkg.version });
    deps.write(
      `@ngaf/telemetry: sent install ping (${pkg.name}@${pkg.version}). ` +
      `Disable: DO_NOT_TRACK=1 or NGAF_TELEMETRY_DISABLED=1. ` +
      `See https://github.com/cacheplane/angular-agent-framework/blob/main/libs/telemetry/README.md\n`,
    );
  } catch {
    // never break npm install
  }
}

// Flush stdout so the opt-out notice is visible to npm. Without this,
// posthog-node's await chain can leave the notice in stdout's pipe buffer
// when the process exits, and npm reaps the script before the buffer drains.
async function flushStdout(): Promise<void> {
  return new Promise((resolve) => {
    if (process.stdout.writableNeedDrain) {
      process.stdout.once('drain', () => resolve());
    } else {
      // Yield one tick so any pending write callbacks run before exit.
      setImmediate(() => resolve());
    }
  });
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
  await flushStdout();
}

// Only run as main entry, not when imported by tests.
// Resolves symlinks on both sides so `/tmp` vs `/private/tmp` on macOS,
// pnpm content-addressed stores, and similar setups all match correctly.
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}
if (isDirectRun()) main();
