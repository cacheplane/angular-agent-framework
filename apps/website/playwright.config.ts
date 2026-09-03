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
  // The public-copy gate must read what a visitor receives, and `next dev`
  // serves a different bundle than production. This mode serves the already
  // completed Nx production build instead.
  const productionMode = environment['WEBSITE_E2E_MODE'] === 'production';
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
      // Vercel deployment protection answers 302 -> vercel.com/sso-api for every
      // path on a preview, so a browser-driven check lands on an SSO page and
      // times out. When CI supplies the project's automation bypass, send it so
      // the preview is reachable. Every URL this suite touches is a first-party
      // Threadplane origin. Unset locally and in production runs.
      ...(environment['VERCEL_AUTOMATION_BYPASS_SECRET']
        ? {
            extraHTTPHeaders: {
              'x-vercel-protection-bypass':
                environment['VERCEL_AUTOMATION_BYPASS_SECRET'],
              'x-vercel-set-bypass-cookie': 'true',
            },
          }
        : {}),
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
            command: productionMode
              ? // `nx serve --configuration=production` runs with the dist
                // directory as its cwd, and dist carries no `content/`. Routes
                // that read MDX at request time — /blog among them — then serve
                // an empty list, so the gate would pass against a page no
                // visitor sees. Link the content in before serving.
                `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL='' npx nx build website --configuration=production --skip-nx-cache && ln -sfn ../../../apps/website/content dist/apps/website/content && npx nx serve website --configuration=production --port=${localPort} --skip-nx-cache`
              : bfcacheRuntimeTest
              ? `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL='' npx nx build website --configuration=production --skip-nx-cache && npx nx serve website --configuration=production --port=${localPort} --skip-nx-cache`
              : `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL='' npx next dev apps/website --hostname ${localHost} --port ${localPort}`,
            cwd: '../..',
            url: localURL,
            reuseExistingServer,
            // Server pages read the growth form policy while rendering, so the
            // local server carries the switch the deployed environment sets.
            env: { GROWTH_FORM_POLICY: 'growth_v1' },
            // A production run builds before it serves, which outlasts the
            // BFCache budget; each mode gets the time it actually needs.
            timeout: productionMode
              ? 300_000
              : bfcacheRuntimeTest
              ? 180_000
              : 60_000,
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
