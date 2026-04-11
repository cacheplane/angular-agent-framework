import { expect, test } from '@playwright/test';

test.describe('LangGraph Deployment Runtime Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4307');
    await page.waitForSelector('app-deployment-runtime', { state: 'attached' });
  });

  test('renders the chat interface with deployment sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible();
    await expect(page.locator('text=Deployment')).toBeVisible();
  });

  test('sends a message and receives a response', async ({ page }) => {
    await page.fill('textarea[name="messageText"]', 'hello');
    await page.click('button[type="submit"]');
    await expect(page.locator('.chat-md')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.chat-md')).not.toBeEmpty({ timeout: 30000 });
  });
});
