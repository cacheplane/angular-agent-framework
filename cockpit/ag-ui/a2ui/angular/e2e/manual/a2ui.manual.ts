// SPDX-License-Identifier: MIT
// Manual record-mode harness. Run against a live OpenAI key to capture new
// fixture entries into cockpit/ag-ui/a2ui/angular/e2e/fixtures/a2ui.json.
//
// Prerequisites:
//   1. Start the uvicorn backend in record mode (OPENAI_API_KEY set, no aimock):
//        cd cockpit/ag-ui/a2ui/python && uv run uvicorn src.server:app --port 5324
//   2. Start the Angular dev server:
//        npx nx serve cockpit-ag-ui-a2ui-angular
//   3. Run this harness via:
//        npx playwright test --config cockpit/ag-ui/a2ui/angular/e2e/playwright.config.ts \
//          manual/a2ui.manual.ts --headed
import { expect, test } from '@playwright/test';

test.describe('AG-UI A2UI Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4324');
    await page.waitForSelector('app-a2ui', { state: 'attached', timeout: 10000 });
  });

  test('renders the a2ui surface for a booking request', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'I want to fly LAX to JFK');
    await page.click('button[type="submit"]');
    await expect(page.locator('a2ui-surface')).toBeVisible({ timeout: 30000 });
  });
});
