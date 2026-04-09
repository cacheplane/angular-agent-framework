import { expect, test } from '@playwright/test';

test.describe('Render Spec Rendering Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4401');
    await page.waitForSelector('app-spec-rendering', { state: 'attached' });
  });

  test('renders spec picker and timeline', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Heading + Text' })).toBeVisible();
    await expect(page.locator('streaming-timeline')).toBeVisible();
  });

  test('shows streaming JSON pane', async ({ page }) => {
    await expect(page.locator('pre')).toBeVisible();
  });
});
