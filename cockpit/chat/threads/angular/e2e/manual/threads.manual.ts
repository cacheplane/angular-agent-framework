import { expect, test } from '@playwright/test';

test.describe('Chat Threads Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4506');
    await page.waitForSelector('app-threads', { state: 'attached' });
  });

  test('renders the chat interface with thread list sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Threads');
  });

  test('displays the thread list component', async ({ page }) => {
    await expect(page.locator('chat-thread-list')).toBeVisible();
  });
});
