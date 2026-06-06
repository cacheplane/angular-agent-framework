// SPDX-License-Identifier: MIT
// Manual record-mode harness. Run against a live OpenAI key to capture new
// fixture entries into cockpit/ag-ui/tool-views/angular/e2e/fixtures/tool-views.json.
//
// Prerequisites:
//   1. Start the uvicorn backend in record mode (OPENAI_API_KEY set, no aimock):
//        cd cockpit/ag-ui/tool-views/python && uv run uvicorn src.server:app --port 5322
//   2. Start the Angular dev server:
//        npx nx serve cockpit-ag-ui-tool-views-angular
//   3. Run this harness via:
//        npx playwright test --config cockpit/ag-ui/tool-views/angular/e2e/playwright.config.ts \
//          manual/tool-views.manual.ts --headed
import { expect, test } from '@playwright/test';

test.describe('AG-UI Tool Views Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4322');
    await page.waitForSelector('app-tool-views', { state: 'attached' });
  });

  test('renders the weather card for a weather question', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', "What's the weather in San Francisco?");
    await page.click('button[type="submit"]');
    await expect(page.locator('app-weather-card')).toBeVisible({ timeout: 30000 });
  });
});
