// SPDX-License-Identifier: MIT
/**
 * Playwright config for recording the HITL demo clip. Mirrors
 * `playwright.config.ts` — same aimock-backed global setup — and adds video
 * capture at the size the website expects.
 *
 * Separate from the test config on purpose: `testMatch` here picks up only
 * `*.record.ts`, so recording never runs in CI and the e2e suite never records.
 *
 *   npx playwright test --config cockpit/chat/interrupts/angular/e2e/record-demo.config.ts
 */
import { defineConfig, devices } from '@playwright/test';
import { portsFor } from '../../../../../cockpit/ports.mjs';

const { angular: angularPort } = portsFor('cockpit-chat-interrupts-angular');

/** 1280x800, matching the existing homepage clips. */
const FRAME = { width: 1280, height: 800 };

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.record.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${angularPort}`,
    viewport: FRAME,
    video: { mode: 'on', size: FRAME },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: FRAME } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('../../../../../libs/e2e-harness/src/global-teardown'),
  outputDir: './.record-output',
});
