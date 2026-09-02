import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWebsitePlaywrightConfig } from '../playwright.config';

describe('Website Playwright configuration', () => {
  it('derives the production embedding assertion from the authoritative origin source', () => {
    const smoke = readFileSync(
      resolve(__dirname, '../e2e/platform-production-smoke.spec.ts'),
      'utf8'
    );

    expect(smoke).toContain('runtime-parent-origins.json');
    expect(smoke).toContain('validateRuntimeParentOrigins');
    expect(smoke).toContain('RUNTIME_PARENT_PREVIEW_ORIGINS');
    expect(smoke).not.toContain(
      'frame-ancestors https://threadplane.ai http://localhost:3000'
    );
  });

  it('audits success-path Activity, diagnostics, analytics payloads, and browser logs without printing sensitive values', () => {
    const coverage = readFileSync(
      resolve(__dirname, '../e2e/custom-runtime-targets.spec.ts'),
      'utf8'
    );

    expect(coverage).toContain("page.on('console'");
    expect(coverage).toContain("page.on('pageerror'");
    expect(coverage).toContain("page.on('request'");
    expect(coverage).toContain('request.postData()');
    expect(coverage).toContain('navigator.clipboard.readText()');
    expect(coverage).toContain("name: 'Activity'");
    expect(coverage).toContain("name: 'Copy diagnostics'");
    expect(coverage).toContain('assertSensitiveValuesAbsent');
    expect(coverage).not.toContain('expect(activityText).not.toContain');
    expect(coverage).not.toContain('expect(diagnosticsText).not.toContain');
  });

  it('never starts local servers for production platform smoke', () => {
    const config = createWebsitePlaywrightConfig({
      PRODUCTION_SMOKE: 'true',
    });

    expect(config.webServer).toBeUndefined();
    expect(config.testIgnore).toBeUndefined();
  });

  it('starts Website, all migrated runtime apps under custom-runtime E2E, and the fixture', () => {
    const config = createWebsitePlaywrightConfig({});

    expect(config.webServer).toEqual([
      expect.objectContaining({
        command: expect.stringContaining('next dev apps/website'),
        url: 'http://127.0.0.1:4308',
      }),
      expect.objectContaining({
        command: expect.stringContaining(
          'cockpit-langgraph-streaming-angular:serve:cockpit'
        ),
        url: 'http://localhost:4300',
      }),
      expect.objectContaining({
        command: expect.stringContaining(
          'cockpit-ag-ui-streaming-angular:serve:cockpit'
        ),
        url: 'http://localhost:4321',
      }),
      expect.objectContaining({
        command: expect.stringContaining(
          'cockpit-chat-threads-angular:serve:cockpit'
        ),
        url: 'http://localhost:4506',
      }),
      expect.objectContaining({
        command: expect.stringContaining('custom-runtime-server.ts'),
        url: 'http://127.0.0.1:4399/health',
      }),
    ]);
    expect(config.testIgnore).toEqual([
      '**/platform-production-smoke.spec.ts',
      '**/custom-runtime-bfcache.spec.ts',
    ]);
    expect(config.use).toEqual(
      expect.objectContaining({ baseURL: 'http://127.0.0.1:4308' })
    );
    expect(config.use).toEqual(
      expect.objectContaining({ trace: 'off', video: 'off' })
    );
  });

  it('uses the production Website server and only the real BFCache test for lifecycle coverage', () => {
    const config = createWebsitePlaywrightConfig({
      CUSTOM_RUNTIME_BFCACHE: 'true',
    });
    const webServers = Array.isArray(config.webServer) ? config.webServer : [];

    expect(config.testMatch).toBe('**/custom-runtime-bfcache.spec.ts');
    expect(webServers[0]?.command).toContain(
      'nx build website --configuration=production --skip-nx-cache'
    );
    expect(webServers[0]?.command).toContain(
      'nx serve website --configuration=production'
    );
    expect(webServers[0]?.timeout).toBe(180_000);
    expect(webServers[1]?.command).toContain(
      'build cockpit-langgraph-streaming-angular --configuration=cockpit'
    );
    expect(webServers).toHaveLength(3);
    expect(config.projects?.[0]?.use?.launchOptions).toEqual({
      channel: 'chromium',
      ignoreDefaultArgs: ['--disable-back-forward-cache'],
      args: ['--enable-features=BackForwardCache'],
    });
  });
});
