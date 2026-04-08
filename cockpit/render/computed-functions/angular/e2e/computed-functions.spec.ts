import { expect, test } from '@playwright/test';

test.describe('Render Computed Functions Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4406');
    await page.waitForSelector('app-computed-functions', { state: 'attached' });
  });

  test('renders the sidebar with computed values', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('.computed-values')).toBeVisible();
  });

  test('displays computed functions heading', async ({ page }) => {
    await expect(page.locator('aside h3')).toHaveText('Computed Values');
    await expect(page.locator('aside pre')).toContainText('formatDate');
  });
});
