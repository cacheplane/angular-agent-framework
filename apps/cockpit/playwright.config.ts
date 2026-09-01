import { defineConfig, devices } from '@playwright/test';

const cockpitHost = '127.0.0.1';
const cockpitPort = '4201';
const cockpitURL = `http://${cockpitHost}:${cockpitPort}`;
const runtimeURL = 'http://localhost:4300';
const reuseExistingServer =
  process.env['PLAYWRIGHT_REUSE_EXISTING_SERVER'] === 'true';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'control-plane.spec.ts',
  outputDir: '../../test-results/cockpit',
  fullyParallel: false,
  retries: process.env['CI'] ? 2 : 0,
  use: {
    baseURL: cockpitURL,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        "NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL='' npx nx serve cockpit --port 4201 --hostname 127.0.0.1",
      cwd: '../..',
      url: cockpitURL,
      reuseExistingServer,
    },
    {
      command:
        'npx nx run cockpit-langgraph-streaming-angular:serve:cockpit --port 4300',
      cwd: '../..',
      url: runtimeURL,
      reuseExistingServer,
    },
  ],
});
