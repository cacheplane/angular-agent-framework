import { expect, test } from '@playwright/test';

test.describe('Render Element Rendering Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4402');
    await page.waitForSelector('app-element-rendering', { state: 'attached' });
  });

  test('renders spec picker and timeline', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Parent + Children' })).toBeVisible();
    await expect(page.locator('streaming-timeline')).toBeVisible();
  });

  test('shows streaming JSON pane', async ({ page }) => {
    await expect(page.locator('pre')).toBeVisible();
  });
});
