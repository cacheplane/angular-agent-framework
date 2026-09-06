import { expect, test } from '@playwright/test';

test.describe('Render Repeat Loops Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('app-repeat-loops', { state: 'attached' });
  });

  test('renders spec picker and timeline', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Simple List' })).toBeVisible();
    await expect(page.locator('streaming-timeline')).toBeVisible();
  });

  test('shows streaming JSON pane', async ({ page }) => {
    await expect(page.locator('pre')).toBeVisible();
  });

  test('repeats one row per /items entry and re-renders when an item is added', async ({ page }) => {
    // Selecting a spec restarts the stream, so the render output settles
    // on the complete Simple List spec.
    await page.locator('button', { hasText: 'Simple List' }).click();

    const renderedRows = page.locator('[primary] demo-text p');
    await expect(renderedRows).toHaveText(['Alpha', 'Beta', 'Gamma'], { timeout: 30_000 });

    await page.locator('button', { hasText: '+ Add Item' }).click();

    await expect(renderedRows).toHaveText(['Alpha', 'Beta', 'Gamma', 'Item 1']);
  });
});
