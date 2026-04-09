import { expect, test } from '@playwright/test';

test.describe('Render Repeat Loops Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4405');
    await page.waitForSelector('app-repeat-loops', { state: 'attached' });
  });

  test('renders spec picker and timeline', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Simple List' })).toBeVisible();
    await expect(page.locator('streaming-timeline')).toBeVisible();
  });

  test('shows streaming JSON pane', async ({ page }) => {
    await expect(page.locator('pre')).toBeVisible();
  });
});
