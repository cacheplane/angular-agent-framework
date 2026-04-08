import { expect, test } from '@playwright/test';

test.describe('Render Spec Rendering Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4401');
    await page.waitForSelector('app-spec-rendering', { state: 'attached' });
  });

  test('renders the chat interface with render preview sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Live Render Preview');
  });

  test('displays the JSON spec in the sidebar', async ({ page }) => {
    await expect(page.locator('aside pre')).toBeVisible();
    await expect(page.locator('aside pre')).toContainText('container');
  });
});
