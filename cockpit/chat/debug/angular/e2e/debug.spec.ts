import { expect, test } from '@playwright/test';

test.describe('Chat Debug Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4509');
    await page.waitForSelector('app-debug', { state: 'attached' });
  });

  test('renders the debug panel', async ({ page }) => {
    await expect(page.locator('chat-debug')).toBeVisible();
  });
});
