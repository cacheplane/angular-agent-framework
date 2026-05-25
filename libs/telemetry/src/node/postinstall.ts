#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { capturePostinstall, createPostinstallProperties } from './client.js';
import { isTelemetryDisabled } from '../shared/env.js';

interface PostinstallDeps {
  readPackageJson: () => { name: string; version: string };
  write: (s: string) => void;
  env: NodeJS.ProcessEnv;
  cwd?: () => string;
}

const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes']);

function truthy(value: string | undefined): boolean {
  return value !== undefined && TRUE_VALUES.has(value);
}

function debugEnabled(env: NodeJS.ProcessEnv): boolean {
  return (env.DEBUG ?? '')
    .split(/[\s,]+/)
    .some((part) => part === '*' || part === 'ngaf:*' || part === 'ngaf:telemetry');
}

function isGlobalInstall(env: NodeJS.ProcessEnv): boolean {
  return truthy(env.npm_config_global) || env.npm_config_location === 'global';
}

function canonicalPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function isInNodeModules(cwd: string): boolean {
  return canonicalPath(cwd).split(sep).includes('node_modules');
}

function shouldSkipLocalTopLevelInstall(env: NodeJS.ProcessEnv, cwd: string): boolean {
  if (isGlobalInstall(env)) return false;
  const resolvedCwd = canonicalPath(cwd);
  if (env.INIT_CWD && canonicalPath(env.INIT_CWD) === resolvedCwd) return true;
  return !isInNodeModules(resolvedCwd);
}

function readLifecyclePackageJson(env: NodeJS.ProcessEnv, cwd: string): { name: string; version: string } {
  if (env.npm_package_name && env.npm_package_version) {
    return { name: env.npm_package_name, version: env.npm_package_version };
  }
  return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
}

export async function capturePostinstallScript(deps: PostinstallDeps): Promise<void> {
  // Single opt-out gate. DO_NOT_TRACK, npm_config_do_not_track,
  // NGAF_TELEMETRY_DISABLED, and CI envs all return early: no event, no notice.
  if (isTelemetryDisabled(deps.env)) return;
  const cwd = deps.cwd?.() ?? process.cwd();
  if (shouldSkipLocalTopLevelInstall(deps.env, cwd)) return;
  let pkg: { name: string; version: string };
  try {
    pkg = deps.readPackageJson();
  } catch {
    return;
  }
  try {
    const result = await capturePostinstall({ pkg: pkg.name, version: pkg.version });
    if (debugEnabled(deps.env)) {
      deps.write(
        `@threadplane/telemetry payload: ${
          JSON.stringify({
            event: 'ngaf:postinstall',
            properties: createPostinstallProperties({ pkg: pkg.name, version: pkg.version }, deps.env),
          })
        }\n`,
      );
    }
    if (result.sent) {
      deps.write(
        `@threadplane/telemetry: install telemetry sent (${pkg.name}@${pkg.version}). ` +
        `Disable: DO_NOT_TRACK=1 or NGAF_TELEMETRY_DISABLED=1. ` +
        `See https://github.com/cacheplane/angular-agent-framework/blob/main/libs/telemetry/README.md\n`,
      );
    }
  } catch {
    // never break npm install
  }
}

async function flushStdout(): Promise<void> {
  return new Promise((resolve) => {
    if (process.stdout.writableNeedDrain) {
      process.stdout.once('drain', () => resolve());
    } else {
      setImmediate(() => resolve());
    }
  });
}

// Entry point — invoked by package.json scripts.postinstall.
async function main(): Promise<void> {
  await capturePostinstallScript({
    readPackageJson: () => readLifecyclePackageJson(process.env, process.cwd()),
    write: (s) => process.stdout.write(s),
    env: process.env,
    cwd: () => process.cwd(),
  });
  await flushStdout();
}

// Only run as main entry, not when imported by tests.
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
