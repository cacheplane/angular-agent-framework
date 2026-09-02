import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vite';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  root: workspaceRoot,
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: [
      'libs/growth/src/**/*.spec.ts',
      'scripts/apply-migrations.spec.ts',
    ],
  },
});
