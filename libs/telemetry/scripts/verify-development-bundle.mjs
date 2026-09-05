// Verify shipped browser code with the actual Angular production development-mode constant.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { verifyAngularInstallBridge } from './verify-angular-install-bridge.mjs';
const { parseCollectionBatch } = await import(
  pathToFileURL(resolve('dist/libs/growth/src/lib/observability/contracts.js'))
    .href
);

const entry = `
  import { createDevelopmentRuntime } from './dist/libs/telemetry/browser/fesm2022/threadplane-telemetry.mjs';
  const runtime = createDevelopmentRuntime({ integration: 'langgraph', packageName: '@threadplane/langgraph', packageVersion: '0.0.65' });
  if (globalThis.exercise) { runtime.touch(); runtime.milestone('transport.connected'); }
`;
async function check(development, browser, exercise) {
  const result = await build({
    stdin: { contents: entry, resolveDir: process.cwd() },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    minify: true,
    define: { ngDevMode: String(development) },
    logLevel: 'silent',
  });
  const counts = { storage: 0, identity: 0, fetch: 0 };
  let validatedBatches = 0;
  const stored = new Map();
  const timers = new Map();
  let sequence = 0;
  const context = {
    exercise,
    AbortController,
    TextDecoder,
    TextEncoder,
    Response,
    URL,
    console: {
      info() {
        /* no announcement output in verification */
      },
    },
    setTimeout: (fn, ms) => {
      const id = ++sequence;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    fetch: async (_url, options) => {
      counts.fetch++;
      const batch = parseCollectionBatch(
        'runtime',
        JSON.parse(options.body),
        new Date()
      );
      validatedBatches++;
      return new Response(
        JSON.stringify({
          schemaVersion: 1,
          events: batch.events.map((e) => ({
            eventId: e.eventId,
            disposition: 'accepted',
          })),
          announcements: [],
        })
      );
    },
    ...(browser
      ? {
          document: {},
          window: {
            location: { hostname: 'remote-development.example.invalid' },
            crypto: {
              randomUUID: () => {
                counts.identity++;
                return `00000000-0000-4000-8000-${String(
                  counts.identity
                ).padStart(12, '0')}`;
              },
            },
            get localStorage() {
              counts.storage++;
              return {
                getItem: (key) => stored.get(key) ?? null,
                setItem: (key, value) => stored.set(key, value),
              };
            },
          },
        }
      : {}),
  };
  runInNewContext(result.outputFiles[0].text, context, { timeout: 3000 });
  if (development && browser && exercise) {
    assert(
      counts.identity > 0 && counts.storage > 0,
      'Development browser positive control did not initialize'
    );
    for (const [id, timer] of timers)
      if (timer.ms === 0) {
        timers.delete(id);
        timer.fn();
      }
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      counts.fetch,
      1,
      'Development browser positive control did not exchange'
    );
    assert.equal(
      validatedBatches,
      1,
      'The built Growth contract rejected the emitted batch'
    );
  } else {
    assert.deepEqual(counts, { storage: 0, identity: 0, fetch: 0 });
    assert.equal(timers.size, 0);
  }
}
for (const configuration of [
  [false, true, true],
  [true, false, true],
  [true, true, false],
  [true, true, true],
]) {
  await check(...configuration);
}
for (const name of ['langgraph', 'ag-ui', 'render']) {
  const pkg = JSON.parse(
    await readFile(resolve('dist/libs', name, 'package.json'), 'utf8')
  );
  const bundle = await readFile(
    resolve('dist/libs', name, `fesm2022/threadplane-${name}.mjs`),
    'utf8'
  );
  assert(
    bundle.includes(
      `THREADPLANE_PACKAGE_VERSION = ${JSON.stringify(pkg.version)}`
    ) || bundle.includes(`THREADPLANE_PACKAGE_VERSION = '${pkg.version}'`),
    `${name} runtime version differs from published manifest; rebuild after versioning`
  );
  assert(
    bundle.includes('createDevelopmentRuntime'),
    `${name} missing runtime instrumentation`
  );
  assert(
    pkg.peerDependencies['@threadplane/telemetry'] !== '*',
    `${name} must require the telemetry API version`
  );
}
console.log(
  'Built browser verification passed: production, SSR and import-only silence; remote development exchange; three package runtime versions.'
);
await verifyAngularInstallBridge(parseCollectionBatch);
