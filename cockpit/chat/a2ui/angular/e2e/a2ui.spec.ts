import { expect, test } from '@playwright/test';

test.describe('A2UI Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4511');
    await page.waitForSelector('app-a2ui', { state: 'attached', timeout: 10000 });
  });

  test('renders the chat interface', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible({ timeout: 5000 });
  });

  test('displays input and send button', async ({ page }) => {
    await expect(page.locator('textarea[name="messageText"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 5000 });
  });
});
