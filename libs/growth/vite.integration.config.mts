import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vite';

import { validateGrowthDatabaseEnvironment } from '../../scripts/growth-database-preflight.mts';

const integration = process.env['GROWTH_INTEGRATION'] === '1';
const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
if (!integration || !testDatabaseUrl?.trim()) {
  throw new Error(
    'GROWTH_INTEGRATION=1 and a nonempty TEST_DATABASE_URL are required'
  );
}
validateGrowthDatabaseEnvironment({
  mode: 'integration',
  environment: process.env,
  nodeVersion: process.versions.node,
});

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  root: workspaceRoot,
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    fileParallelism: false,
    // Real Neon transactions include network round trips and cold compute startup.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globals: true,
    include: ['libs/growth/test/**/*.integration.spec.ts'],
  },
});
