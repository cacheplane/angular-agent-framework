// SPDX-License-Identifier: MIT
/**
 * Playwright config for recording the hero walkthrough fixture. Mirrors
 * `record-demo.config.ts` — same aimock-backed global setup — but captures no
 * video: the artifact is `public/hero-replay.json`, not a clip.
 *
 * `testMatch` picks up only the hero record script, so recording never runs in
 * CI and the e2e suite never records.
 *
 *   npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-fixture
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
