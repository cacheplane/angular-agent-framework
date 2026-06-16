// SPDX-License-Identifier: MIT
// Manual record-mode harness. Run against a live OpenAI key to capture new
// fixture entries into cockpit/ag-ui/subagents/angular/e2e/fixtures/subagents.json.
//
// Prerequisites:
//   1. Start the uvicorn backend in record mode (OPENAI_API_KEY set, no aimock):
//        cd cockpit/ag-ui/subagents/python && uv run uvicorn src.server:app --port 5326
//   2. Start the Angular dev server:
//        npx nx serve cockpit-ag-ui-subagents-angular --port 4326
//   3. Run this harness via:
//        npx playwright test --config cockpit/ag-ui/subagents/angular/e2e/playwright.config.ts \
//          manual/subagents.manual.ts --headed
import { expect, test } from '@playwright/test';

test.describe('AG-UI Subagents Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4326');
    await page.waitForSelector('app-subagents', { state: 'attached' });
  });

  test('renders the chat interface', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
  });

  test('delegates to a research subagent and surfaces a summary', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'Plan a trip from LAX to JFK');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md').first()).not.toBeEmpty({ timeout: 30000 });
  });
});
