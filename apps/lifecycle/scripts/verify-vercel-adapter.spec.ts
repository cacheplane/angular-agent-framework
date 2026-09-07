import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { finalizeVercelAdapter } from './verify-vercel-adapter.mjs';

describe('native Dawn Vercel packaging', () => {
  it('wraps a closed native function without rewriting it and retains its limits', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'lifecycle-native-test-'));
    try {
      const functionRoot = resolve(root, '.vercel/output/functions/index.func');
      await mkdir(functionRoot, { recursive: true });
      const native =
        'export default { fetch: async () => Response.json({ok:true}) };';
      await writeFile(resolve(functionRoot, 'index.mjs'), native);
      await writeFile(
        resolve(functionRoot, '.vc-config.json'),
        JSON.stringify({
          handler: 'index.mjs',
          launcherType: 'Nodejs',
          runtime: 'nodejs24.x',
        })
      );
      await writeFile(
        resolve(root, '.vercel/output/config.json'),
        JSON.stringify({
          version: 3,
          routes: [{ src: '/(.*)', dest: '/index' }],
        })
      );
      await finalizeVercelAdapter(root);
      expect(await readFile(resolve(functionRoot, 'index.mjs'), 'utf8')).toBe(
        native
      );
      expect(
        JSON.parse(
          await readFile(resolve(functionRoot, '.vc-config.json'), 'utf8')
        )
      ).toEqual({
        handler: 'lifecycle.mjs',
        launcherType: 'Nodejs',
        runtime: 'nodejs24.x',
        maxDuration: 60,
      });
      expect(
        await readFile(resolve(functionRoot, 'lifecycle.mjs'), 'utf8')
      ).toContain('./index.mjs');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
