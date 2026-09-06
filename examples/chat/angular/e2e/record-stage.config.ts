/**
 * Playwright config for the stage STILL recorder. Mirrors
 * `record-hero.config.ts` — the same aimock-backed global setup, so the demo
 * boots without an API key — and captures one still per beat from the
 * committed `public/stage-replay.json` (the replay itself needs no model).
 *
 * The stills are the website's non-pinned fallback: where the live stage
 * iframe is not pinned and scrubbed (phones, reduced motion, no JS), the site
 * shows these frames instead.
 *
 * `record-stage-fixture.record.ts` is NOT matched here on purpose: the fixture
 * is recorded against the real model via `record-stage-live.config.ts`.
 *
 *   npx playwright test --config examples/chat/angular/e2e/record-stage.config.ts record-stage-stills
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/record-stage-stills.record.ts',
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
