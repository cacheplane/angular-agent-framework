/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/examples-chat-angular',
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
