import { expect, test } from '@playwright/test';

test.describe('Render Element Rendering Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4402');
    await page.waitForSelector('app-element-rendering', { state: 'attached' });
  });

  test('renders the chat interface and toggle button', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('button.toggle-visibility')).toBeVisible();
  });

  test('displays nested elements in the sidebar', async ({ page }) => {
    await expect(page.locator('aside h3')).toHaveText('Nested Elements');
    await expect(page.locator('aside pre')).toContainText('container');
  });
});
