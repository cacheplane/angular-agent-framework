import { expect, test } from '@playwright/test';

test.describe('Chat Theming Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4510');
    await page.waitForSelector('app-theming', { state: 'attached' });
  });

  test('renders the chat interface with theme picker sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Theme Picker');
  });

  test('displays theme buttons', async ({ page }) => {
    await expect(page.locator('aside button')).toHaveCount(4);
    await expect(page.locator('aside')).toContainText('Dark');
    await expect(page.locator('aside')).toContainText('Light');
    await expect(page.locator('aside')).toContainText('Ocean');
    await expect(page.locator('aside')).toContainText('Forest');
  });

  test('displays CSS variable list', async ({ page }) => {
    await expect(page.locator('aside')).toContainText('--chat-bg');
    await expect(page.locator('aside')).toContainText('--chat-accent');
  });
});
