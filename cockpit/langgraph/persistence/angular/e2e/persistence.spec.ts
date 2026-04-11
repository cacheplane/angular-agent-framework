import { expect, test } from '@playwright/test';

test.describe('LangGraph Persistence Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4301');
    await page.waitForSelector('app-persistence', { state: 'attached' });
  });

  test('renders the chat interface with thread sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=+ New Thread')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'hello');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md').first()).not.toBeEmpty({ timeout: 30000 });
  });
});
