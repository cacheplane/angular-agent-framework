import { expect, test } from '@playwright/test';

test.describe('Chat Input Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4502');
    await page.waitForSelector('app-input', { state: 'attached' });
  });

  test('renders the chat input interface with state sidebar', async ({ page }) => {
    await expect(page.locator('chat-input')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside h3')).toHaveText('Input State');
  });

  test('displays the features list', async ({ page }) => {
    await expect(page.locator('aside')).toContainText('Custom placeholder text');
    await expect(page.locator('aside')).toContainText('Enter to send');
  });
});
