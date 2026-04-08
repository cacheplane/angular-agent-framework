import { expect, test } from '@playwright/test';

test.describe('Render Repeat Loops Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4405');
    await page.waitForSelector('app-repeat-loops', { state: 'attached' });
  });

  test('renders the sidebar with list items', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('.item-list')).toBeVisible();
  });

  test('displays repeat loop heading and items', async ({ page }) => {
    await expect(page.locator('aside h3')).toHaveText('Repeat Loop Items');
    await expect(page.locator('aside pre')).toContainText('Task Alpha');
  });
});
