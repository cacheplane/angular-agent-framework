// SPDX-License-Identifier: MIT
// Manual record-mode harness. Run against a live OpenAI key to capture new
// fixture entries into cockpit/ag-ui/interrupts/angular/e2e/fixtures/interrupts.json.
//
// Prerequisites:
//   1. Start the uvicorn backend in record mode (OPENAI_API_KEY set, no aimock):
//        cd cockpit/ag-ui/interrupts/python && uv run uvicorn src.server:app --port 5320
//   2. Start the Angular dev server:
//        npx nx serve cockpit-ag-ui-interrupts-angular --port 4320
//   3. Run this harness via:
//        npx playwright test --config cockpit/ag-ui/interrupts/angular/e2e/playwright.config.ts \
//          manual/interrupts.manual.ts --headed
import { expect, test } from '@playwright/test';

test.describe('AG-UI Interrupts Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4320');
    await page.waitForSelector('app-interrupts', { state: 'attached' });
  });

  test('renders the chat interface with approvals sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=No pending approvals')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'hello');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md').first()).not.toBeEmpty({ timeout: 30000 });
  });
});
