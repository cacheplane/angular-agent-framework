import { describe, expect, it } from 'vitest';
import { createWebsitePlaywrightConfig } from '../playwright.config';

describe('Website Playwright configuration', () => {
  it('never starts local servers for production platform smoke', () => {
    const config = createWebsitePlaywrightConfig({
      PRODUCTION_SMOKE: 'true',
    });

    expect(config.webServer).toBeUndefined();
    expect(config.testIgnore).toBeUndefined();
  });

  it('starts both local servers and excludes platform smoke for ordinary E2E', () => {
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
    ]);
    expect(config.testIgnore).toBe('**/platform-production-smoke.spec.ts');
    expect(config.use).toEqual(
      expect.objectContaining({ baseURL: 'http://127.0.0.1:4308' })
    );
  });
});
