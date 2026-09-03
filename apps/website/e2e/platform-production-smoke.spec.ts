import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRuntimeParentOrigins } from '@threadplane/cockpit-runtime-bridge';
import {
  cockpitManifest,
  getCanonicalWebsiteWorkspaceHref,
  getWorkspaceDestinationPath,
  resolveLegacyPath,
  resolveLegacyRequestMode,
} from '@threadplane/cockpit-registry';

/**
 * Production platform smoke: verifies the Website, legacy Cockpit redirects,
 * deployed examples, canonical demo, and shared runtimes as one product.
 *
 * Requires:
 *   COCKPIT_URL - e.g. https://cockpit.threadplane.ai
 *   EXAMPLES_URL - e.g. https://examples.threadplane.ai
 *   OPENAI_API_KEY - optional; enables the single live-provider canary
 *
 * Run:
 *   PRODUCTION_SMOKE=true COCKPIT_URL=https://cockpit.threadplane.ai \
 *   EXAMPLES_URL=https://examples.threadplane.ai \
 *   npx playwright test apps/website/e2e/platform-production-smoke.spec.ts
 */

const COCKPIT_URL =
  process.env['COCKPIT_URL'] ?? 'https://cockpit.threadplane.ai';
const EXAMPLES_URL =
  process.env['EXAMPLES_URL'] ?? 'https://examples.threadplane.ai';
const DEMO_URL = process.env['DEMO_URL'] ?? 'https://demo.threadplane.ai';
const WEBSITE_URL = process.env['WEBSITE_URL'] ?? 'https://threadplane.ai';
// Playwright transpiles specs to CJS, so `import.meta.url` here compiles to a
// `require` the ESM-loaded output cannot resolve and the whole file fails to
// load. `__dirname` is what the emitted module actually has. Don't "modernise"
// this back to import.meta.url.
const runtimeParentOriginSource = JSON.parse(
  readFileSync(join(__dirname, '../../../runtime-parent-origins.json'), 'utf8')
) as { readonly baseOrigins?: unknown };
const runtimeParentPreviewOrigins = (
  process.env['RUNTIME_PARENT_PREVIEW_ORIGINS'] ?? ''
)
  .split(/\r?\n/)
  .filter(Boolean);
const baseRuntimeParentOrigins = validateRuntimeParentOrigins(
  runtimeParentOriginSource.baseOrigins
);
const expectedRuntimeParentOrigins = validateRuntimeParentOrigins([
  ...(baseRuntimeParentOrigins ?? []),
  ...runtimeParentPreviewOrigins,
]);
if (baseRuntimeParentOrigins === null || expectedRuntimeParentOrigins === null) {
  throw new Error('Invalid runtime parent origin smoke policy');
}

const CHAT_CAPABILITIES = [
  'langgraph/streaming',
  'langgraph/persistence',
  'langgraph/interrupts',
  'langgraph/memory',
  'langgraph/durable-execution',
  'langgraph/subgraphs',
  'langgraph/time-travel',
  'langgraph/deployment-runtime',
  'deep-agents/planning',
  'deep-agents/filesystem',
  'deep-agents/subagents',
  'deep-agents/memory',
  'deep-agents/skills',
  'chat/tool-calls',
  'chat/subagents',
  'chat/threads',
  'chat/timeline',
  'chat/generative-ui',
  'chat/theming',
  'chat/a2ui',
] as const;

const CHAT_PRIMITIVE_CAPABILITIES = [
  'chat/messages',
  'chat/input',
  'chat/interrupts',
  'chat/debug',
] as const;

const CHAT_PRIMITIVE_READY_SELECTORS: Record<
  (typeof CHAT_PRIMITIVE_CAPABILITIES)[number],
  string
> = {
  'chat/messages': 'chat-message-list',
  'chat/input': 'chat-input',
  'chat/interrupts': 'chat-interrupt-panel',
  'chat/debug': 'chat-debug',
};

const RENDER_CAPABILITIES = [
  'render/spec-rendering',
  'render/element-rendering',
  'render/state-management',
  'render/registry',
  'render/repeat-loops',
  'render/computed-functions',
] as const;

/**
 * Driven off the capability registry so a newly added AG-UI topic is covered
 * automatically instead of silently going unasserted — the previous two
 * hardcoded checks covered interrupts and streaming only.
 *
 * Scoped to the AG-UI product: `runtimes` capabilities share the Railway
 * runtime but are not yet in the examples route table, so they have no
 * /ag-ui/<topic>/ URL to assert against.
 */
