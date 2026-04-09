import { expect, test } from '@playwright/test';

test.describe('Render Computed Functions Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4406');
    await page.waitForSelector('app-computed-functions', { state: 'attached' });
  });

  test('renders spec picker and timeline', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Text Transforms' })).toBeVisible();
    await expect(page.locator('streaming-timeline')).toBeVisible();
  });

  test('shows streaming JSON pane', async ({ page }) => {
    await expect(page.locator('pre')).toBeVisible();
  });
});
