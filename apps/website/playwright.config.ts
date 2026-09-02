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
  const bfcacheRuntimeTest = environment['CUSTOM_RUNTIME_BFCACHE'] === 'true';
  const baseURL = environment['BASE_URL'] ?? localURL;
  const shouldStartLocalServer = !productionSmoke && !environment['BASE_URL'];
  const reuseExistingServer =
    environment['PLAYWRIGHT_REUSE_EXISTING_SERVER'] === 'true';

  return defineConfig({
    testDir: './e2e',
    testMatch: bfcacheRuntimeTest
      ? '**/custom-runtime-bfcache.spec.ts'
      : undefined,
    testIgnore: productionSmoke
      ? undefined
      : bfcacheRuntimeTest
      ? '**/platform-production-smoke.spec.ts'
      : [
          '**/platform-production-smoke.spec.ts',
          '**/custom-runtime-bfcache.spec.ts',
        ],
    fullyParallel: true,
    // Match the cockpit configs: 2 retries on CI to absorb transient Next.js
    // dev-server startup flake; 0 locally for fast feedback.
    retries: environment['CI'] ? 2 : 0,
    use: {
      baseURL,
      // Custom-target coverage carries an obvious fixture key. Keep browser
      // artifacts disabled so request headers and page state are never retained.
      trace: 'off',
      video: 'off',
    },
    // Declare chromium as the only browser project. This suppresses the
    // misleading "missing system dependencies" warning for webkit/firefox.
    projects: [
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
          ...(bfcacheRuntimeTest
            ? {
                launchOptions: {
                  channel: 'chromium',
                  ignoreDefaultArgs: ['--disable-back-forward-cache'],
                  args: ['--enable-features=BackForwardCache'],
                },
              }
            : {}),
        },
      },
    ],
    webServer: shouldStartLocalServer
      ? [
          {
            command: bfcacheRuntimeTest
              ? `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL='' npx nx build website --configuration=production --skip-nx-cache && npx nx serve website --configuration=production --port=${localPort} --skip-nx-cache`
              : `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL='' npx next dev apps/website --hostname ${localHost} --port ${localPort}`,
            cwd: '../..',
            url: localURL,
            reuseExistingServer,
            timeout: bfcacheRuntimeTest ? 180_000 : 60_000,
          },
          {
            command: bfcacheRuntimeTest
              ? 'npx nx build cockpit-langgraph-streaming-angular --configuration=cockpit --skip-nx-cache && npx http-server dist/cockpit/langgraph/streaming/angular -p 4300 -c-1'
              : 'npx nx run cockpit-langgraph-streaming-angular:serve:cockpit --port 4300',
            cwd: '../..',
            url: runtimeURL,
            reuseExistingServer,
          },
          ...(!bfcacheRuntimeTest
            ? [
                {
                  command:
                    'npx nx run cockpit-ag-ui-streaming-angular:serve:cockpit --port 4321',
                  cwd: '../..',
                  url: 'http://localhost:4321',
                  reuseExistingServer,
                },
                {
                  command:
                    'npx nx run cockpit-chat-threads-angular:serve:cockpit --port 4506',
                  cwd: '../..',
                  url: 'http://localhost:4506',
                  reuseExistingServer,
                },
              ]
            : []),
          {
            command:
              'npx tsx apps/website/e2e/fixtures/custom-runtime-server.ts',
            cwd: '../..',
            url: 'http://127.0.0.1:4399/health',
            reuseExistingServer,
          },
        ]
      : undefined,
  });
};

export default createWebsitePlaywrightConfig();
