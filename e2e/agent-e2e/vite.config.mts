import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: projectRoot,
  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'node',         // HTTP requests, not browser
    testTimeout: 60000,          // LLM calls can be slow
    include: ['src/**/*.e2e.spec.ts'],
  },
});
