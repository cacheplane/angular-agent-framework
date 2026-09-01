import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [nxViteTsPaths()],
  // The capability matrix specs (see `test.include`) live outside this app's
  // directory, and Vite's dev server refuses to serve files above its root
  // unless they are allow-listed. Without this the matrix specs fail to load
  // with ERR_MODULE_NOT_FOUND on a `/@fs/...` path under `nx test cockpit`.
  server: { fs: { allow: [resolve(__dirname, '../..')] } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      '*.spec.ts',
      'scripts/**/*.spec.ts',
      // The per-product capability matrix specs live beside the examples they
      // describe and had no test target of their own, which is how their
      // docsPath assertion drifted into asserting a URL shape the website has
      // never served. Run them here so `nx test cockpit` covers them.
      '../../cockpit/*/matrix.spec.ts',
    ],
    setupFiles: ['./test-setup.ts'],
  },
});
