import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createLifecycleVercelAdapter } from '../src/vercel-adapter.js';

const GENERIC_DATABASE_ENV = /(?<!DAWN_)DATABASE_URL/u;
const GENERATED_DAWN_TS_IMPORT =
  /from "(\.\.\/\.\.\/src\/[^"]+)\.ts"/gu;

export function rewriteDedicatedDawnDatabaseEnv(source: string): string {
  if (!source.includes('binding(env, "DATABASE_URL")')) {
    throw new Error(
      'Generated Dawn stores are missing the expected DATABASE_URL lookup'
    );
  }
  const rewritten = source.replaceAll('DATABASE_URL', 'DAWN_DATABASE_URL');
  if (
    !rewritten.includes('binding(env, "DAWN_DATABASE_URL")') ||
    GENERIC_DATABASE_ENV.test(rewritten)
  ) {
    throw new Error('Generated Dawn stores did not isolate DAWN_DATABASE_URL');
  }
  return rewritten;
}

export function assertExpectedDawnDefaultExport(source: string): void {
  if (!/export default app\s*$/mu.test(source)) {
    throw new Error(
      'Generated Dawn app is missing the expected default export'
    );
  }
}

export function rewriteDawnModuleImports(source: string): string {
  const imports = [...source.matchAll(GENERATED_DAWN_TS_IMPORT)].map(
    (match) => match[1]
  );
  if (
    !imports.includes('../../src/middleware') ||
    !imports.some((specifier) => specifier?.startsWith('../../src/app/'))
  ) {
    throw new Error(
      'Generated Dawn modules are missing the expected TypeScript module imports'
    );
  }
  const rewritten = source.replaceAll(GENERATED_DAWN_TS_IMPORT, 'from "$1.js"');
  if (GENERATED_DAWN_TS_IMPORT.test(rewritten)) {
    throw new Error('Generated Dawn TypeScript module imports remain');
  }
  return rewritten;
}

export async function verifyVercelAdapter(
  appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
): Promise<void> {
  const buildRoot = resolve(appRoot, '.dawn/build');
  const storesPath = resolve(buildRoot, 'stores.mjs');
  const appPath = resolve(buildRoot, 'app.mjs');
  const modulesPath = resolve(buildRoot, 'modules.edge.mjs');
  const stores = await readFile(storesPath, 'utf8');
  const rewrittenStores = rewriteDedicatedDawnDatabaseEnv(stores);
  if (stores !== rewrittenStores) {
    await writeFile(storesPath, rewrittenStores, 'utf8');
  }

  const modules = await readFile(modulesPath, 'utf8');
  const rewrittenModules = rewriteDawnModuleImports(modules);
  if (modules !== rewrittenModules) {
    await writeFile(modulesPath, rewrittenModules, 'utf8');
  }

  const appSource = await readFile(appPath, 'utf8');
  assertExpectedDawnDefaultExport(appSource);
  const generated = (await import(
    `${pathToFileURL(appPath).href}?verify=1`
  )) as {
    default?: { fetch?: unknown };
  };
  if (typeof generated.default?.fetch !== 'function') {
    throw new Error(
      'Generated Dawn app default export is not fetch-compatible'
    );
  }
  const apiEntry = (await import(
    `${pathToFileURL(resolve(appRoot, 'api/index.ts')).href}?verify=1`
  )) as { default?: { fetch?: unknown } };
  if (typeof apiEntry.default?.fetch !== 'function') {
    throw new Error('Lifecycle Vercel entry is not fetch-compatible');
  }

  let delegated = false;
  const adapter = createLifecycleVercelAdapter(
    {
      fetch(request) {
        delegated = request.url === 'https://lifecycle.invalid/healthz';
        return new Response('ok');
      },
    },
    () => 'adapter-verification-secret'
  );
  const response = await adapter.fetch(
    new Request('https://lifecycle.invalid/api/healthz', {
      headers: { authorization: 'Bearer adapter-verification-secret' },
    })
  );
  if (!delegated || !response.ok || (await response.text()) !== 'ok') {
    throw new Error(
      'Lifecycle Vercel adapter local request verification failed'
    );
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await verifyVercelAdapter();
}
