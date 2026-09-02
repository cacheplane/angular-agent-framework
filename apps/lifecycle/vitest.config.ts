import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  root: workspaceRoot,
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: [
      'apps/lifecycle/src/**/*.spec.ts',
      'apps/lifecycle/scripts/**/*.spec.ts',
    ],
  },
});
