import { defineConfig } from '@playwright/test';

const baseURL = process.env['BASE_URL'] ?? 'http://127.0.0.1:4201';
const shouldStartLocalServer = !process.env['BASE_URL'];

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/all-examples-smoke*'],
  fullyParallel: true,
  use: {
    baseURL,
  },
  webServer: shouldStartLocalServer
    ? {
        command: 'npx next dev . --port 4201',
        url: 'http://127.0.0.1:4201',
        reuseExistingServer: false,
      }
    : undefined,
});
