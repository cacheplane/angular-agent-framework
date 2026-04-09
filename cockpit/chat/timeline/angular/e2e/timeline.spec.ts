import { expect, test } from '@playwright/test';

test.describe('Chat Timeline Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4507');
    await page.waitForSelector('app-timeline', { state: 'attached' });
  });

  test('renders the chat interface with timeline sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Timeline');
  });

  test('displays the timeline slider', async ({ page }) => {
    await expect(page.locator('chat-timeline-slider')).toBeVisible();
  });
});
