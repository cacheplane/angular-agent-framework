import { expect, test } from '@playwright/test';

test.describe('Chat Tool Calls Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4504');
    await page.waitForSelector('app-tool-calls', { state: 'attached' });
  });

  test('renders the chat interface with tool calls sidebar', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Tool Calls');
  });

  test('displays the available tools list', async ({ page }) => {
    await expect(page.locator('aside')).toContainText('search');
    await expect(page.locator('aside')).toContainText('calculator');
    await expect(page.locator('aside')).toContainText('weather');
  });
});
