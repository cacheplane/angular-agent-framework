import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
