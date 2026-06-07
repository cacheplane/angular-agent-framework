// SPDX-License-Identifier: MIT
// Manual record-mode harness. Run against a live OpenAI key to capture new
// fixture entries into cockpit/ag-ui/json-render/angular/e2e/fixtures/json-render.json.
//
// Prerequisites:
//   1. Start the uvicorn backend in record mode (OPENAI_API_KEY set, no aimock):
//        cd cockpit/ag-ui/json-render/python && uv run uvicorn src.server:app --port 5323
//   2. Start the Angular dev server:
//        npx nx serve cockpit-ag-ui-json-render-angular
//   3. Run this harness via:
//        npx playwright test --config cockpit/ag-ui/json-render/angular/e2e/playwright.config.ts \
//          manual/json-render.manual.ts --headed
import { expect, test } from '@playwright/test';

test.describe('AG-UI JSON Render Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4323');
    await page.waitForSelector('app-json-render', { state: 'attached' });
  });

  test('renders the airline dashboard for a dashboard request', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'Show me a dashboard of airline operations.');
    await page.click('button[type="submit"]');
    await expect(page.locator('app-stat-card')).toBeVisible({ timeout: 30000 });
  });
});
