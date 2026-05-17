import { expect, test } from '@playwright/test';

test.describe('Chat Interrupts Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4503');
    await page.waitForSelector('app-interrupts', { state: 'attached' });
  });

  test('renders the chat interface with interrupt panel sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Interrupt Panel');
  });

  test('displays the stream status', async ({ page }) => {
    await expect(page.locator('aside')).toContainText('Stream Status');
  });
});