const AG_UI_TOPICS = [
  ...new Set(
    cockpitManifest
      .filter(
        (entry) => entry.product === 'ag-ui' && entry.runtimeAdapter === 'ag-ui'
      )
      .map((entry) => entry.topic)
  ),
].sort();

const SEND_RECEIVE_TIMEOUT_MS = 30_000;
const WEBSITE_DESTINATIONS = [
  ...new Set(cockpitManifest.map(getWorkspaceDestinationPath)),
].sort();

const expectedRedirect = (legacyPath: string): string => {
  const resolution = resolveLegacyPath(legacyPath);
  if (!resolution) throw new Error(`Expected registry path ${legacyPath}`);
  const mode = resolveLegacyRequestMode(undefined, resolution);
  return new URL(
    getCanonicalWebsiteWorkspaceHref(resolution, mode),
    `${WEBSITE_URL}/`
  ).toString();
};

const docsBacked = cockpitManifest.find((entry) =>
  getWorkspaceDestinationPath(entry).startsWith('/docs/')
);
const workspaceOnly = cockpitManifest.find((entry) =>
  getWorkspaceDestinationPath(entry).startsWith('/workspace/')
);
if (!docsBacked || !workspaceOnly) {
  throw new Error('Production smoke requires Docs-backed and workspace routes');
}

const COCKPIT_REDIRECT_CASES = [
  {
    name: 'root production redirect',
    path: '/',
    status: 308,
    location: expectedRedirect(
      '/langgraph/core-capabilities/streaming/overview/python'
    ),
  },
  {
    name: 'Docs-backed production redirect',
    path: docsBacked.legacyPath,
    status: 308,
    location: expectedRedirect(docsBacked.legacyPath),
  },
  {
    name: 'workspace-only production redirect',
    path: workspaceOnly.legacyPath,
    status: 308,
    location: expectedRedirect(workspaceOnly.legacyPath),
  },
  {
    name: 'unknown production 404',
    path: '/unknown',
    status: 404,
    location: undefined,
  },
  {
    name: 'favicon production redirect',
    path: '/favicon.ico',
    status: 308,
    location: '/icon.svg',
  },
] as const;

test.describe('Production: registry-owned Website destinations load', () => {
  for (const destination of WEBSITE_DESTINATIONS) {
    test(`${destination} is reachable`, async ({ request }) => {
      const response = await request.get(
        new URL(destination, WEBSITE_URL).toString()
      );

      expect(response.status()).toBeLessThan(400);
    });
  }
});

test.describe('Production: Angular chat example apps load', () => {
  for (const cap of CHAT_CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const response = await page.goto(`${EXAMPLES_URL}/${cap}/`, {
        timeout: 15_000,
      });
      expect(response?.status()).toBe(200);
      await expect(page.locator('chat')).toBeVisible({ timeout: 10_000 });
    });
  }
});

test.describe('Production: Angular chat primitive apps load', () => {
  for (const cap of CHAT_PRIMITIVE_CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const response = await page.goto(`${EXAMPLES_URL}/${cap}/`, {
        timeout: 15_000,
      });
      expect(response?.status()).toBe(200);
      await expect(
        page.locator(CHAT_PRIMITIVE_READY_SELECTORS[cap])
      ).toBeAttached({
        timeout: 10_000,
      });
    });
  }
});

test.describe('Production: render example apps load', () => {
  for (const cap of RENDER_CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const response = await page.goto(`${EXAMPLES_URL}/${cap}/`, {
        timeout: 15_000,
      });
      expect(response?.status()).toBe(200);
      await expect(page.locator('body')).not.toBeEmpty({ timeout: 10_000 });
    });
  }
});

test.describe('Production: legacy Cockpit redirect service', () => {
  for (const smokeCase of COCKPIT_REDIRECT_CASES) {
    test(smokeCase.name, async ({ request }) => {
      const response = await request.get(`${COCKPIT_URL}${smokeCase.path}`, {
        maxRedirects: 0,
      });

      expect(response.status()).toBe(smokeCase.status);
      expect(response.headers()['location']).toBe(smokeCase.location);
    });
  }
});

