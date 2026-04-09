import { expect, test } from '@playwright/test';

test.describe('Render State Management Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4403');
    await page.waitForSelector('app-state-management', { state: 'attached' });
  });

  test('renders spec picker and timeline', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'User Profile' })).toBeVisible();
    await expect(page.locator('streaming-timeline')).toBeVisible();
  });

  test('shows streaming JSON pane', async ({ page }) => {
    await expect(page.locator('pre')).toBeVisible();
  });
});
