// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/**
 * Builds the minting-service API functions using Vercel Build Output API v3.
 *
 * - Bundles each `handlers/*.ts` into a self-contained CommonJS module via
 *   esbuild, inlining workspace deps (@cacheplane/*) and npm deps alike so no
 *   install step is required inside each function directory.
 * - Writes to `.vercel/output/functions/api/<name>.func/` with the companion
 *   `.vc-config.json` Vercel's Node runtime expects.
 * - Writes `.vercel/output/config.json` at the top level so Vercel picks up
 *   the Build Output API layout instead of scanning the rootDirectory for TS
 *   sources. The sources live outside `api/` on purpose — Vercel otherwise
 *   auto-runs @vercel/node on top of our build, which doesn't resolve the
 *   workspace tsconfig paths and fails the deploy.
 *
 * Run via `nx build minting-service`, which sets `cwd` to this app.
 */
import { build } from 'esbuild';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const handlersDir = join(appRoot, 'handlers');
const outputRoot = join(appRoot, '.vercel', 'output');
const functionsRoot = join(outputRoot, 'functions', 'api');

async function listEntries() {
  const files = await readdir(handlersDir);
  return files
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !f.endsWith('.d.ts'))
    .map((f) => join(handlersDir, f));
}

async function buildEntry(entry) {
  const name = basename(entry, '.ts');
  const funcDir = join(functionsRoot, `${name}.func`);
  await mkdir(funcDir, { recursive: true });

  await build({
    entryPoints: [entry],
    outfile: join(funcDir, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    // Lets esbuild resolve `@cacheplane/*` via tsconfig paths and
    // follows `extends` up to the workspace tsconfig.base.json.
    tsconfig: join(appRoot, 'tsconfig.app.json'),
    // @vercel/node provides these as ambient in the runtime environment.
    external: ['@vercel/node'],
    sourcemap: 'inline',
    logLevel: 'info',
  });

  const vcConfig = {
    runtime: 'nodejs20.x',
    handler: 'index.js',
    launcherType: 'Nodejs',
    shouldAddHelpers: true,
    maxDuration: 10,
  };
  await writeFile(join(funcDir, '.vc-config.json'), JSON.stringify(vcConfig, null, 2));

  // The app's package.json declares `"type": "module"`, which would make Node
  // load `index.js` as ESM. esbuild emits CJS, so drop a colocated package.json
  // that pins `commonjs` inside each function directory.
  await writeFile(
    join(funcDir, 'package.json'),
    JSON.stringify({ type: 'commonjs' }, null, 2),
  );
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(functionsRoot, { recursive: true });

  const entries = await listEntries();
  if (entries.length === 0) {
    throw new Error(`no handler entries found in ${handlersDir}`);
  }

  await Promise.all(entries.map(buildEntry));

  // Minimal Build Output API v3 config — no custom routes needed;
  // Vercel maps `functions/api/<name>.func/` to `/api/<name>` by convention.
  await writeFile(
    join(outputRoot, 'config.json'),
    JSON.stringify({ version: 3 }, null, 2),
  );

  console.log(`\nbuilt ${entries.length} function(s) to ${outputRoot}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
