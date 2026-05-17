import { expect, test } from '@playwright/test';

test.describe('Deep Agents Planning Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4310');
    await page.waitForSelector('app-planning', { state: 'attached' });
  });

  test('renders the chat interface with plan sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=Ask a complex question to see the plan.')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'What are the steps to build a REST API?');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md').first()).not.toBeEmpty({ timeout: 30000 });
  });
});
