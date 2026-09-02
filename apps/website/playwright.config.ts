import { defineConfig, devices } from '@playwright/test';

type WebsitePlaywrightEnvironment = Readonly<
  Record<string, string | undefined>
>;

export const createWebsitePlaywrightConfig = (
  environment: WebsitePlaywrightEnvironment = process.env
) => {
  const localHost = '127.0.0.1';
  const localPort = environment['WEBSITE_E2E_PORT'] ?? '4308';
  const localURL = `http://${localHost}:${localPort}`;
  const runtimeURL = 'http://localhost:4300';
  const productionSmoke = environment['PRODUCTION_SMOKE'] === 'true';
  const baseURL = environment['BASE_URL'] ?? localURL;
  const shouldStartLocalServer = !productionSmoke && !environment['BASE_URL'];
  const reuseExistingServer =
    environment['PLAYWRIGHT_REUSE_EXISTING_SERVER'] === 'true';

  return defineConfig({
    testDir: './e2e',
    testIgnore: productionSmoke
      ? undefined
      : '**/platform-production-smoke.spec.ts',
    fullyParallel: true,
    // Match the cockpit configs: 2 retries on CI to absorb transient Next.js
    // dev-server startup flake; 0 locally for fast feedback.
    retries: environment['CI'] ? 2 : 0,
    use: {
      baseURL,
    },
    // Declare chromium as the only browser project. This suppresses the
    // misleading "missing system dependencies" warning for webkit/firefox.
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
};

export default createWebsitePlaywrightConfig();
