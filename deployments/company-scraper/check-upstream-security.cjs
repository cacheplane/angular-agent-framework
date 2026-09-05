// Execute against the actual patched upstream source inside the built image:
// docker run --rm --entrypoint node -v "$PWD/check-upstream-security.cjs:/tmp/check.cjs:ro" IMAGE /tmp/check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const upstreamRequire = createRequire('/usr/src/app/api.ts');
const ts = upstreamRequire('typescript');
let routeHandler, proxyCheck;
const fakeContext = {
  route: async (pattern, handler) => {
    if (pattern === '**/*') routeHandler = handler;
  },
};
const fakeBrowser = { newContext: async () => fakeContext };
const source =
  fs
    .readFileSync('/usr/src/app/api.ts', 'utf8')
    .replace(/start\(\)\.catch\(\(error\) => \{[\s\S]*?\n\}\);/, '') +
  '\nmodule.exports = {initializeBrowser,createContext,startSSRFProxy,assertSafeTargetUrl,scrapePage};';
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2016,
    esModuleInterop: true,
  },
}).outputText;
const exportsObject = {};
const context = {
  exports: exportsObject,
  module: { exports: exportsObject },
  console,
  URL,
  process: {
    env: { COMPANY_SCRAPER_SECRET: 'test-only', ALLOW_LOCAL_WEBHOOKS: 'true' },
  },
  require: (name) => {
    if (name === 'playwright')
      return { chromium: { launch: async () => fakeBrowser } };
    if (name === 'dotenv') return { config: () => {} };
    if (name === 'dns/promises')
      return {
        lookup: async (host) => [
          {
            address: host === 'public.example' ? '93.184.216.34' : '127.0.0.1',
          },
        ],
      };
    if (name === 'proxy-chain')
      return {
        Server: class {
          constructor(options) {
            proxyCheck = options.prepareRequestFunction;
            this.port = 1234;
          }
          async listen() {}
        },
        RequestError: class extends Error {},
      };
    if (name === './company-handler.cjs')
      return upstreamRequire('/usr/src/app/company-handler.cjs');
    return upstreamRequire(name);
  },
};
vm.runInNewContext(compiled, context);
(async () => {
  const api = context.module.exports;
  await api.initializeBrowser();
  const bundle = await api.createContext(
    false,
    'ThreadplaneCompanyResearch/1.0'
  );
  for (const navigation of [false, true]) {
    let aborted = false,
      continued = false;
    await routeHandler(
      {
        abort: async () => {
          aborted = true;
        },
        continue: async () => {
          continued = true;
        },
      },
      {
        url: () => 'http://private.example/resource',
        isNavigationRequest: () => navigation,
      }
    );
    assert.equal(aborted, true);
    assert.equal(continued, false);
  }
  assert.equal(
    bundle.securityState.blockedNavigationRequestUrl,
    'http://private.example/resource'
  );
  let continued = false;
  await routeHandler(
    {
      abort: async () => assert.fail('public blocked'),
      continue: async () => {
        continued = true;
      },
    },
    { url: () => 'https://public.example/', isNavigationRequest: () => true }
  );
  assert.equal(continued, true);
  await api.startSSRFProxy();
  await assert.rejects(() => proxyCheck({ hostname: 'private.example' }));
  await proxyCheck({ hostname: 'public.example' });
  await assert.rejects(() => api.assertSafeTargetUrl('http://127.0.0.1/'));
  const document = await api.scrapePage(
    {
      goto: async (_url, options) => {
        assert.equal(options.waitUntil, 'domcontentloaded');
        return null;
      },
      content: async () => '<html>document ready before full asset load</html>',
    },
    'https://public.example/',
    'domcontentloaded',
    0,
    100,
    undefined,
    { blockedNavigationRequestUrl: null }
  );
  assert.equal(
    document.content,
    '<html>document ready before full asset load</html>'
  );
  await assert.rejects(
    () =>
      api.scrapePage(
        {
          goto: async () => {
            throw Error('navigation failed');
          },
        },
        'https://public.example/',
        'load',
        0,
        100,
        undefined,
        bundle.securityState
      ),
    /navigation to private/
  );
  console.log(
    'Patched upstream navigation, subresource and proxy private-address guards passed'
  );
})().catch((error) => {
  console.error('Upstream security check failed', error);
  process.exitCode = 1;
});
