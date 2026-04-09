import { expect, test } from '@playwright/test';

test.describe('Chat Generative UI Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4508');
    await page.waitForSelector('app-generative-ui', { state: 'attached' });
  });

  test('renders the chat interface with generative UI sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Generative UI');
  });

  test('displays how it works description', async ({ page }) => {
    await expect(page.locator('aside')).toContainText('render specs');
  });
});
