/**
 * Playwright config for the hero POSTER recorders. Mirrors
 * `record-demo.config.ts` — same aimock-backed global setup, so the demo
 * boots without an API key — but captures stills, not a clip.
 *
 * `record-hero-fixture.record.ts` also matches `testMatch`, but must NOT be
 * run through this config: the fixture is recorded against the real model via
 * `record-hero-live.config.ts`, because the post-approval turn now executes
 * real tools and aimock cannot stage that sequence.
 *
 *   npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-poster
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/record-hero-*.record.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 240_000,
  use: {
    baseURL: 'http://localhost:4200',
    viewport: { width: 1200, height: 720 },
  },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  outputDir: './.record-output',
});
