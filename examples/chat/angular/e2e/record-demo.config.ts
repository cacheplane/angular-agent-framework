// SPDX-License-Identifier: MIT
/**
 * Playwright config for recording the HITL demo clip from the canonical demo
 * shell. Mirrors `playwright.config.ts` — same aimock-backed global setup —
 * and adds video capture at the size the website expects.
 *
 * `testMatch` picks up only `*.record.ts`, so recording never runs in CI and
 * the e2e suite never records.
 *
 *   npx playwright test --config examples/chat/angular/e2e/record-demo.config.ts
 */
import { defineConfig } from '@playwright/test';

/** 1280x800, matching the existing homepage clips. */
const FRAME = { width: 1280, height: 800 };

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.record.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  use: {
    baseURL: 'http://localhost:4200',
    viewport: FRAME,
    video: { mode: 'on', size: FRAME },
  },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  outputDir: './.record-output',
});
