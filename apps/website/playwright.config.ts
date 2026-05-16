import { defineConfig, devices } from '@playwright/test';

const localHost = '127.0.0.1';
const localPort = process.env['WEBSITE_E2E_PORT'] ?? '4308';
const localURL = `http://${localHost}:${localPort}`;
const baseURL = process.env['BASE_URL'] ?? localURL;
const shouldStartLocalServer = !process.env['BASE_URL'];
const reuseExistingServer = process.env['PLAYWRIGHT_REUSE_EXISTING_SERVER'] === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL,
  },
  // Declare chromium as the only browser project — see the matching comment
  // in apps/cockpit/playwright.config.ts. Suppresses the misleading
  // "missing system dependencies" warning for webkit/firefox.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: shouldStartLocalServer
    ? {
        command: `npx next dev . --hostname ${localHost} --port ${localPort}`,
        url: localURL,
        reuseExistingServer,
      }
    : undefined,
});
