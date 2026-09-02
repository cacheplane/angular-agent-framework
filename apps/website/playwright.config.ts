import { defineConfig, devices } from '@playwright/test';

const localHost = '127.0.0.1';
const localPort = process.env['WEBSITE_E2E_PORT'] ?? '4308';
const localURL = `http://${localHost}:${localPort}`;
const runtimeURL = 'http://localhost:4300';
const baseURL = process.env['BASE_URL'] ?? localURL;
const shouldStartLocalServer = !process.env['BASE_URL'];
const reuseExistingServer =
  process.env['PLAYWRIGHT_REUSE_EXISTING_SERVER'] === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Match the cockpit configs: 2 retries on CI to absorb transient Next.js
  // dev-server startup flake; 0 locally for fast feedback.
  retries: process.env['CI'] ? 2 : 0,
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
    ? [
        {
          command: `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL='' npx next dev apps/website --hostname ${localHost} --port ${localPort}`,
          cwd: '../..',
          url: localURL,
          reuseExistingServer,
        },
        {
          command:
            'npx nx run cockpit-langgraph-streaming-angular:serve:cockpit --port 4300',
          cwd: '../..',
          url: runtimeURL,
          reuseExistingServer,
        },
      ]
    : undefined,
});
