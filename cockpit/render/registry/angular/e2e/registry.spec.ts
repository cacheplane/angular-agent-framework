import { expect, test } from '@playwright/test';

test.describe('Render Registry Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4404');
    await page.waitForSelector('app-registry', { state: 'attached' });
  });

  test('renders spec picker and timeline', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Basic Types' })).toBeVisible();
    await expect(page.locator('streaming-timeline')).toBeVisible();
  });

  test('shows streaming JSON pane', async ({ page }) => {
    await expect(page.locator('pre')).toBeVisible();
  });
});
