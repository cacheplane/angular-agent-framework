// SPDX-License-Identifier: MIT
// Manual record-mode harness. Run against a live OpenAI key to capture new
// fixture entries into cockpit/ag-ui/streaming/angular/e2e/fixtures/streaming.json.
//
// Prerequisites:
//   1. Start the uvicorn backend in record mode (OPENAI_API_KEY set, no aimock):
//        cd cockpit/ag-ui/streaming/python && uv run uvicorn src.server:app --port 5321
//   2. Start the Angular dev server:
//        npx nx serve cockpit-ag-ui-streaming-angular --port 4321
//   3. Run this harness via:
//        npx playwright test --config cockpit/ag-ui/streaming/angular/e2e/playwright.config.ts \
//          manual/streaming.manual.ts --headed
import { expect, test } from '@playwright/test';

test.describe('AG-UI Streaming Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4321');
    await page.waitForSelector('app-streaming', { state: 'attached' });
  });

  test('renders the chat interface', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
  });

  test('sends a message and receives a streamed response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'Tell me one quick fact about Angular signals in two sentences.');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md').first()).not.toBeEmpty({ timeout: 30000 });
  });
});
