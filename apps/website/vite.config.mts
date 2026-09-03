import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Server pages read the growth form policy at render time, so the unit
    // suite carries the same switch the deployed environment sets.
    env: { GROWTH_FORM_POLICY: 'growth_v1' },
    // next.config.spec.ts sits at the app root and was matched by none of the
    // patterns below, so its rewrite assertions never ran. Root specs are in.
    include: [
      '*.spec.ts',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'scripts/**/*.spec.ts',
    ],
  },
});
