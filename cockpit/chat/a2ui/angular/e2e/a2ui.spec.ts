import { expect, test } from '@playwright/test';

test.describe('A2UI Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4511');
    await page.waitForSelector('app-a2ui', { state: 'attached' });
  });

  test('renders the chat interface', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
  });
});
