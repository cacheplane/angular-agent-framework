import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['BASE_URL'] ?? 'http://127.0.0.1:4201';
const shouldStartLocalServer = !process.env['BASE_URL'];

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/all-examples-smoke*', '**/production-smoke*'],
  fullyParallel: true,
  use: {
    baseURL,
  },
  // Declare chromium as the only browser project. Without this, Playwright
  // validates ALL default browsers (chromium + webkit + firefox) on test
  // start and prints a long "missing system dependencies" warning for the
  // browsers we don't run, even though tests pass cleanly on chromium.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: shouldStartLocalServer
    ? {
        command: 'npx next dev . --port 4201',
        url: 'http://127.0.0.1:4201',
        reuseExistingServer: false,
      }
    : undefined,
});