test.describe('Production: unified runtime embedding policy', () => {
  test('assembled children ship the exact parent/referrer policy without an X-Frame-Options conflict', async ({
    request,
  }) => {
    const response = await request.get(`${EXAMPLES_URL}/langgraph/streaming/`);
    const headers = response.headers();
    const policy = headers['content-security-policy'];
    const frameAncestors = policy
      ?.split(';')
      .find((directive) => directive.trim().startsWith('frame-ancestors'));

    expect(response.status()).toBe(200);
    const actualFrameAncestors = frameAncestors
      ?.trim()
      .split(/\s+/)
      .slice(1);
    const validatedFrameAncestors = validateRuntimeParentOrigins(
      actualFrameAncestors
    );
    expect(validatedFrameAncestors).not.toBeNull();
    if (runtimeParentPreviewOrigins.length > 0) {
      expect(validatedFrameAncestors).toEqual(expectedRuntimeParentOrigins);
    } else {
      for (const origin of baseRuntimeParentOrigins) {
        expect(validatedFrameAncestors).toContain(origin);
      }
    }
    expect(policy).toContain(
      "connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://[::1]:*"
    );
    expect(frameAncestors).not.toContain('*');
    expect(frameAncestors).not.toContain('cockpit.threadplane.ai');
    expect(headers['referrer-policy']).toBe('origin');
    expect(headers['x-frame-options']).toBeUndefined();
  });

  test('production begins Shared-only and sends only the Website origin as iframe referrer', async ({
    page,
  }) => {
    let iframeReferrer: string | undefined;
    page.on('request', (request) => {
      if (request.resourceType() !== 'document') return;
      if (!request.url().startsWith(`${EXAMPLES_URL}/langgraph/streaming`)) {
        return;
      }
      iframeReferrer = request.headers()['referer'];
    });

    await page.goto(`${WEBSITE_URL}/docs/langgraph/guides/streaming?mode=run`);
    const controls = page.locator('[data-cockpit-desktop-navigation]');
    await controls
      .getByRole('button', { name: 'Settings', exact: true })
      .click();
    await expect(
      page.locator('[data-runtime-target-settings]')
    ).toHaveAttribute('data-runtime-target-kind', 'shared');
    await expect(
      page.locator('[data-runtime-target-settings]')
    ).not.toContainText('Custom target active');
    await expect
      .poll(() => iframeReferrer)
      .toBe(new URL(WEBSITE_URL).origin + '/');
  });
});

test.describe('Production: canonical demo sends runtime telemetry', () => {
  test.skip(() => !process.env['OPENAI_API_KEY'], 'Requires OPENAI_API_KEY');

  test('demo chat sends and receives a message with runtime lifecycle telemetry', async ({
    page,
  }) => {
    test.setTimeout(75_000);
    const telemetryPayloads: Array<{ event?: unknown; properties?: unknown }> =
      [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.includes('/api/ingest')) return;
      const body = request.postData();
      if (!body) return;
      try {
        telemetryPayloads.push(JSON.parse(body));
      } catch {
        // Ignore malformed non-JSON requests; assertions below require valid telemetry payloads.
      }
    });

    await page.goto(`${DEMO_URL}/embed`, { timeout: 15_000 });
    await expect(page.locator('chat')).toBeVisible({ timeout: 10_000 });

    await page.locator('textarea[name="messageText"]').fill('hello');
    await page.getByRole('button', { name: /send message/i }).click();

    await expect(
      page.locator('chat-message[data-role="assistant"]').last()
    ).toBeVisible({
      timeout: SEND_RECEIVE_TIMEOUT_MS,
    });

    for (const event of [
      'tplane:runtime_request_created',
      'tplane:stream_started',
      'tplane:stream_ended',
    ]) {
      await expect
        .poll(
          () =>
            telemetryPayloads.some(
              (payload) =>
                payload.event === event &&
                typeof payload.properties === 'object' &&
                payload.properties !== null &&
                (payload.properties as Record<string, unknown>)['transport'] ===
                  'langgraph' &&
                (payload.properties as Record<string, unknown>)['surface'] ===
                  'canonical_demo'
            ),
          { timeout: 10_000 }
        )
        .toBe(true);
    }

    expect(JSON.stringify(telemetryPayloads)).not.toMatch(
      /messages|threadId|assistantId|apiUrl/
    );
  });
});

