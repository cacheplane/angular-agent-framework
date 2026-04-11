import { expect, test } from '@playwright/test';

test.describe('LangGraph Streaming Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4300');
    await page.waitForSelector('app-streaming', { state: 'attached' });
  });

  test('renders the chat interface', async ({ page }) => {
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Send');
  });

  test('sends a message and receives a streamed response', async ({ page }) => {
    // Type a message
    await page.fill('textarea[name="messageText"]', 'Say exactly: test response ok');

    // Click send
    await page.click('button[type="submit"]');

    // Wait for the AI response to appear
    await expect(page.locator('.chat-md').first()).toBeVisible({ timeout: 30000 });

    // The AI response should have content
    await expect(page.locator('.chat-md').first()).not.toBeEmpty({ timeout: 30000 });

    // The button should show Send again (not Streaming...)
    await expect(page.locator('button[type="submit"]')).toHaveText('Send', { timeout: 30000 });
  });
});
