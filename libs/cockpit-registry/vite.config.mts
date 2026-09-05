import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [nxViteTsPaths()],
  // The capability matrix specs (see `test.include`) live outside this
  // project's directory, and Vite's dev server refuses to serve files above
  // its root unless they are allow-listed. Without this the matrix specs
  // fail to load with ERR_MODULE_NOT_FOUND on a `/@fs/...` path under
  // `nx test cockpit-registry`.
  server: { fs: { allow: [resolve(__dirname, '../..')] } },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/**/*.spec.ts',
      // The per-product capability matrix specs live beside the examples
      // they describe and had no test target of their own, which is how
      // their docsPath assertion drifted into asserting a URL shape the
      // website has never served. Run them here so `nx test cockpit-registry`
      // covers them.
      '../../cockpit/*/matrix.spec.ts',
      // Same story for the per-product footprint specs (chat, deep-agents,
      // render): they sit outside any project root, so no `test` target
      // owned them and the deep-agents one drifted into asserting a website
      // docs library that does not exist. Glob the whole family rather than
      // naming files, so a new `cockpit/<product>/footprint.spec.ts` is
      // covered the day it lands instead of joining the unrun pile.
      '../../cockpit/*/footprint.spec.ts',
    ],
  },
});