test.describe('AG-UI Railway runtime', () => {
  const RAILWAY_URL =
    process.env['AG_UI_RAILWAY_URL'] ??
    'https://ag-ui-dev-production.up.railway.app';

  test('healthcheck /ok responds 200', async ({ request }) => {
    const res = await request.get(`${RAILWAY_URL}/ok`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  for (const topic of AG_UI_TOPICS) {
    test(`ag-ui/${topic} page is reachable`, async ({ page }) => {
      const res = await page.goto(`${EXAMPLES_URL}/ag-ui/${topic}/`, {
        timeout: 15_000,
      });
      expect(res?.status()).toBeLessThan(400);
    });

    /**
     * Page reachability is not enough, and /ok is not either. A misconfigured
     * agent URL, a missing proxy route, or a Railway image that crashed on
     * boot all leave a healthy 200 index.html and a healthy /ok while the
     * runtime endpoint is dead — Railway keeps serving the last good image
     * when a new one fails to boot. That combination hid a broken
     * /agent/subagents for two and a half months.
     *
     * POSTing an empty body is a deliberate, token-free canary: the FastAPI
     * request model rejects it before any graph or LLM call runs.
     *   422 → healthy (proxy routed, internal token accepted, topic mounted)
     *   404 → topic missing from the deployed image, or no proxy route
     *   401 → AG_UI_INTERNAL_TOKEN mismatch between the proxy and Railway
     */
    test(`ag-ui/${topic} agent endpoint is routed and mounted`, async ({
      request,
    }) => {
      const res = await request.post(`${EXAMPLES_URL}/ag-ui/${topic}/agent`, {
        headers: { Origin: EXAMPLES_URL, 'content-type': 'application/json' },
        data: {},
      });
      const status = res.status();
      expect(
        status,
        `POST /ag-ui/${topic}/agent returned ${status}; 404 means the deployed image has no /agent/${topic} route (check the Railway build/boot log) or the Vercel proxy route is missing`
      ).not.toBe(404);
      expect(
        status,
        `POST /ag-ui/${topic}/agent returned 401 — AG_UI_INTERNAL_TOKEN mismatch between the Vercel proxy and Railway`
      ).not.toBe(401);
      expect(status).toBeLessThan(500);
    });
  }
});

/**
 * Regression guard for the examples LangGraph proxy hardening
 * (scripts/examples-middleware.ts → createProxyHandler). These assert the
 * origin allowlist and body-size cap stay live after future redeploys.
 *
 * Both checks are rejected by the proxy BEFORE the rate-limit gate and before
 * any forward to LangGraph Cloud, so they burn no LLM tokens and consume no
 * rate-limit budget. The rate-limit (429) path is deliberately NOT asserted
 * here — it is stateful/time-windowed and would race with real traffic.
 */
test.describe('examples langgraph proxy hardening', () => {
  const streamPath = () =>
    `${EXAMPLES_URL}/api/threads/00000000-0000-0000-0000-000000000000/runs/stream`;
  const runBody = { assistant_id: 'streaming', input: { messages: [] } };

  test('rejects a forbidden Origin with 403', async ({ request }) => {
    const res = await request.post(streamPath(), {
      headers: {
        Origin: 'https://evil.example.com',
        'content-type': 'application/json',
      },
      data: runBody,
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'origin_not_allowed' });
  });

  test('rejects an oversized body with 413', async ({ request }) => {
    const res = await request.post(streamPath(), {
      headers: { Origin: EXAMPLES_URL, 'content-type': 'application/json' },
      data: { assistant_id: 'streaming', input: { blob: 'A'.repeat(70_000) } },
    });
    expect(res.status()).toBe(413);
    expect(await res.json()).toMatchObject({ error: 'payload_too_large' });
  });
});

test.describe('AG-UI demo (ag-ui.threadplane.ai)', () => {
  const DEMO = process.env['AG_UI_DEMO_URL'] ?? 'https://ag-ui.threadplane.ai';

  test('demo SPA is reachable', async ({ page }) => {
    const res = await page.goto(`${DEMO}/`);
    expect(res?.status()).toBeLessThan(400);
  });

  test('forbidden origin to /agent is rejected with 403', async ({
    request,
  }) => {
    const res = await request.post(`${DEMO}/agent`, {
      headers: {
        Origin: 'https://evil.example.com',
        'content-type': 'application/json',
      },
      data: {},
    });
    expect(res.status()).toBe(403);
  });
});
