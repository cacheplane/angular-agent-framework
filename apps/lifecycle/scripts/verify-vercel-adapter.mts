import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function finalizeVercelAdapter(
  appRoot = sourceRoot
): Promise<void> {
  const outputRoot = resolve(appRoot, '.vercel/output');
  const functionRoot = resolve(outputRoot, 'functions/index.func');
  const runtimePath = resolve(functionRoot, 'index.mjs');
  const native = await readFile(runtimePath);
  const metadataPath = resolve(functionRoot, '.vc-config.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  assert.deepEqual(metadata, {
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    runtime: 'nodejs24.x',
  });
  assert.deepEqual(
    JSON.parse(await readFile(resolve(outputRoot, 'config.json'), 'utf8')),
    {
      version: 3,
      routes: [{ dest: '/index', src: '/(.*)' }],
    }
  );
  const result = await build({
    stdin: {
      contents: `import app from './index.mjs';\nimport { createLifecycleVercelAdapter } from ${JSON.stringify(
        resolve(sourceRoot, 'src/vercel-adapter.ts')
      )};\nexport default createLifecycleVercelAdapter(app);`,
      resolveDir: functionRoot,
      sourcefile: 'lifecycle-entry.mjs',
      loader: 'js',
    },
    outfile: resolve(functionRoot, 'lifecycle.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    external: ['./index.mjs'],
    metafile: true,
  });
  assert.ok(result.metafile);
  const imports = Object.values(result.metafile.outputs).flatMap(
    (output) => output.imports
  );
  assert.deepEqual(imports.map((item) => item.path).sort(), [
    './index.mjs',
    'node:crypto',
  ]);
  assert.deepEqual(
    await readFile(runtimePath),
    native,
    'Native Dawn runtime must remain unchanged'
  );
  await writeFile(
    metadataPath,
    `${JSON.stringify(
      { ...metadata, handler: 'lifecycle.mjs', maxDuration: 60 },
      null,
      2
    )}\n`
  );
}

export async function verifyVercelAdapter(appRoot = sourceRoot): Promise<void> {
  await finalizeVercelAdapter(appRoot);
  // Import outside the workspace under plain Node, without tsx or node_modules.
  const isolated = await mkdtemp(resolve(tmpdir(), 'lifecycle-vercel-'));
  try {
    await cp(
      resolve(appRoot, '.vercel/output/functions/index.func'),
      isolated,
      { recursive: true }
    );
    const code = `
      import assert from 'node:assert/strict';
      const {default:app} = await import(${JSON.stringify(
        pathToFileURL(resolve(isolated, 'lifecycle.mjs')).href
      )});
      for (const path of ['/healthz','/threads','/threads/id/state','/memory/candidates']) {
        assert.equal((await app.fetch(new Request('https://lifecycle.invalid'+path))).status,401);
      }
      const request=()=>new Request('https://lifecycle.invalid/healthz',{headers:{authorization:'Bearer artifact-check'}});
      delete process.env.DAWN_DATABASE_URL;
      assert.equal((await app.fetch(request())).status,503);
    `;
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', code],
      {
        cwd: isolated,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          PATH: process.env['PATH'],
          LIFECYCLE_SERVICE_SECRET: 'artifact-check',
          VERCEL_DEPLOYMENT_ID: 'artifact-check',
        },
      }
    );
    if (result.error || result.status !== 0)
      throw new Error(
        `Isolated native Vercel verification failed: ${
          result.error?.message ?? result.stderr
        }`
      );
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await verifyVercelAdapter();
