import { expect, test } from '@playwright/test';

test.describe('Render State Management Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4403');
    await page.waitForSelector('app-state-management', { state: 'attached' });
  });

  test('renders the sidebar with state display', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('.state-display')).toBeVisible();
  });

  test('displays current state values', async ({ page }) => {
    await expect(page.locator('aside h3')).toHaveText('State Management');
    await expect(page.locator('aside pre')).toContainText('Alice');
  });
});
