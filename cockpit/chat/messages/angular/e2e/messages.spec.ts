import { expect, test } from '@playwright/test';

test.describe('Chat Messages Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4501');
    await page.waitForSelector('app-messages', { state: 'attached' });
  });

  test('renders the chat messages interface with primitives sidebar', async ({ page }) => {
    await expect(page.locator('chat-messages')).toBeVisible();
    await expect(page.locator('chat-input')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Primitives Used');
  });

  test('displays the input component', async ({ page }) => {
    await expect(page.locator('chat-input')).toBeVisible();
  });
});
